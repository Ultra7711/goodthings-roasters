-- ═══════════════════════════════════════════════════════════════════════════
-- 033_admin_dashboard_analytics.sql — 어드민 대시보드 + 매출 통계 RPC (S130 Group I)
--
-- 목적:
--   - /admin (대시보드) 의 시안 stat cards · tasks · recent orders · bestsellers
--     데이터를 1 round-trip 으로 가져오는 RPC.
--   - /admin/analytics (매출 통계) 의 readiness 판정 + 기간 집계 RPC.
--
-- 정책:
--   - 두 RPC 모두 SECURITY DEFINER + admin 가드 (RLS 정책에 더해 진입 단속).
--   - 030 의 admin_orders_status_counts 와 동일 패턴.
--
-- 시간대:
--   - 일·주 단위 집계는 Asia/Seoul 기준. KST 자정·월요일 정렬.
--
-- 참조:
--   - 003_orders.sql · 004_order_items.sql · 005_subscriptions.sql
--   - 020_profiles_role_rbac.sql (is_admin)
--   - 030_admin_orders_rls.sql (admin_orders_status_counts 패턴)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. admin_dashboard_overview() ────────────────────────────────────────
-- 시안 dashboard.jsx 의 5개 위젯 데이터를 한 번에 반환:
--   stats         : 4 카드 (오늘 주문 / 이번 주 매출 / 활성 정기배송 / 대기 주문)
--   tasks         : 4 task counts (도메인 미존재 항목은 0)
--   recent_orders : 최근 주문 5건
--   bestsellers   : 이번 주 베스트셀러 4종 (취소·환불 제외)
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

  -- ── stats (4 카드) ─────────────────────────────────────────────────
  v_stats := jsonb_build_object(
    'today_orders',
      (select count(*) from public.orders
        where (created_at at time zone 'Asia/Seoul')::date = v_today_kst),
    'week_revenue',
      (select coalesce(sum(total_amount), 0) from public.orders
        where created_at >= v_week_start_kst
          and status not in (
            'cancelled', 'refund_requested', 'refund_processing', 'refunded'
          )),
    'active_subscriptions',
      (select count(*) from public.subscriptions where status = 'active'),
    'pending_orders',
      (select count(*) from public.orders where status = 'paid')
  );

  -- ── tasks (4 카운트, 도메인 미존재는 0) ──────────────────────────────
  --   new_orders       : status='paid' (운영자 발송 처리 필요)
  --   roasting_pending : 도메인 부재 (Group E 후속) → 0
  --   inventory_alert  : 도메인 부재 (Group E 후속) → 0
  --   shipping_ready   : status='shipping' AND tracking_number IS NULL
  --                      (정상 흐름은 dispatch_order RPC 가 동시 입력하여 0,
  --                       이상 케이스 알림용)
  v_tasks := jsonb_build_object(
    'new_orders',       (select count(*) from public.orders where status = 'paid'),
    'roasting_pending', 0,
    'inventory_alert',  0,
    'shipping_ready',
      (select count(*) from public.orders
        where status = 'shipping' and tracking_number is null)
  );

  -- ── recent_orders (최신 5건) ─────────────────────────────────────────
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
    order by created_at desc
    limit 5
  ) sub;

  -- ── bestsellers (이번 주 상품별 quantity 합 LIMIT 4) ────────────────
  --   취소·환불 제외. product_slug + product_name + product_volume 별 그룹화.
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
      and o.status not in (
        'cancelled', 'refund_requested', 'refund_processing', 'refunded'
      )
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
  '/admin 대시보드 위젯 데이터 (stats · tasks · recent_orders · bestsellers). admin 가드 포함.';

-- ── 2. admin_sales_aggregate(start, end) ─────────────────────────────────
-- 시안 analytics empty.jsx 의 readiness 판정 + 기간 집계.
--   total_orders     : 전체 주문 수 (readiness 50건 비교)
--   first_order_at   : 최초 주문 시각 (readiness 14일 운영 비교)
--   period_orders    : 기간 내 주문 수
--   period_revenue   : 기간 내 매출 합계
--   avg_order_value  : 평균 객단가 (period_revenue / period_orders)
--   repurchase_rate  : 재구매율 % (회원 중 2회 이상 구매 비율, 1자리 소수)
--   products         : 상품별 집계 (quantity · revenue · order_count, revenue desc)
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

  -- readiness 판정 데이터
  select count(*), min(created_at)
  into v_total_orders, v_first_order_at
  from public.orders;

  -- 기간 내 주문 통계 (취소·환불 제외)
  with period_orders as (
    select id, user_id, total_amount
    from public.orders
    where created_at >= p_period_start
      and created_at <  p_period_end
      and status not in (
        'cancelled', 'refund_requested', 'refund_processing', 'refunded'
      )
  )
  select
    count(*),
    coalesce(sum(total_amount), 0),
    case when count(*) > 0 then (sum(total_amount) / count(*))::bigint else 0 end
  into v_period_orders, v_period_revenue, v_avg_order_value
  from period_orders;

  -- 재구매율 (회원 한정 — 비회원 user_id IS NULL 제외)
  with member_orders as (
    select user_id, count(*) as cnt
    from public.orders
    where created_at >= p_period_start
      and created_at <  p_period_end
      and status not in (
        'cancelled', 'refund_requested', 'refund_processing', 'refunded'
      )
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

  -- 상품별 집계 (revenue desc)
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
      and o.status not in (
        'cancelled', 'refund_requested', 'refund_processing', 'refunded'
      )
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
  '/admin/analytics 매출 통계 (readiness + 기간 집계 + 상품별). admin 가드 포함.';
