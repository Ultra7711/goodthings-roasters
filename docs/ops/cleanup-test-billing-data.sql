-- ═══════════════════════════════════════════════════════════════════════════
-- cleanup-test-billing-data.sql — 오픈(라이브) 전 테스트 데이터 일괄 삭제
--
-- 목적: 정식 오픈 직전, 개발/심사 중 쌓인 테스트 주문·결제·정기구독 데이터를 비운다.
--       (ADR-008 §0 D-4 "라이브 전 test 데이터 truncate" 정책 이행 · S340 설계)
--
-- ⚠️ 비가역. 반드시 ① 건수 확인 → ② 트랜잭션 실행 → ③ 사후 검증 순서로.
--    Supabase SQL Editor 에서 수동 실행. 실행 시점 = 토스 라이브 심사 통과 후, 오픈 직전.
--
-- 보존 (건드리지 않음):
--   - auth.users / profiles      회원 계정
--   - addresses                  배송지
--   - billing_methods            ★ 빌링키(결제수단) — 보존 결정(S340). 단 구독 삭제로
--                                  미참조(orphan) 상태가 되며, 결제는 일어나지 않아 무해.
--   - reviews                    주문과 FK 무관(user_id·product_slug 연동)
--
-- 삭제:
--   - payment_transactions       결제 이벤트 로그 (orders restrict → 먼저)
--   - payments                   결제내역        (orders restrict → 먼저)
--   - point_ledger               적립 이력 (+ profiles.point_balance 0 리셋)
--   - subscriptions              정기구독 (→ subscription_billing_failures ·
--                                  subscription_audit_log on delete cascade 자동)
--   - orders                     주문 (→ order_items on delete cascade 자동)
--
-- FK 근거: payments/payment_transactions.order_id = on delete restrict (012·006),
--          order_items.order_id / billing_failures.subscription_id = cascade (004·040),
--          point_ledger.order_id = set null (091), profiles.point_balance 직접 UPDATE
--          차단 트리거(093) → set_config 플래그 우회 필요.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── ① 실행 전 건수 확인 ──────────────────────────────────────────────────────
select 'orders' t, count(*) n from public.orders
union all select 'order_items', count(*) from public.order_items
union all select 'payments', count(*) from public.payments
union all select 'payment_transactions', count(*) from public.payment_transactions
union all select 'subscriptions', count(*) from public.subscriptions
union all select 'subscription_billing_failures', count(*) from public.subscription_billing_failures
union all select 'point_ledger', count(*) from public.point_ledger
union all select 'billing_methods (유지)', count(*) from public.billing_methods;


-- ── ② 정리 트랜잭션 ─────────────────────────────────────────────────────────
begin;

delete from public.payment_transactions;   -- orders restrict → 먼저
delete from public.payments;               -- orders restrict → 먼저
delete from public.point_ledger;           -- 적립 이력 전체
delete from public.subscriptions;          -- → failures · audit_log cascade 자동
delete from public.orders;                 -- → order_items cascade 자동

-- 적립금 잔액 0 리셋 (직접변경 차단 트리거 우회 · 트랜잭션 한정 플래그)
select set_config('app.allow_point_balance_sync', 'true', true);
update public.profiles set point_balance = 0 where point_balance <> 0;

commit;


-- ── ③ 사후 검증 (billing_methods 외 전부 0 이어야 함) ────────────────────────
select 'orders' t, count(*) n from public.orders
union all select 'payments', count(*) from public.payments
union all select 'payment_transactions', count(*) from public.payment_transactions
union all select 'subscriptions', count(*) from public.subscriptions
union all select 'subscription_billing_failures', count(*) from public.subscription_billing_failures
union all select 'billing_methods', count(*) from public.billing_methods;
