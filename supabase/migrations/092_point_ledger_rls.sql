-- ═══════════════════════════════════════════════════════════════════════════
-- 092_point_ledger_rls.sql — point_ledger RLS (Phase 1)
--
-- 목적 (docs/points-implementation-plan.md §3 T4):
--   포인트 원장 쓰기 경로를 service_role(SECURITY DEFINER RPC)로 단일화한다.
--   클라이언트·일반 authenticated 는 조회만. 직접 INSERT/UPDATE/DELETE 0.
--
-- 패턴 (012_payments_hardening.sql §4.1 payments RLS 답습):
--   - enable + force row level security.
--   - 쓰기 정책 미선언 = 전면 차단. service_role 만 RPC 경유로 접근.
--   - SELECT 만 선언: 본인 행 + admin 전체(어드민 내역 조회 U7·어드민).
--
-- 주의:
--   force 는 테이블 소유자(보통 postgres)에게도 RLS 를 강제하나, service_role 은
--   SECURITY DEFINER RPC 안에서 RLS 를 우회한다(payments 와 동일 구조).
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.point_ledger enable row level security;
alter table public.point_ledger force row level security;

-- ── SELECT: 본인 행 ────────────────────────────────────────────────────────
-- 마이페이지 포인트 내역(U7)·주문별 포인트(U8)는 본인 ledger 조회.
create policy "point_ledger_select_own"
  on public.point_ledger for select
  to authenticated
  using (user_id = (select auth.uid()));

comment on policy "point_ledger_select_own" on public.point_ledger is
  '본인 포인트 내역만 조회. 마이페이지(U7)·주문내역(U8).';

-- ── SELECT: admin 전체 ─────────────────────────────────────────────────────
-- 어드민 회원별 내역·발행/사용 집계(어드민 owner-only UI 는 Phase 4 서버에서 추가 가드).
create policy "point_ledger_select_admin"
  on public.point_ledger for select
  to authenticated
  using (public.is_admin((select auth.uid())));

comment on policy "point_ledger_select_admin" on public.point_ledger is
  '어드민 전체 내역 조회. 회원별 원장·발행/사용 집계용.';

-- ── INSERT/UPDATE/DELETE: 정책 미선언 = 전면 차단 ──────────────────────────
-- 모든 쓰기는 094 의 SECURITY DEFINER RPC(service_role)만 수행한다(T4).
