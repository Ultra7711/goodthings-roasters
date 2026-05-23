/* ══════════════════════════════════════════════════════════════════════════
   lib/admin/analytics.ts — /admin/analytics 순수 헬퍼 (S130 Group I-2)

   역할:
   - 시안 empty.jsx 의 readiness 판정 (주문 50건 OR 운영 14일).
   - 기간 필터 (7d / 30d / 90d / all) → timestamp 범위 변환.
   - admin_sales_aggregate RPC 응답 → UI 형태 매핑.
   - searchParams 파싱·검증.

   설계:
   - server fetcher (analyticsServer.ts) 가 본 파일을 import.
   - lib/admin/dashboard.ts 의 formatKrw 재사용.
   ══════════════════════════════════════════════════════════════════════════ */

import { z } from 'zod';
import { formatKrw } from './dashboard';

/* ── 상수 ────────────────────────────────────────────────────────────── */

/** Readiness 임계값 (시안 carousel: 50건 OR 14일) */
const READY_THRESHOLD_ORDERS = 50;
const READY_THRESHOLD_DAYS = 14;

/** 기간 필터 옵션 */
export const ANALYTICS_PERIOD_OPTIONS = [
  { id: '7d',  label: '최근 7일' },
  { id: '30d', label: '최근 30일' },
  { id: '90d', label: '최근 90일' },
  { id: 'all', label: '전체 기간' },
] as const;

export type AnalyticsPeriodKey = (typeof ANALYTICS_PERIOD_OPTIONS)[number]['id'];

/* ── searchParams 파싱 ──────────────────────────────────────────────── */

const SearchParamsSchema = z.object({
  period: z.enum(['7d', '30d', '90d', 'all']).default('30d'),
});

export type AnalyticsSearchParams = z.infer<typeof SearchParamsSchema>;

export function parseAnalyticsSearchParams(
  raw: Record<string, string | string[] | undefined>,
): AnalyticsSearchParams {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') flat[k] = v;
    else if (Array.isArray(v) && v.length > 0) flat[k] = v[0];
  }
  const parsed = SearchParamsSchema.safeParse(flat);
  if (parsed.success) return parsed.data;
  return SearchParamsSchema.parse({});
}

/* ── 기간 → timestamp 범위 ──────────────────────────────────────────── */

export type PeriodRange = {
  startIso: string;
  endIso: string;
};

/**
 * 기간 필터 → ISO timestamp 범위.
 * - 7d/30d/90d: 현재로부터 N일 전 ~ 현재.
 * - all: epoch (1970) ~ 현재 (RPC 가 모든 주문 포함).
 *
 * 종료점은 항상 now. 시작점은 inclusive, 종료점은 exclusive (RPC `created_at < end`).
 */
export function periodToRange(period: AnalyticsPeriodKey, now: Date = new Date()): PeriodRange {
  const endIso = now.toISOString();
  if (period === 'all') {
    return { startIso: new Date(0).toISOString(), endIso };
  }
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { startIso: start.toISOString(), endIso };
}

/* ── Readiness 판정 ─────────────────────────────────────────────────── */

export type Readiness = {
  ready: boolean;
  ordersCur: number;
  ordersMax: number;
  daysCur: number;
  daysMax: number;
};

/**
 * Readiness 판정 (50건 OR 14일).
 * - first_order_at IS NULL (주문 0건) → daysCur=0
 * - 두 임계값 중 하나라도 충족하면 ready=true.
 */
function evaluateReadiness(
  totalOrders: number,
  firstOrderAtIso: string | null,
  now: Date = new Date(),
): Readiness {
  const daysCur = firstOrderAtIso
    ? Math.floor((now.getTime() - new Date(firstOrderAtIso).getTime()) / (24 * 60 * 60 * 1000))
    : 0;
  const ready = totalOrders >= READY_THRESHOLD_ORDERS || daysCur >= READY_THRESHOLD_DAYS;
  return {
    ready,
    ordersCur: Math.min(totalOrders, READY_THRESHOLD_ORDERS),
    ordersMax: READY_THRESHOLD_ORDERS,
    daysCur: Math.min(daysCur, READY_THRESHOLD_DAYS),
    daysMax: READY_THRESHOLD_DAYS,
  };
}

/* ── RPC 응답 타입 ──────────────────────────────────────────────────── */

export type SalesProductRpc = {
  product_slug: string;
  product_name: string;
  product_volume: string | null;
  quantity: number;
  revenue: number;
  order_count: number;
};

export type SalesAggregateRpc = {
  total_orders: number;
  first_order_at: string | null;
  period_orders: number;
  period_revenue: number;
  avg_order_value: number;
  repurchase_rate: number;
  products: SalesProductRpc[];
};

/* ── 표시 형태 ──────────────────────────────────────────────────────── */

export type SalesStatCard = {
  label: string;
  value: string;
};

export type SalesProductRow = {
  productSlug: string;
  label: string;
  quantity: number;
  quantityLabel: string;
  revenue: number;
  revenueLabel: string;
  orderCount: number;
};

export type AnalyticsView = {
  period: AnalyticsPeriodKey;
  readiness: Readiness;
  stats: SalesStatCard[];
  products: SalesProductRow[];
};

/* ── 매핑 ───────────────────────────────────────────────────────────── */

const FALLBACK_RPC: SalesAggregateRpc = {
  total_orders: 0,
  first_order_at: null,
  period_orders: 0,
  period_revenue: 0,
  avg_order_value: 0,
  repurchase_rate: 0,
  products: [],
};

export function emptyAnalyticsView(period: AnalyticsPeriodKey = '30d'): AnalyticsView {
  return mapAnalytics(FALLBACK_RPC, period);
}

/**
 * RPC 응답 → 시안 4 stat cards + 상품 테이블 형태.
 * Readiness 미충족 시에도 period 집계는 함께 반환 (UI 분기는 readiness.ready).
 */
export function mapAnalytics(rpc: SalesAggregateRpc, period: AnalyticsPeriodKey): AnalyticsView {
  const readiness = evaluateReadiness(rpc.total_orders, rpc.first_order_at);

  const stats: SalesStatCard[] = [
    { label: '총 매출',    value: formatKrw(rpc.period_revenue) },
    { label: '주문 건수',  value: `${rpc.period_orders.toLocaleString('ko-KR')}건` },
    { label: '평균 객단가', value: formatKrw(rpc.avg_order_value) },
    { label: '재구매율',    value: `${rpc.repurchase_rate}%` },
  ];

  const products: SalesProductRow[] = rpc.products.map((p) => ({
    productSlug: p.product_slug,
    label: p.product_volume ? `${p.product_name} · ${p.product_volume}` : p.product_name,
    quantity: p.quantity,
    quantityLabel: `${p.quantity.toLocaleString('ko-KR')}개`,
    revenue: p.revenue,
    revenueLabel: formatKrw(p.revenue),
    orderCount: p.order_count,
  }));

  return { period, readiness, stats, products };
}
