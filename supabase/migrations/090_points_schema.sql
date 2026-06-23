-- ═══════════════════════════════════════════════════════════════════════════
-- 090_points_schema.sql — 적립금(포인트) 시스템 enum + 잔액 컬럼 (Phase 1)
--
-- 목적 (docs/points-implementation-plan.md §5):
--   포인트는 현금과 직결되므로 결제 무결성(S260)과 동급 보안으로 다룬다.
--   본 마이그는 포인트 원장(point_ledger, 091)의 전제가 되는 enum 2종과
--   profiles 의 비정규화 잔액 컬럼을 추가한다.
--
-- 설계 결정:
--   - point_event_type : 원장 이벤트 종류. 'earn_pending' 은 제외(DEC-P1·S324).
--     적립 예정은 ledger 에 기록하지 않고 표시용 계산값으로만 다룬다 →
--     불변식 SUM(point_ledger.amount) == profiles.point_balance 가 항상 성립(T7).
--   - point_source     : 변동 사유 카테고리. 결제·행동·환불·만료·수동.
--   - profiles.point_balance : 빠른 조회용 비정규화 잔액. 093 트리거가 ledger 와
--     동기화한다. CHECK(>= 0) 가 음수 잔액(T2)의 최종 방어선.
--
-- 참조:
--   - 006_payment_transactions.sql (append-only + idempotency_key UNIQUE 선례)
--   - 020_profiles_role_rbac.sql / 055 (profiles ALTER ADD COLUMN 패턴)
--   - docs/points-implementation-plan.md §3 (위협 모델 T1~T8)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. point_event_type enum ─────────────────────────────────────────────
-- earned   : 적립 (결제 확정·행동) — amount > 0
-- used     : 사용 (결제 시 차감)   — amount < 0
-- expired  : 만료 소멸             — amount < 0 (만료 활성화 sprint 에서 사용)
-- adjusted : 어드민 수동 가감       — amount 양/음 모두 허용
-- reversed : 환불 시 사용분 복원    — amount > 0
create type public.point_event_type as enum (
  'earned',
  'used',
  'expired',
  'adjusted',
  'reversed'
);

comment on type public.point_event_type is
  '포인트 원장 이벤트 종류. 적립 예정(pending)은 ledger 미기록 → 표시용 계산값(DEC-P1).';

-- ── 2. point_source enum ─────────────────────────────────────────────────
-- 변동 사유 카테고리. 어드민 트리거 설정(site_settings.points)과 매핑.
create type public.point_source as enum (
  'order',     -- 결제 적립/사용
  'signup',    -- 가입 적립
  'review',    -- 리뷰 작성 적립
  'birthday',  -- 생일 적립
  'manual',    -- 어드민 수동 가감(adjusted)
  'refund',    -- 환불에 따른 복원(reversed)
  'expiry'     -- 만료 소멸(expired)
);

comment on type public.point_source is
  '포인트 변동 사유 카테고리. 결제·행동(가입/리뷰/생일)·환불·만료·수동.';

-- ── 3. profiles.point_balance 컬럼 ───────────────────────────────────────
-- 비정규화 잔액. 093 sync_point_balance 트리거가 ledger INSERT 시 동기화.
-- CHECK(>= 0): ledger INSERT 가 잔액을 음수로 만들면 위반 → 트랜잭션 rollback(T2).
alter table public.profiles
  add column point_balance integer not null default 0
    check (point_balance >= 0);

comment on column public.profiles.point_balance is
  '보유 포인트 잔액(원 단위 정수). point_ledger 와 093 트리거로 동기화.
   직접 UPDATE 는 prevent_profiles_point_balance_change(093) 가 차단 — RPC 경유만 가능.';
