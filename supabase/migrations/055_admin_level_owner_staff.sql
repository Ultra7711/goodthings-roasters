-- ═══════════════════════════════════════════════════════════════════════════
-- 055_admin_level_owner_staff.sql — admin 권한 2단계 분리 (S232)
--
-- 배경:
--   - 020 ADR-003 의 profiles.role enum (customer | admin) 유지.
--   - admin 안에서 owner / staff 분리 필요 (CSV 내보내기 · 영구 삭제 · 사용자 권한 변경 등
--     민감 액션은 owner 만 허용).
--
-- 정책 (S232 잠금):
--   - profiles.admin_level text NULL — customer 는 NULL, admin 은 'owner' 또는 'staff'.
--   - CHECK constraint: (role='admin') = (admin_level IS NOT NULL)
--   - admin_level IN ('owner','staff')
--   - 신규 admin 승격 시 grant_admin RPC 가 default 'staff' 박음 (보수적).
--   - admin_level 변경은 set_admin_level RPC 만 가능 (owner 호출 + 마지막 owner 자기 강등 차단).
--
-- backfill:
--   - 기존 admin 모두 → 'owner' (사장 본인 등 기존 권한 보존).
--
-- 트리거:
--   - prevent_profiles_admin_level_change — 클라이언트 직접 변경 차단 (role 패턴 답습).
--
-- 영향:
--   - 020 의 grant_admin RPC 는 프로필 INSERT 시 admin_level='staff' 박도록 갱신.
--   - revoke_admin 은 admin_level NULL 로 reset.
--   - admin_audit.action 에 'set_admin_level' 추가 허용.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. admin_level 컬럼 ──────────────────────────────────────────────
alter table public.profiles
  add column if not exists admin_level text;

comment on column public.profiles.admin_level is
  'admin 역할 안의 권한 단계. customer = NULL · admin = ''owner''(관리자) | ''staff''(운영자). set_admin_level RPC 만 변경 가능.';

-- ── 2. backfill ──────────────────────────────────────────────────────
-- 기존 admin 모두 owner 로 (사장 본인 보존)
update public.profiles
set admin_level = 'owner'
where role = 'admin' and admin_level is null;

-- ── 3. CHECK constraint ────────────────────────────────────────────────
alter table public.profiles
  drop constraint if exists profiles_admin_level_chk;

alter table public.profiles
  add constraint profiles_admin_level_chk check (
    (role = 'customer' and admin_level is null)
    or (role = 'admin' and admin_level in ('owner', 'staff'))
  );

-- ── 4. index — owner / staff 카운트 가속 ──────────────────────────────
create index if not exists idx_profiles_admin_level
  on public.profiles (admin_level)
  where admin_level is not null;

-- ── 5. is_admin_owner() RPC ──────────────────────────────────────────
create or replace function public.is_admin_owner(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role = 'admin' and admin_level = 'owner'
  );
$$;

comment on function public.is_admin_owner(uuid) is
  'RBAC 헬퍼: 주어진 user_id 가 admin owner (관리자) 인지 확인. CSV / 영구 삭제 / 권한 변경 등 민감 액션 가드.';

grant execute on function public.is_admin_owner(uuid) to authenticated, anon, service_role;

-- ── 6. admin_level 직접 변경 차단 트리거 ──────────────────────────────
create or replace function public.prevent_profiles_admin_level_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.admin_level is distinct from old.admin_level
    and current_setting('app.allow_admin_level_change', true) is distinct from 'true' then
    raise exception 'profiles.admin_level is managed by set_admin_level RPC only'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_admin_level_change on public.profiles;

create trigger profiles_prevent_admin_level_change
  before update on public.profiles
  for each row execute function public.prevent_profiles_admin_level_change();

-- ── 7. admin_audit.action 확장 ─────────────────────────────────────────
alter table public.admin_audit
  drop constraint if exists admin_audit_action_check;

alter table public.admin_audit
  add constraint admin_audit_action_check check (
    action in ('grant_admin', 'revoke_admin', 'set_admin_level')
  );

