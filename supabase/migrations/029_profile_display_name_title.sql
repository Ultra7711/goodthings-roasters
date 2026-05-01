-- ═══════════════════════════════════════════════════════════════════════════
-- 029_profile_display_name_title.sql — UI 표시용 display_name + title 컬럼 (S124)
--
-- 목적:
--   - 어드민 사이드바 사용자 카드·환영 헤더에 표시할 이름·직책 데이터.
--   - full_name (OAuth 본명) 과 분리하여 사용자가 자유롭게 편집할 수 있는 표시명 제공.
--
-- 정책:
--   - display_name : 기본은 full_name 복사. 사용자가 마이페이지·어드민에서 변경 가능.
--   - title        : admin 영역 사이드바·헤더에 표시할 직책 (예: 대표·Owner, 관리자).
--   - 제약: 길이 + HTML 특수문자 차단 (full_name 과 동일 패턴).
--
-- backfill:
--   - 기존 모든 사용자: display_name ← full_name (의미상 동일 시작).
--   - admin role: title ← '관리자' 일괄 (운영 중 본인이 변경 가능).
--
-- handle_new_user 트리거 갱신:
--   - 신규 가입 시 display_name 도 함께 채움 (full_name 과 동일 값).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 컬럼 추가 ─────────────────────────────────────────────────────────
alter table public.profiles
  add column display_name text,
  add column title text;

alter table public.profiles
  add constraint profiles_display_name_length check (
    display_name is null or char_length(display_name) between 1 and 80
  );

alter table public.profiles
  add constraint profiles_display_name_no_html check (
    display_name is null or display_name !~ '[<>&"'']'
  );

alter table public.profiles
  add constraint profiles_title_length check (
    title is null or char_length(title) between 1 and 40
  );

comment on column public.profiles.display_name is
  'UI 표시 이름. 사용자가 마이페이지·어드민에서 자유롭게 편집. 신규 가입 시 full_name 복사.';
comment on column public.profiles.title is
  '직책 (예: 대표·Owner / 매니저 / 관리자). admin 영역 사이드바·환영 헤더에 표시.';

-- ── backfill ─────────────────────────────────────────────────────────
-- 기존 사용자의 full_name 을 display_name 으로 복사
update public.profiles
set display_name = full_name
where display_name is null and full_name is not null;

-- admin role 일괄 직책 부여
update public.profiles
set title = '관리자'
where role = 'admin' and title is null;

-- ── handle_new_user 트리거 갱신 ───────────────────────────────────────
-- 신규 가입 시 display_name 도 동시에 채움 (= full_name 동일값)
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
begin
  v_raw_name := coalesce (
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name'
  );

  -- H2: HTML 특수문자 sanitize (008 동일 패턴)
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

  insert into public.profiles (id, email, full_name, display_name, phone)
  values (new.id, new.email, v_full_name, v_full_name, v_phone)
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user () is
  'auth.users INSERT 시 profiles 레코드 자동 생성. 029: display_name 도 함께 초기화.';
