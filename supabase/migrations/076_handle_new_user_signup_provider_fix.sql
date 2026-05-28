-- ═══════════════════════════════════════════════════════════════════════════
-- 076_handle_new_user_signup_provider_fix.sql — handle_new_user 회귀 fix (S295)
--
-- 배경:
--   066_newsletter_signup_integration.sql 가 handle_new_user 함수를 008 원본으로
--   회귀시켰음. 그 사이 053 (signup_provider NOT NULL + CHECK) 가 도입돼 있어,
--   trigger 가 profiles INSERT 시 signup_provider 누락 → NOT NULL violation →
--   회원가입 자체 fail (500 unexpected_failure).
--
-- 증상:
--   /signup → "회원가입에 실패했습니다."
--   Network → POST /auth/v1/signup → 500 x-sb-error-code: unexpected_failure
--
-- Fix:
--   handle_new_user 를 053 (provider 추출) + 029 (display_name) + 066 (newsletter)
--   세 변경을 모두 합쳐 재정의. profiles INSERT 컬럼 = id, email, full_name,
--   display_name, phone, signup_provider.
--
-- 재실행 안전: CREATE OR REPLACE FUNCTION.
-- ═══════════════════════════════════════════════════════════════════════════

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
  -- ── full_name 추출 + sanitize (008 답습) ──
  v_raw_name := coalesce (
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name'
  );

  if v_raw_name is not null then
    v_full_name := regexp_replace(v_raw_name, '[<>&"'']', '', 'g');
    v_full_name := trim(v_full_name);
    if char_length(v_full_name) = 0 then
      v_full_name := null;
    elsif char_length(v_full_name) > 80 then
      v_full_name := substring(v_full_name from 1 for 80);
    end if;
  end if;

  if v_full_name is null then
    v_email_local := nullif(split_part(coalesce(new.email, ''), '@', 1), '');
    v_full_name := v_email_local;
  end if;

  v_phone := coalesce (
    new.raw_user_meta_data ->> 'phone',
    new.phone
  );

  -- ── 053: signup_provider 추출 (NOT NULL + CHECK 만족) ──
  v_provider := coalesce(
    new.raw_app_meta_data ->> 'provider',
    new.raw_user_meta_data ->> 'provider',
    'email'
  );
  if v_provider not in ('email', 'google', 'kakao', 'naver') then
    v_provider := 'email';
  end if;

  -- ── profiles INSERT (029 display_name + 053 signup_provider 포함) ──
  insert into public.profiles (id, email, full_name, display_name, phone, signup_provider)
  values (new.id, new.email, v_full_name, v_full_name, v_phone, v_provider)
  on conflict (id) do nothing;

  -- ── 066: newsletter 자동 subscribe (graceful) ──
  if new.email is not null then
    begin
      insert into public.newsletter_subscribers (email, user_id, source, status)
      values (new.email, new.id, 'signup_default', 'active')
      on conflict (email) do update set
        user_id = excluded.user_id,
        updated_at = now();
    exception when others then
      raise warning '[handle_new_user] newsletter subscribe failed: %', sqlerrm;
    end;
  end if;

  return new;
end;
$$;

comment on function public.handle_new_user () is
  'auth.users INSERT → profiles + newsletter_subscribers 생성. 053 signup_provider + 029 display_name + 066 newsletter 통합 (076 회귀 fix).';
