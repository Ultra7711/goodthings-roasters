-- ═══════════════════════════════════════════════════════════════════════════
-- 044_admin_subscriptions_rls.sql — 어드민 구독 조회·편집 RLS (S188)
--
-- 목적:
--   - /admin/subscriptions UI 가 모든 구독을 조회/편집할 수 있도록 RLS 정책 추가.
--   - 운영 안전 망 — cycle 계산 BUG 같은 사고 시 SQL 직접 수정 대신 GUI 복구.
--
-- 정책:
--   - subscriptions SELECT : authenticated 중 is_admin(uid) = true 만 전체 행 접근.
--   - subscriptions UPDATE : authenticated 중 is_admin(uid) = true 만 전체 행 변경.
--   - 030 admin_orders_rls 패턴 답습 (defense in depth).
--
-- 컬럼 보호 (Server Action 책임):
--   - admin UPDATE 정책은 행 단위라 모든 컬럼을 변경 가능.
--   - Server Action (actions.ts) 가 명시적 컬럼 (next_delivery_at) 만 update 보장.
--   - 컬럼별 트리거 추가 보호는 carry-over (전체 admin 정기배송 기능 풀 구축 시).
--
-- 참조:
--   - 005_subscriptions.sql              (subscriptions 스키마)
--   - 007_rls_policies.sql               (subscriptions_select_own / update_own)
--   - 020_profiles_role_rbac.sql         (is_admin · profiles_select_admin 패턴)
--   - 030_admin_orders_rls.sql           (orders_select_admin · 답습 source)
--   - docs/adr/ADR-006-admin-pages-api-separation.md
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. subscriptions SELECT (admin) ──────────────────────────────────────
-- 본인 구독 조회 정책 (subscriptions_select_own) 은 그대로 유지.
-- admin 은 추가로 모든 행 SELECT 가능.
create policy "subscriptions_select_admin"
  on public.subscriptions for select
  to authenticated
  using (public.is_admin((select auth.uid())));

comment on policy "subscriptions_select_admin" on public.subscriptions is
  '어드민(is_admin = true) 은 모든 구독 SELECT 가능. /admin/subscriptions UI 운영용.';

-- ── 2. subscriptions UPDATE (admin) ──────────────────────────────────────
-- 본인 구독 수정 정책 (subscriptions_update_own) 은 그대로 유지.
-- admin 은 추가로 모든 행 UPDATE 가능 (운영 안전망 — next_delivery_at 등 복구용).
create policy "subscriptions_update_admin"
  on public.subscriptions for update
  to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

comment on policy "subscriptions_update_admin" on public.subscriptions is
  '어드민 은 모든 구독 UPDATE 가능. 운영 안전망 (cycle BUG 같은 사고 시 GUI 복구).';
