-- ═══════════════════════════════════════════════════════════════════════════
-- 020_profiles_role_rbac.sql — RBAC (admin/customer) 역할 분리
--
-- 목적:
--   - profiles.role 컬럼으로 앱 레벨 역할 분리 (customer 기본, admin 승격은 SQL 수동)
--   - public.is_admin(uid) SECURITY DEFINER 헬퍼로 RLS·서버 가드 양쪽 재사용
--   - admin_audit 로그 테이블 (어드민 승격/강등 추적)
--   - 기존 profiles RLS 는 본인 행만 허용 → admin 이 다른 유저 조회 가능하도록 확장
--
-- 결정 (ADR-003):
--   - profiles.role 컬럼 채택. Supabase JWT 의 role claim 은 authenticated/anon/service_role
--     구조로 이미 점유되어 앱 레벨 role 과 충돌. profiles 는 앱-도메인 단일 소스.
--   - is_admin() 헬퍼는 SECURITY DEFINER + search_path 고정으로 하이재킹 방지.
--     RLS policy 내부의 SELECT 루프를 피하고자 STABLE 선언 (per-statement 캐시).
--   - 초기 admin 승격은 프로덕션 DB 에서 SQL 직접 실행 (UI 부재 허용).
--
-- 참조:
--   - docs/adr/ADR-003-rbac-role-separation.md
--   - supabase/migrations/007_rls_policies.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ── role enum ──────────────────────────────────────────────────────────
-- text + CHECK 대신 enum 으로 고정 (타입 안전성, 인덱스 효율)
create type public.user_role as enum ('customer', 'admin');

-- ── profiles.role 컬럼 추가 ────────────────────────────────────────────
alter table public.profiles
  add column role public.user_role not null default 'customer';

-- 자주 조회하는 패턴: WHERE role = 'admin' (어드민 목록)
create index profiles_role_idx on public.profiles (role) where role = 'admin';

comment on column public.profiles.role is
  '앱 레벨 역할 (customer 기본, admin 수동 승격). Supabase JWT 의 role claim 과 독립.';

-- ── is_admin() 헬퍼 ────────────────────────────────────────────────────
-- RLS policy 에서 (select is_admin((select auth.uid()))) 형태로 호출.
-- STABLE: 같은 트랜잭션 내 결과 불변 → per-statement 캐시로 행별 재평가 방지.
-- SECURITY DEFINER: 호출자가 profiles_select_own RLS 를 통과하지 못해도 role 조회 가능.
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role = 'admin'
  );
$$;

comment on function public.is_admin(uuid) is
  'RBAC 헬퍼: 주어진 user_id 가 admin 역할인지 확인. RLS·서버 가드 공용.';

-- anon/authenticated 에 execute 권한 (함수 본체는 SECURITY DEFINER 로 RLS 우회)
grant execute on function public.is_admin(uuid) to authenticated, anon, service_role;

-- ── profiles.role 불변 트리거 (클라이언트 직접 승격 차단) ─────────────
-- 클라이언트 UPDATE 로 role 변경 시도 차단. service_role / SECURITY DEFINER 함수만 예외.
-- 예외 플래그: app.allow_role_change = 'true'
create or replace function public.prevent_profiles_role_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.role is distinct from old.role
    and current_setting('app.allow_role_change', true) is distinct from 'true' then
    raise exception 'profiles.role is managed by admin tooling only'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_profiles_role_change();

-- ── profiles RLS 확장: admin 은 전체 조회 가능 ─────────────────────────
-- 기존 profiles_select_own 은 유지 (본인 행 열람).
-- admin 은 추가로 전체 프로필 SELECT 가능 → 어드민 UI 기반.
create policy "profiles_select_admin"
  on public.profiles for select
  to authenticated
  using (public.is_admin((select auth.uid())));

-- admin 은 다른 유저 role 을 제외한 컬럼 업데이트 가능.
-- role 컬럼은 prevent_profiles_role_change 트리거가 플래그 없으면 거부.
-- (RLS 는 컬럼 단위 WITH CHECK 를 강제하지 않음 → 트리거가 방어선)
create policy "profiles_update_admin"
  on public.profiles for update
  to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

