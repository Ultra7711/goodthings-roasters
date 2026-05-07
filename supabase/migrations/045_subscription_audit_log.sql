-- ═══════════════════════════════════════════════════════════════════════════
-- 045_subscription_audit_log.sql — 어드민 구독 변경 이력 (S190)
--
-- 목적:
--   - /admin/subscriptions 에서 어드민이 수행한 배송일·주기·상태 변경을 기록.
--   - 운영 감사(audit) 및 분쟁 해소용 이력 추적.
--
-- 설계:
--   - action check constraint 로 허용 값 고정 (update_next_delivery / update_cycle / update_status).
--   - old_value / new_value: JSONB — 액션별 변경 컬럼 스냅샷.
--   - admin_user_id: 변경 수행 어드민 UUID (탈퇴 시 NULL 허용).
--   - subscription 삭제 시 cascade — 구독 자체가 없어지면 이력도 제거.
--
-- RLS:
--   - SELECT : is_admin() 만 조회 가능.
--   - INSERT : is_admin() 만 삽입 가능 (Server Action 이 유일한 진입점).
--   - UPDATE / DELETE : 정책 없음 (이력 수정·삭제 차단).
--
-- 인덱스:
--   - (subscription_id, created_at DESC) — 구독별 최신순 조회.
--
-- 참조:
--   - 005_subscriptions.sql              (subscriptions 스키마)
--   - 044_admin_subscriptions_rls.sql    (RLS 패턴 답습)
--   - 020_profiles_role_rbac.sql         (is_admin 함수)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. 테이블 생성 ────────────────────────────────────────────────────────
create table public.subscription_audit_log (
  id                uuid        primary key default gen_random_uuid(),
  subscription_id   uuid        not null references public.subscriptions (id) on delete cascade,
  admin_user_id     uuid        references auth.users (id) on delete set null,
  action            text        not null,
  old_value         jsonb,
  new_value         jsonb,
  created_at        timestamptz not null default now(),

  constraint audit_log_action_values check (
    action in ('update_next_delivery', 'update_cycle', 'update_status')
  )
);

comment on table public.subscription_audit_log is
  '어드민이 구독에 수행한 변경 이력. 배송일·주기·상태 변경만 기록.';
comment on column public.subscription_audit_log.action is
  'update_next_delivery | update_cycle | update_status';
comment on column public.subscription_audit_log.old_value is
  '변경 전 컬럼 스냅샷 (JSONB). 액션별 구조:
   update_next_delivery: { next_delivery_at }
   update_cycle        : { cycle, next_delivery_at }
   update_status       : { status }';
comment on column public.subscription_audit_log.new_value is
  '변경 후 컬럼 스냅샷 (JSONB). 액션별 구조:
   update_next_delivery: { next_delivery_at }
   update_cycle        : { cycle, next_delivery_at }
   update_status       : { status, cancel_reason? }';

-- ── 2. 인덱스 ─────────────────────────────────────────────────────────────
create index subscription_audit_log_sub_idx
  on public.subscription_audit_log (subscription_id, created_at desc);

-- ── 3. RLS ────────────────────────────────────────────────────────────────
alter table public.subscription_audit_log enable row level security;

create policy "audit_log_select_admin"
  on public.subscription_audit_log for select
  to authenticated
  using (public.is_admin((select auth.uid())));

comment on policy "audit_log_select_admin" on public.subscription_audit_log is
  '어드민만 이력 SELECT 가능. /admin/subscriptions 변경 이력 탭 전용.';

create policy "audit_log_insert_admin"
  on public.subscription_audit_log for insert
  to authenticated
  with check (public.is_admin((select auth.uid())));

comment on policy "audit_log_insert_admin" on public.subscription_audit_log is
  '어드민 Server Action 에서만 삽입. UPDATE/DELETE 정책 없음 (이력 변조 차단).';
