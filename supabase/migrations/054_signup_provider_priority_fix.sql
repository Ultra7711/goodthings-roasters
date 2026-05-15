-- ═══════════════════════════════════════════════════════════════════════════
-- 054_signup_provider_priority_fix.sql — signup_provider 우선순위 정정 (S232)
--
-- 배경 (053 마이그 적용 후 실측):
--   - kakao/naver callback 은 supabaseAdmin.auth.admin.createUser 로 user 생성.
--   - 이 경우 Supabase 가 raw_app_meta_data.provider 를 'email' 로 박음.
--     (admin API 가 email 기반 user 를 만든다는 의미일 뿐 실제 가입 채널 아님)
--   - 결과: 모든 사용자가 'email' 로 backfill 됨.
--
-- 정정된 우선순위:
--   1. raw_user_meta_data.provider IN ('kakao','naver')
--      → kakao/naver callback 코드가 명시적으로 박은 값. 신뢰 1순위.
--   2. raw_app_meta_data.providers 배열에 'google' 포함
--      → Supabase signInWithOAuth(google) 가 박는 표준 위치.
--   3. raw_app_meta_data.providers 배열에 'kakao'/'naver' 포함 (안전망)
--   4. 그 외 → 'email'
--
-- 정책 노트:
--   - email + google merge 케이스 (providers=['email','google']) 는 'google' 로 분류.
--     이유: 운영 분석 관점에서 OAuth 사용자를 가시화하는 것이 우선.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. backfill 재실행 ────────────────────────────────────────────────
update public.profiles p
set signup_provider = case
  when u.raw_user_meta_data->>'provider' in ('kakao', 'naver')
    then u.raw_user_meta_data->>'provider'
  when u.raw_app_meta_data->'providers' ? 'google'
    then 'google'
  when u.raw_app_meta_data->'providers' ? 'kakao'
    then 'kakao'
  when u.raw_app_meta_data->'providers' ? 'naver'
    then 'naver'
  else 'email'
end
from auth.users u
where p.id = u.id;

-- ── 2. handle_new_user 트리거 갱신 ─────────────────────────────────────
-- 신규 가입 시 동일 우선순위 적용.
create or replace function public.handle_new_user ()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_raw_name text;
  v_full_name text;
  v_phone text;
  v_email_local text;
  v_provider text;
begin
  v_raw_name := coalesce (
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name'
  );

  -- H2: HTML 특수문자 sanitize (008 답습)
  if v_raw_name is not null then
    v_full_name := regexp_replace(v_raw_name, '[<>&"'']', '', 'g');
    v_full_name := trim(v_full_name);
    if char_length(v_full_name) = 0 then
      v_full_name := null;
    elsif char_length(v_full_name) > 80 then
      v_full_name := substring(v_full_name from 1 for 80);
    end if;
  end if;

  -- M8: email local-part 폴백
  if v_full_name is null then
    v_email_local := nullif(split_part(coalesce(new.email, ''), '@', 1), '');
    v_full_name := v_email_local;
  end if;

  v_phone := coalesce (
    new.raw_user_meta_data ->> 'phone',
    new.phone
  );

  -- 054: 가입 채널 추출 — 정정된 우선순위.
  if new.raw_user_meta_data ->> 'provider' in ('kakao', 'naver') then
    v_provider := new.raw_user_meta_data ->> 'provider';
  elsif new.raw_app_meta_data -> 'providers' ? 'google' then
    v_provider := 'google';
  elsif new.raw_app_meta_data -> 'providers' ? 'kakao' then
    v_provider := 'kakao';
  elsif new.raw_app_meta_data -> 'providers' ? 'naver' then
    v_provider := 'naver';
  else
    v_provider := 'email';
  end if;

  -- enum 외 값 방어 (이론상 위 case 가 모두 커버)
  if v_provider not in ('email', 'google', 'kakao', 'naver') then
    v_provider := 'email';
  end if;

  insert into public.profiles (id, email, full_name, display_name, phone, signup_provider)
  values (new.id, new.email, v_full_name, v_full_name, v_phone, v_provider)
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user () is
  'auth.users INSERT 시 profiles 레코드 자동 생성. 054: signup_provider 우선순위 정정 (raw_user_meta_data → raw_app_meta_data.providers).';