-- ── admin_audit: 역할 변경 추적 ────────────────────────────────────────
create table public.admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  target_user_id uuid not null references auth.users (id) on delete cascade,
  action text not null check (action in ('grant_admin', 'revoke_admin')),
  reason text check (reason is null or char_length(reason) between 1 and 500),
  created_at timestamptz not null default now()
);

create index admin_audit_target_idx on public.admin_audit (target_user_id, created_at desc);
create index admin_audit_actor_idx on public.admin_audit (actor_id, created_at desc);

alter table public.admin_audit enable row level security;
alter table public.admin_audit force row level security;

-- admin 만 조회 가능
create policy "admin_audit_select_admin"
  on public.admin_audit for select
  to authenticated
  using (public.is_admin((select auth.uid())));

-- INSERT/UPDATE/DELETE: service_role 전용 (정책 미선언 = deny)

comment on table public.admin_audit is
  '역할 변경 감사 로그. admin 승격/강등 기록. RLS: admin SELECT, 쓰기는 service_role 전용.';

-- ── grant_admin / revoke_admin RPC ─────────────────────────────────────
-- 역할 변경을 트랜잭션으로 수행 + 감사 로그 기록.
-- SECURITY DEFINER 로 role 불변 트리거를 플래그로 우회.
-- 호출자는 반드시 admin 이어야 하며, 본인이 본인을 강등하는 패턴은 허용하지 않음.

create or replace function public.grant_admin(
  target_id uuid,
  reason text default null
) returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;
  if not public.is_admin(actor) then
    raise exception 'admin role required' using errcode = 'insufficient_privilege';
  end if;
  if actor = target_id then
    raise exception 'cannot self-grant admin' using errcode = 'insufficient_privilege';
  end if;

  perform set_config('app.allow_role_change', 'true', true);
  update public.profiles set role = 'admin' where id = target_id;
  perform set_config('app.allow_role_change', 'false', true);

  insert into public.admin_audit (actor_id, target_user_id, action, reason)
  values (actor, target_id, 'grant_admin', reason);
end;
$$;

create or replace function public.revoke_admin(
  target_id uuid,
  reason text default null
) returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;
  if not public.is_admin(actor) then
    raise exception 'admin role required' using errcode = 'insufficient_privilege';
  end if;
  if actor = target_id then
    raise exception 'cannot self-revoke admin' using errcode = 'insufficient_privilege';
  end if;

  perform set_config('app.allow_role_change', 'true', true);
  update public.profiles set role = 'customer' where id = target_id;
  perform set_config('app.allow_role_change', 'false', true);

  insert into public.admin_audit (actor_id, target_user_id, action, reason)
  values (actor, target_id, 'revoke_admin', reason);
end;
$$;

grant execute on function public.grant_admin(uuid, text) to authenticated;
grant execute on function public.revoke_admin(uuid, text) to authenticated;

comment on function public.grant_admin(uuid, text) is
  'admin 역할 승격. 호출자 본인 admin 필수, self-grant 차단. admin_audit 자동 기록.';
comment on function public.revoke_admin(uuid, text) is
  'admin 역할 강등. 호출자 본인 admin 필수, self-revoke 차단. admin_audit 자동 기록.';

-- ── 초기 admin 승격 가이드 (수동) ───────────────────────────────────────
-- 최초 admin 은 RPC 권한 조건(호출자 admin)을 만족하는 자가 없음 → SQL 직접 UPDATE.
-- 프로덕션에서는 Supabase 대시보드 SQL Editor 에서 다음 실행:
--
--   select set_config('app.allow_role_change', 'true', true);
--   update public.profiles set role = 'admin' where email = 'admin@example.com';
--   insert into public.admin_audit (actor_id, target_user_id, action, reason)
--     select id, id, 'grant_admin', 'bootstrap' from public.profiles where role = 'admin';
