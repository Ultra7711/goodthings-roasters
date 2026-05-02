-- ═══════════════════════════════════════════════════════════════════════════
-- 030_admin_orders_rls.sql — 어드민 주문 조회 RLS + 탭 카운트 RPC (S128 Group B)
--
-- 목적:
--   - /admin/orders UI 가 모든 주문을 조회할 수 있도록 RLS 정책 추가.
--   - 어드민 목록 화면의 상태별 탭 카운트를 1 round-trip 으로 가져오는 RPC.
--
-- 정책:
--   - orders / order_items SELECT : authenticated 중 is_admin(uid) = true 만 전체 행 접근.
--   - 020 의 profiles_select_admin 패턴 재사용 (defense in depth).
--
-- 비RPC 대안 검토:
--   - 5개 status 별 head:true count 쿼리 병렬도 가능하지만 RPC 가 1 round-trip 이며
--     status 매핑(취소+환불 4종 묶음) 을 SQL 한 곳에 고정할 수 있어 유지보수 우위.
--
-- 참조:
--   - 003_orders.sql                 (orders 스키마)
--   - 004_order_items.sql            (order_items 스키마)
--   - 007_rls_policies.sql           (orders_select_own 등 본인 정책)
--   - 020_profiles_role_rbac.sql     (is_admin · profiles_select_admin 패턴)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. orders SELECT (admin) ─────────────────────────────────────────────
-- 본인 주문 조회 정책 (orders_select_own) 은 그대로 유지.
-- admin 은 추가로 모든 행 SELECT 가능.
create policy "orders_select_admin"
  on public.orders for select
  to authenticated
  using (public.is_admin((select auth.uid())));

comment on policy "orders_select_admin" on public.orders is
  '어드민(is_admin = true) 은 모든 주문 SELECT 가능. /admin/orders UI 운영용.';

-- ── 2. order_items SELECT (admin) ────────────────────────────────────────
create policy "order_items_select_admin"
  on public.order_items for select
  to authenticated
  using (public.is_admin((select auth.uid())));

comment on policy "order_items_select_admin" on public.order_items is
  '어드민 은 모든 주문 아이템 SELECT 가능. 주문 상세 화면 join 용.';

-- ── 3. admin_orders_status_counts() RPC ──────────────────────────────────
-- 5개 시안 탭(전체·신규·배송중·완료·취소) 카운트를 1 round-trip 으로 반환.
-- 결정 1 (A안) 매핑:
--   all       = 전체 (pending 포함)
--   pending   = 결제대기 (탭 미노출 — 전체 안에 포함, 향후 별도 탭 필요 시 활용)
--   new       = paid          (시안 "신규")
--   shipping  = shipping      (시안 "배송중")
--   delivered = delivered     (시안 "완료")
--   cancelled = cancelled · refund_requested · refund_processing · refunded (시안 "취소")
--
-- SECURITY DEFINER + admin guard:
--   RLS 정책이 admin 에게 SELECT 를 허용하지만, RPC 진입점에서 한 번 더 명시 검증.
--   비admin 호출 시 insufficient_privilege raise → 클라이언트가 우회 카운트 시도 차단.
create or replace function public.admin_orders_status_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;
  if not public.is_admin(v_actor) then
    raise exception 'admin role required' using errcode = 'insufficient_privilege';
  end if;

  select jsonb_build_object(
    'all',       count(*),
    'pending',   count(*) filter (where status = 'pending'),
    'new',       count(*) filter (where status = 'paid'),
    'shipping',  count(*) filter (where status = 'shipping'),
    'delivered', count(*) filter (where status = 'delivered'),
    'cancelled', count(*) filter (
      where status in (
        'cancelled',
        'refund_requested',
        'refund_processing',
        'refunded'
      )
    )
  )
  into v_result
  from public.orders;

  return v_result;
end;
$$;

revoke execute on function public.admin_orders_status_counts() from public, anon;
grant execute on function public.admin_orders_status_counts() to authenticated;

comment on function public.admin_orders_status_counts() is
  '어드민 목록 탭 카운트 (전체·신규=paid·배송중·완료·취소묶음). admin 가드 포함.';
