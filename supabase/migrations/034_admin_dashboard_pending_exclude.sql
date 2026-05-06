-- ═══════════════════════════════════════════════════════════════════════════
-- 034_admin_dashboard_pending_exclude.sql — pending 주문 매출 정합성 hot fix (S171)
--
-- 문제:
--   /checkout 에서 "결제하기" 클릭 시 createOrder API 가 status='pending' 으로
--   orders row 생성 → 사용자가 Toss 위젯에서 "이전" 또는 닫기로 이탈하면
--   confirm 없이 form 단계 복귀 → pending row 가 DB 에 잔류.
--   033_admin_dashboard_analytics.sql 의 매출/카운트 영역 status 필터에
--   pending 이 포함되어 매출이 왜곡되는 크리티컬 버그.
--
-- 정책 (2026-05-06 사용자 결정):
--   - 매출 집계 = positive list `status in ('paid','shipping','delivered')`
--     (refund 흐름은 매출에서 차감)
--   - recent_orders = `status <> 'pending'` (운영 모니터링은 cancel/refund 표시 유지)
--   - pending_orders stat card = 제거. 이전 무통장입금/계좌이체 결제 시절의
--     잔재로, 토스 위젯 통합 후에는 의미가 사라짐.
--   - pending 잔류 정리는 PR-B (명시 cancel) + PR-C (TTL 안전망) 후속.
--
-- 참조:
--   - 033_admin_dashboard_analytics.sql (재정의 대상 RPC 2종)
--   - 003_orders.sql §status enum
--   - memory/project_pending_orders_hot_fix.md
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. admin_dashboard_overview() 재정의 ─────────────────────────────────
create or replace function public.admin_dashboard_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_today_kst date := (now() at time zone 'Asia/Seoul')::date;
  v_week_start_kst timestamptz :=
    (date_trunc('week', (now() at time zone 'Asia/Seoul'))) at time zone 'Asia/Seoul';
  v_stats jsonb;
  v_tasks jsonb;
  v_recent jsonb;
  v_bestsellers jsonb;
begin
  if v_actor is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;
  if not public.is_admin(v_actor) then
    raise exception 'admin role required' using errcode = 'insufficient_privilege';
  end if;

  -- ── stats (3 카드) ─────────────────────────────────────────────────
  -- pending_orders 카드 제거 (무통장입금/계좌이체 결제 잔재).
  -- today_orders / week_revenue 모두 positive list 적용.
  v_stats := jsonb_build_object(
    'today_orders',
      (select count(*) from public.orders
        where (created_at at time zone 'Asia/Seoul')::date = v_today_kst
          and status in ('paid', 'shipping', 'delivered')),
    'week_revenue',
      (select coalesce(sum(total_amount), 0) from public.orders
        where created_at >= v_week_start_kst
          and status in ('paid', 'shipping', 'delivered')),
    'active_subscriptions',
      (select count(*) from public.subscriptions where status = 'active')
  );

  -- ── tasks (4 카운트) ────────────────────────────────────────────────
  v_tasks := jsonb_build_object(
    'new_orders',       (select count(*) from public.orders where status = 'paid'),
    'roasting_pending', 0,
    'inventory_alert',  0,
    'shipping_ready',
      (select count(*) from public.orders
        where status = 'shipping' and tracking_number is null)
  );

  -- ── recent_orders (최신 5건, pending 제외) ─────────────────────────
  -- 운영 모니터링은 cancelled/refund_* 도 표시 유지.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',             id,
        'order_number',   order_number,
        'created_at',     created_at,
        'customer_name',  shipping_name,
        'contact_email',  contact_email,
        'total_amount',   total_amount,
        'status',         status::text
      )
      order by created_at desc
    ),
    '[]'::jsonb
  )
  into v_recent
  from (
    select id, order_number, created_at, shipping_name,
           contact_email, total_amount, status
    from public.orders
    where status <> 'pending'
    order by created_at desc
    limit 5
  ) sub;

  -- ── bestsellers (positive list 적용) ────────────────────────────────
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'product_slug',   product_slug,
        'product_name',   product_name,
        'product_volume', product_volume,
        'quantity',       total_qty
      )
      order by total_qty desc
    ),
    '[]'::jsonb
  )
  into v_bestsellers
  from (
    select
      oi.product_slug,
      oi.product_name,
      oi.product_volume,
      sum(oi.quantity) as total_qty
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.created_at >= v_week_start_kst
      and o.status in ('paid', 'shipping', 'delivered')
    group by oi.product_slug, oi.product_name, oi.product_volume
    order by total_qty desc
    limit 4
  ) sub;

  return jsonb_build_object(
    'stats',          v_stats,
    'tasks',          v_tasks,
    'recent_orders',  v_recent,
    'bestsellers',    v_bestsellers
  );
