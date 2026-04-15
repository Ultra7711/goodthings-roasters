-- ═══════════════════════════════════════════════════════════════════════════
-- 001_profiles.sql — profiles 테이블 + 공통 유틸 함수
--
-- 리뷰 Pass 1 반영 (2026-04-16):
--   - H9: set_updated_at() → SECURITY DEFINER + search_path 고정
--   - H8: prevent_id_change() 공통 함수 (profiles·addresses·subscriptions 재사용)
--   - H1: profiles.email 불변 트리거 + auth.users.email 변경 자동 동기화
--   - H2: full_name XSS 차단 CHECK (handle_new_user 와 이중 방어)
--   - M7: profiles.email UNIQUE
--   - M9: phone regex 강화 (^\+?[0-9\-\s]{9,20}$)
--
-- 관련 문서:
--   - docs/oauth-security-plan.md §P2-2
--   - docs/adr/ADR-001-oauth-account-merge-policy.md §3
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 공통 유틸: updated_at 자동 갱신 ────────────────────────────────────
-- SECURITY DEFINER + search_path 고정으로 하이재킹 방지.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── 공통 유틸: PK id 변경 차단 ────────────────────────────────────────
-- UPDATE 시 id 수정 시도 차단. auth.users.id 와의 1:1 불변성 보호.
create or replace function public.prevent_id_change()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'PK id cannot be changed (table=%, old=%, new=%)',
      tg_table_name, old.id, new.id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- ── profiles 테이블 ────────────────────────────────────────────────────
create table public.profiles (
  -- PK = auth.users.id. auth 삭제 시 cascade.
  id uuid primary key references auth.users (id) on delete cascade,

  -- auth.users.email 의 복사본 — sync_profiles_email 트리거가 동기화.
  -- 클라이언트 직접 수정은 prevent_profiles_email_change 로 차단.
  email text not null,

  full_name text,
  phone text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 방어적 제약
  constraint profiles_email_length check (char_length(email) between 3 and 254),
  constraint profiles_email_format check (
    email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  constraint profiles_full_name_length check (
    full_name is null or char_length(full_name) between 1 and 80
  ),
  -- H2: XSS 위협 문자 차단 (handle_new_user 와 이중 방어)
  constraint profiles_full_name_no_html check (
    full_name is null or full_name !~ '[<>&"'']'
  ),
  -- M9: E.164 또는 한국 하이픈 포맷
  constraint profiles_phone_format check (
    phone is null or phone ~ '^\+?[0-9\-\s]{9,20}$'
  )
);

-- M7: email UNIQUE — auth.users.email 과 1:1 보장
create unique index profiles_email_unique_idx on public.profiles (email);

-- 트리거: updated_at
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- H8: id 변경 차단
create trigger profiles_prevent_id_change
  before update on public.profiles
  for each row execute function public.prevent_id_change();

-- ── H1: profiles.email 드리프트 방지 ───────────────────────────────────
-- 클라이언트 직접 수정 차단. auth.users → profiles 동기화 트리거만 예외.
-- 예외 경로: set_config('app.allow_email_sync', 'true', true) 플래그 설정.

create or replace function public.prevent_profiles_email_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.email is distinct from old.email
    and current_setting('app.allow_email_sync', true) is distinct from 'true' then
    raise exception 'profiles.email is read-only (managed by auth.users sync)'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_email_change
  before update on public.profiles
  for each row execute function public.prevent_profiles_email_change();

-- ── H1: auth.users.email 변경 시 profiles 자동 동기화 ─────────────────
create or replace function public.sync_profiles_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.email is distinct from old.email then
    -- 동기화 트리거 내부에서만 email 수정 허용 (플래그 on → update → off)
    perform set_config('app.allow_email_sync', 'true', true);
    update public.profiles set email = new.email where id = new.id;
    perform set_config('app.allow_email_sync', 'false', true);
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.sync_profiles_email();

comment on table public.profiles is
  '애플리케이션 레이어 사용자 프로필. auth.users.user_metadata 와 역할 분리.';
comment on column public.profiles.id is
  'auth.users.id FK. 1:1 관계. prevent_id_change 로 불변 강제.';
comment on column public.profiles.email is
  'auth.users.email 의 복사본 — sync_profiles_email 로 자동 동기화 (H1). 클라이언트 수정 차단.';
