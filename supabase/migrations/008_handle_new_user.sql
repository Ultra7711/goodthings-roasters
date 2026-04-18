-- ═══════════════════════════════════════════════════════════════════════════
-- 008_handle_new_user.sql — auth.users INSERT 트리거
--
-- 리뷰 Pass 1 반영 (2026-04-16):
--   - H2: full_name XSS sanitize (<, >, &, ", ' 제거 + trim + 길이 제한)
--   - M8: split_part 빈 문자열 폴백 (nullif)
--
-- 목적: auth.users 신규 생성 시 profiles 레코드 자동 생성.
--   - OAuth 콜백, 어드민 createUser, 이메일 가입 등 모든 경로 커버.
--   - SECURITY DEFINER 로 RLS 우회 (시스템 관리 작업).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.handle_new_user ()
returns trigger
language plpgsql
security definer
-- 검색 경로 고정 — SECURITY DEFINER 함수는 search_path 하이재킹 방지 필수.
set search_path = public, pg_catalog
as $$
declare
  v_raw_name text;
  v_full_name text;
  v_phone text;
  v_email_local text;
begin
  -- full_name 우선순위: user_metadata.full_name → user_metadata.name → email local-part
  v_raw_name := coalesce (
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name'
  );

  -- H2: OAuth nickname 에 HTML 특수문자 포함 가능 → 제거.
  -- profiles_full_name_no_html CHECK 와 이중 방어.
  if v_raw_name is not null then
    v_full_name := regexp_replace(v_raw_name, '[<>&"'']', '', 'g');
    v_full_name := trim(v_full_name);
    -- 전부 제거된 경우 NULL 처리
    if char_length(v_full_name) = 0 then
      v_full_name := null;
    -- 최대 80자 제한 (profiles_full_name_length CHECK 선제 적용)
    elsif char_length(v_full_name) > 80 then
      v_full_name := substring(v_full_name from 1 for 80);
    end if;
  end if;

  -- M8: sanitize 결과가 NULL 이면 email local-part 폴백.
  -- split_part 가 빈 문자열 반환할 수 있으므로 nullif 로 NULL 정규화.
  if v_full_name is null then
    v_email_local := nullif(split_part(coalesce(new.email, ''), '@', 1), '');
    v_full_name := v_email_local;  -- NULL 허용 (profiles.full_name nullable)
  end if;

  -- phone: user_metadata 또는 auth.users.phone
  v_phone := coalesce (
    new.raw_user_meta_data ->> 'phone',
    new.phone
  );

  insert into public.profiles (id, email, full_name, phone)
  values (new.id, new.email, v_full_name, v_phone)
  -- 재시도·테스트 시 중복 오류 방지
  on conflict (id) do nothing;

  return new;
end;
$$;

-- auth.users 테이블에 트리거 부착
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user ();

comment on function public.handle_new_user () is
  'auth.users INSERT 시 profiles 레코드 자동 생성. SECURITY DEFINER + search_path 고정 + H2 sanitize + M8 nullif 폴백.';
