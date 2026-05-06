/* ══════════════════════════════════════════════════════════════════════════
   lib/admin/dashboard.ts — /admin 대시보드 순수 헬퍼 (S130 Group I-1)

   역할:
   - admin_dashboard_overview RPC 응답 → 시안 inline UI 가 사용하는 형태로 매핑.
   - tone 색상 매핑 / 금액·날짜 포맷 / placeholder fallback.

   설계:
   - server fetcher (dashboardServer.ts) 는 본 파일을 import → 클라이언트 번들과
     공유. server-only 의존 금지.
   - DB enum → 시안 라벨/뱃지 tone 매핑은 lib/admin/orders.ts 의 describeStatus
     를 그대로 재사용 (한 곳에서 관리).
   ══════════════════════════════════════════════════════════════════════════ */

import { describeStatus, formatKstDateTime, type DbOrderStatus, type StatusTone } from './orders';

/* ── RPC 응답 타입 ──────────────────────────────────────────────────── */

export type DashboardStatsRpc = {
  today_orders: number;
  week_revenue: number;
  active_subscriptions: number;
};

export type DashboardTasksRpc = {
  new_orders: number;
  roasting_pending: number;
  inventory_alert: number;
  shipping_ready: number;
};

export type RecentOrderRpc = {
  id: string;
  order_number: string;
  created_at: string;
  customer_name: string;
  contact_email: string;
  total_amount: number;
  status: DbOrderStatus;
};

export type BestsellerRpc = {
  product_slug: string;
  product_name: string;
  product_volume: string | null;
  quantity: number;
};

export type DashboardOverviewRpc = {
  stats: DashboardStatsRpc;
  tasks: DashboardTasksRpc;
  recent_orders: RecentOrderRpc[];
  bestsellers: BestsellerRpc[];
};

/* ── 표시 형태 (서버 → UI) ──────────────────────────────────────────── */

export type DashboardStatCard = {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
  warn?: boolean;
};

export type DashboardTask = {
  label: string;
  n: number;
  tone: 'primary' | 'warning' | 'danger' | 'info';
  pending?: boolean;
};

export type DashboardRecentOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  contactEmail: string;
  totalAmount: number;
  totalAmountLabel: string;
  createdAtLabel: string;
  status: DbOrderStatus;
  statusLabel: string;
  statusTone: StatusTone;
};

export type DashboardBestseller = {
  productSlug: string;
  label: string;        /* "에티오피아 200g" 형태 */
  quantity: number;
};

export type DashboardOverview = {
  stats: DashboardStatCard[];
  tasks: DashboardTask[];
  recentOrders: DashboardRecentOrder[];
  bestsellers: DashboardBestseller[];
};

/* ── 포맷 헬퍼 ──────────────────────────────────────────────────────── */

/** 정수 원 단위 → "1,234원" (대시보드 표시용) */
export function formatKrw(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

/** 매출 카드: 0 이면 "—", 양수면 "1,234,567원" */
function statRevenueText(amount: number): string {
  return amount > 0 ? formatKrw(amount) : '—';
}

/** 카운트 카드: 0 이면 "—", 양수면 "12건" */
function statCountText(count: number, unit = '건'): string {
  return count > 0 ? `${count}${unit}` : '—';
}

/* ── 매핑 ───────────────────────────────────────────────────────────── */

const FALLBACK_OVERVIEW: DashboardOverviewRpc = {
  stats: {
    today_orders: 0,
    week_revenue: 0,
    active_subscriptions: 0,
  },
  tasks: {
    new_orders: 0,
    roasting_pending: 0,
    inventory_alert: 0,
    shipping_ready: 0,
  },
  recent_orders: [],
  bestsellers: [],
};

/** RPC 응답이 부재·이상 형태일 때 안전 fallback */
export function emptyOverview(): DashboardOverview {
  return mapOverview(FALLBACK_OVERVIEW);
}

/**
 * RPC 응답 → UI 형태 매핑.
 * - 시안의 4 stat cards / 4 tasks / 5 recent orders / 4 bestsellers 슬롯에 1:1 대응.
 * - sub 라벨은 도메인 부재 항목과 정상 항목을 명확히 구분.
 */
export function mapOverview(rpc: DashboardOverviewRpc): DashboardOverview {
  const stats: DashboardStatCard[] = [
    {
      label: '오늘 주문',
      value: statCountText(rpc.stats.today_orders),
      sub: rpc.stats.today_orders > 0 ? '오늘 접수된 주문' : '오늘 접수된 주문이 없습니다',
      accent: true,
    },
    {
      label: '이번 주 매출',
      value: statRevenueText(rpc.stats.week_revenue),
      sub: '월요일 0시 (KST) 기준 누계',
    },
    {
      label: '활성 정기배송',
      value: statCountText(rpc.stats.active_subscriptions),
      sub: rpc.stats.active_subscriptions > 0 ? '운영 중인 구독' : '활성 구독 없음',
    },
  ];

  const tasks: DashboardTask[] = [
    {
      label: '신규 주문 처리',
      n: rpc.tasks.new_orders,
      tone: 'primary',
    },
    {
      label: '로스팅 일정 확정',
      n: rpc.tasks.roasting_pending,
      tone: 'warning',
      pending: true,
    },
    {
      label: '재고 알림',
      n: rpc.tasks.inventory_alert,
      tone: 'danger',
      pending: true,
    },
    {
      label: '발송 미입력',
      n: rpc.tasks.shipping_ready,
      tone: 'info',
    },
  ];

  const recentOrders: DashboardRecentOrder[] = rpc.recent_orders.map((r) => {
    const desc = describeStatus(r.status);
    return {
      id: r.id,
      orderNumber: r.order_number,
      customerName: r.customer_name,
      contactEmail: r.contact_email,
      totalAmount: r.total_amount,
      totalAmountLabel: formatKrw(r.total_amount),
      createdAtLabel: formatKstDateTime(r.created_at),
      status: r.status,
      statusLabel: desc.label,
      statusTone: desc.tone,
    };
  });

  const bestsellers: DashboardBestseller[] = rpc.bestsellers.map((b) => ({
    productSlug: b.product_slug,
    label: b.product_volume
      ? `${b.product_name} · ${b.product_volume}`
      : b.product_name,
    quantity: b.quantity,
  }));

  return { stats, tasks, recentOrders, bestsellers };
}

/* ── 베스트셀러 progress bar 비율 ────────────────────────────────────── */

/**
 * 베스트셀러 4종의 막대 길이를 1위 기준 정규화 (0~100).
 * 시안의 progress bar (`width: ${pct}%`) 계산에 사용.
 * 빈 배열·전부 0 이면 0% 반환.
 */
export function bestsellerPercents(items: DashboardBestseller[]): number[] {
  const max = items.reduce((m, it) => Math.max(m, it.quantity), 0);
  if (max <= 0) return items.map(() => 0);
  return items.map((it) => Math.round((it.quantity / max) * 100));
}
