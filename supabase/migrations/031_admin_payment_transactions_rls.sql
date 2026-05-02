-- ═══════════════════════════════════════════════════════════════════════════
-- 031_admin_payment_transactions_rls.sql — 어드민 결제 트랜잭션 SELECT (S128 B-2)
--
-- 목적:
--   /admin/orders/[orderNumber] 상세 페이지가 결제 시각·결제 ID(provider_payment_key)
--   를 표시하기 위해 payment_transactions 를 read 한다.
--
-- 기존 정책 (007 § H4 · 006 코멘트):
--   service_role 전용. authenticated 정책 미선언 = 전면 차단.
--   웹훅 처리·결제 승인은 service_role (RPC) 에서만.
--
-- 신규 정책:
--   admin (is_admin = true) 은 SELECT 만 허용. INSERT/UPDATE/DELETE 는 여전히
--   service_role 전용 (웹훅 멱등성·금액 무결성 정책 그대로).
--
-- 참조:
--   - 006_payment_transactions.sql
--   - 007_rls_policies.sql §H4
--   - 020_profiles_role_rbac.sql (is_admin · profiles_select_admin 패턴)
--   - 030_admin_orders_rls.sql   (orders_select_admin · 동일 패턴)
-- ═══════════════════════════════════════════════════════════════════════════

create policy "payment_transactions_select_admin"
  on public.payment_transactions for select
  to authenticated
  using (public.is_admin((select auth.uid())));

comment on policy "payment_transactions_select_admin" on public.payment_transactions is
  '어드민(is_admin) SELECT 허용. INSERT/UPDATE/DELETE 는 service_role 전용 유지.';