-- ── 8. set_admin_level(target_id, new_level, reason) RPC ───────────────
-- owner 만 호출 가능. 본인 self-강등 시 마지막 owner 차단.
create or replace function public.set_admin_level(
  target_id uuid,
  new_level text,
  reason text default null
) returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  actor uuid := auth.uid();
  target_role public.user_role;
  current_level text;
  remaining_owners int;
begin
  if actor is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;
  if not public.is_admin_owner(actor) then
    raise exception 'admin owner role required' using errcode = 'insufficient_privilege';
  end if;
  if new_level not in ('owner', 'staff') then
    raise exception 'invalid level (must be owner|staff)' using errcode = 'check_violation';
  end if;

  select role, admin_level into target_role, current_level
    from public.profiles where id = target_id;

  if not found then
    raise exception 'target user not found' using errcode = 'no_data_found';
  end if;
  if target_role <> 'admin' then
    raise exception 'target user is not admin' using errcode = 'check_violation';
  end if;
  if current_level = new_level then
    return;  -- no-op
  end if;

  -- 마지막 owner self-강등 차단 (owner → staff 전환 시점, 본인 본인)
  if actor = target_id and current_level = 'owner' and new_level = 'staff' then
    select count(*) into remaining_owners
      from public.profiles where role = 'admin' and admin_level = 'owner';
    if remaining_owners <= 1 then
      raise exception 'cannot demote the last owner' using errcode = 'insufficient_privilege';
    end if;
  end if;

  perform set_config('app.allow_admin_level_change', 'true', true);
  update public.profiles set admin_level = new_level where id = target_id;
  perform set_config('app.allow_admin_level_change', 'false', true);

  insert into public.admin_audit (actor_id, target_user_id, action, reason)
  values (actor, target_id, 'set_admin_level', reason);
end;
$$;

comment on function public.set_admin_level(uuid, text, text) is
  'admin 권한 단계 변경 (owner ↔ staff). owner 만 호출 가능. 마지막 owner self-강등 차단. admin_audit 자동 기록.';

grant execute on function public.set_admin_level(uuid, text, text) to authenticated;

-- ── 9. grant_admin / revoke_admin RPC 갱신 ─────────────────────────────
-- grant_admin 은 신규 admin 의 admin_level 을 'staff' 로 박는다 (보수적 default).
-- revoke_admin 은 admin_level 을 NULL 로 reset.
-- 호출자 가드도 owner only 로 강화 (기존: any admin · 변경: owner only — 권한 매트릭스 잠금).

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
  if not public.is_admin_owner(actor) then
    raise exception 'admin owner role required' using errcode = 'insufficient_privilege';
  end if;
  if actor = target_id then
    raise exception 'cannot self-grant admin' using errcode = 'insufficient_privilege';
  end if;

  perform set_config('app.allow_role_change', 'true', true);
  perform set_config('app.allow_admin_level_change', 'true', true);
  update public.profiles
    set role = 'admin', admin_level = 'staff'
    where id = target_id;
  perform set_config('app.allow_role_change', 'false', true);
  perform set_config('app.allow_admin_level_change', 'false', true);

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
  if not public.is_admin_owner(actor) then
    raise exception 'admin owner role required' using errcode = 'insufficient_privilege';
  end if;
  if actor = target_id then
    raise exception 'cannot self-revoke admin' using errcode = 'insufficient_privilege';
  end if;

  perform set_config('app.allow_role_change', 'true', true);
  perform set_config('app.allow_admin_level_change', 'true', true);
  update public.profiles
    set role = 'customer', admin_level = null
    where id = target_id;
  perform set_config('app.allow_role_change', 'false', true);
  perform set_config('app.allow_admin_level_change', 'false', true);

  insert into public.admin_audit (actor_id, target_user_id, action, reason)
  values (actor, target_id, 'revoke_admin', reason);
end;
$$;

comment on function public.grant_admin(uuid, text) is
  '055: admin 승격 + admin_level=staff (보수적 default). 호출자 owner 필수, self-grant 차단.';
comment on function public.revoke_admin(uuid, text) is
  '055: admin 강등 + admin_level NULL reset. 호출자 owner 필수, self-revoke 차단.';