end;
$$;

revoke execute on function public.admin_dashboard_overview() from public, anon;
grant execute on function public.admin_dashboard_overview() to authenticated;

comment on function public.admin_dashboard_overview() is
  '/admin 대시보드 위젯 (stats 3카드 · tasks · recent_orders · bestsellers). 매출 정합성 positive list 적용 (S171).';

-- ── 2. admin_sales_aggregate(start, end) 재정의 ──────────────────────────
create or replace function public.admin_sales_aggregate(
  p_period_start timestamptz,
  p_period_end   timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_total_orders bigint;
  v_first_order_at timestamptz;
  v_period_orders bigint;
  v_period_revenue bigint;
  v_avg_order_value bigint;
  v_repurchase_rate numeric;
  v_products jsonb;
begin
  if v_actor is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;
  if not public.is_admin(v_actor) then
    raise exception 'admin role required' using errcode = 'insufficient_privilege';
  end if;

  if p_period_end <= p_period_start then
    raise exception 'period_end must be after period_start' using errcode = 'invalid_parameter_value';
  end if;

  -- readiness 판정 데이터 (운영 시작 시점 추적이라 전체 카운트 유지).
  select count(*), min(created_at)
  into v_total_orders, v_first_order_at
  from public.orders;

  -- 기간 내 주문 통계 (positive list)
  with period_orders as (
    select id, user_id, total_amount
    from public.orders
    where created_at >= p_period_start
      and created_at <  p_period_end
      and status in ('paid', 'shipping', 'delivered')
  )
  select
    count(*),
    coalesce(sum(total_amount), 0),
    case when count(*) > 0 then (sum(total_amount) / count(*))::bigint else 0 end
  into v_period_orders, v_period_revenue, v_avg_order_value
  from period_orders;

  -- 재구매율 (positive list, 회원 한정 — 비회원 user_id IS NULL 제외)
  with member_orders as (
    select user_id, count(*) as cnt
    from public.orders
    where created_at >= p_period_start
      and created_at <  p_period_end
      and status in ('paid', 'shipping', 'delivered')
      and user_id is not null
    group by user_id
  ), repurchase as (
    select
      count(*) filter (where cnt >= 2) as repeat_count,
      count(*) as total_count
    from member_orders
  )
  select
    case
      when total_count > 0 then round((repeat_count::numeric / total_count) * 100, 1)
      else 0
    end
  into v_repurchase_rate
  from repurchase;

  -- 상품별 집계 (positive list)
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'product_slug',   product_slug,
        'product_name',   product_name,
        'product_volume', product_volume,
        'quantity',       total_qty,
        'revenue',        total_revenue,
        'order_count',    order_count
      )
      order by total_revenue desc
    ),
    '[]'::jsonb
  )
  into v_products
  from (
    select
      oi.product_slug,
      oi.product_name,
      oi.product_volume,
      sum(oi.quantity)        as total_qty,
      sum(oi.line_total)      as total_revenue,
      count(distinct o.id)    as order_count
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.created_at >= p_period_start
      and o.created_at <  p_period_end
      and o.status in ('paid', 'shipping', 'delivered')
    group by oi.product_slug, oi.product_name, oi.product_volume
  ) sub;

  return jsonb_build_object(
    'total_orders',    v_total_orders,
    'first_order_at',  v_first_order_at,
    'period_orders',   v_period_orders,
    'period_revenue',  v_period_revenue,
    'avg_order_value', v_avg_order_value,
    'repurchase_rate', v_repurchase_rate,
    'products',        v_products
  );
end;
$$;

revoke execute on function public.admin_sales_aggregate(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_sales_aggregate(timestamptz, timestamptz) to authenticated;

comment on function public.admin_sales_aggregate(timestamptz, timestamptz) is
  '/admin/analytics 매출 통계 (readiness + 기간 집계 + 상품별). 매출 정합성 positive list 적용 (S171).';
