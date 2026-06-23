-- ═══════════════════════════════════════════════════════════════════════════
-- 093_point_balance_sync.sql — 잔액 동기화 + 직접변경 차단 트리거 (Phase 1)
--
-- 목적 (docs/points-implementation-plan.md §3 T2·T4·T7):
--   profiles.point_balance 를 point_ledger 와 항상 일치시킨다(불변식 T7).
--   ledger INSERT 가 유일한 잔액 변경 경로가 되도록, profiles 직접 UPDATE 로
--   잔액을 조작하는 경로(admin 의 profiles_update_admin 포함)를 차단한다(T4).
--
-- 패턴 (001 email / 020 role / 055 admin_level 직접변경 차단 트리거 답습):
--   - prevent_profiles_point_balance_change : sync 트리거만 set_config 플래그로 예외.
--   - sync_point_balance : ledger AFTER INSERT → 잔액 ± amount.
--     CHECK(point_balance >= 0)(090)이 음수 잔액(T2)을 트랜잭션 rollback 으로 방어.
--
-- 음수 방지 설계:
--   별도 prevent_balance_negative 트리거는 두지 않는다 — 090 의 CHECK 제약이
--   동일 역할을 더 단순·확실하게 수행한다(sync UPDATE 가 음수 도달 시 즉시 위반).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. point_balance 직접변경 차단 트리거 ─────────────────────────────────
-- sync_point_balance 만 app.allow_point_balance_sync='true' 플래그로 예외.
create or replace function public.prevent_profiles_point_balance_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.point_balance is distinct from old.point_balance
    and current_setting('app.allow_point_balance_sync', true) is distinct from 'true' then
    raise exception 'profiles.point_balance is managed by point RPCs only (use earn_points/use_points/...)'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

comment on function public.prevent_profiles_point_balance_change is
  'T4: profiles.point_balance 직접 UPDATE 차단. sync_point_balance(플래그) 만 예외.';

create trigger profiles_prevent_point_balance_change
  before update on public.profiles
  for each row execute function public.prevent_profiles_point_balance_change();

-- ── 2. 잔액 동기화 트리거 ──────────────────────────────────────────────────
-- ledger INSERT 시 해당 회원 잔액에 amount 를 가산(used/expired 는 음수라 차감).
-- 플래그 on → update → off 로 prevent 트리거를 우회.
-- 잔액이 음수가 되면 profiles_point_balance_check(090) 위반 → 전체 rollback(T2).
create or replace function public.sync_point_balance()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform set_config('app.allow_point_balance_sync', 'true', true);
  update public.profiles
    set point_balance = point_balance + new.amount
    where id = new.user_id;
  perform set_config('app.allow_point_balance_sync', 'false', true);
  return new;
end;
$$;

comment on function public.sync_point_balance is
  'T7: point_ledger INSERT → profiles.point_balance 동기화. '
  '불변식 SUM(amount)=balance 유지. 음수 도달 시 CHECK 위반 rollback(T2).';

create trigger point_ledger_sync_balance
  after insert on public.point_ledger
  for each row execute function public.sync_point_balance();
