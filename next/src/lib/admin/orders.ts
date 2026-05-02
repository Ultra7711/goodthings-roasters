/* ══════════════════════════════════════════════════════════════════════════
   lib/admin/orders.ts — 어드민 주문 목록 순수 헬퍼 (S128 Group B)

   역할:
   - 시안 5탭 ↔ 실 status enum 매핑 (결정 1: A안).
   - 결제수단 / 기간 / 검색 / 페이지 searchParams 파싱·검증.
   - order_items 배열을 "상품A 200g · 상품B 200g × 2" 형태로 집계.
   - DB enum → 시안 라벨/뱃지 tone.
   - KST timestamp 포맷.

   설계:
   - 클라이언트(OrdersTableClient) + 서버(ordersServer) 양쪽이 import 하므로
     반드시 client-safe (next/headers · cookies 의존 금지).
   - Supabase 호출은 ordersServer.ts 의 fetchAdminOrders() 에 격리.
   - searchParams.q 는 ilike 우회 방지 위해 와일드카드 문자 strip.

   RLS:
   - 030_admin_orders_rls.sql 의 orders_select_admin / order_items_select_admin
     정책이 admin 에게 모든 행 SELECT 를 허용 → service_role 우회 불필요.
   ══════════════════════════════════════════════════════════════════════════ */

import { z } from 'zod';

/* ── 상수 ────────────────────────────────────────────────────────────── */

/** 페이지당 행 수 (시안 디자인 = 10) */
export const PAGE_SIZE = 10;

/** 탭 정의 (시안 5개, 결정 1 A안) */
export const STATUS_TABS = [
  { id: 'all', label: '전체' },
  { id: 'new', label: '신규' },
  { id: 'shipping', label: '배송중' },
  { id: 'delivered', label: '완료' },
  { id: 'cancelled', label: '취소' },
] as const;

export type StatusTabKey = (typeof STATUS_TABS)[number]['id'];

/** 기간 필터 (4 옵션) */
export const PERIOD_OPTIONS = [
  { id: 'all', label: '전체 기간' },
  { id: '7d', label: '최근 7일' },
  { id: '30d', label: '최근 30일' },
  { id: '90d', label: '최근 90일' },
] as const;

export type PeriodKey = (typeof PERIOD_OPTIONS)[number]['id'];

/** 결제수단 필터 (전체 + 2 enum) */
export const PAYMENT_OPTIONS = [
  { id: 'all', label: '전체 결제' },
  { id: 'card', label: '카드' },
  { id: 'transfer', label: '계좌이체' },
] as const;

export type PaymentFilterKey = (typeof PAYMENT_OPTIONS)[number]['id'];

/** 시안 status badge tone */
export type StatusTone = 'primary' | 'warning' | 'info' | 'success' | 'neutral';

/* ── DB enum 매핑 ─────────────────────────────────────────────────────── */

/** orders.status enum (003_orders.sql) — UI 노출 라벨 + 시안 tone */
const STATUS_DESCRIPTORS = {
  pending:            { tabKey: 'all',       label: '결제대기', tone: 'neutral'  },
  paid:               { tabKey: 'new',       label: '신규',     tone: 'primary'  },
  shipping:           { tabKey: 'shipping',  label: '배송중',   tone: 'info'     },
  delivered:          { tabKey: 'delivered', label: '완료',     tone: 'success'  },
  cancelled:          { tabKey: 'cancelled', label: '취소',     tone: 'neutral'  },
  refund_requested:   { tabKey: 'cancelled', label: '환불 신청', tone: 'neutral' },
  refund_processing:  { tabKey: 'cancelled', label: '환불 처리', tone: 'neutral' },
  refunded:           { tabKey: 'cancelled', label: '환불 완료', tone: 'neutral' },
} as const satisfies Record<DbOrderStatus, { tabKey: StatusTabKey | 'all'; label: string; tone: StatusTone }>;

export type DbOrderStatus =
  | 'pending'
  | 'paid'
  | 'shipping'
  | 'delivered'
  | 'cancelled'
  | 'refund_requested'
  | 'refund_processing'
  | 'refunded';

/** "취소" 탭 묶음 — 030 마이그레이션 RPC 와 동일 */
export const CANCELLED_GROUP: DbOrderStatus[] = [
  'cancelled',
  'refund_requested',
  'refund_processing',
  'refunded',
];

/** DB status → 시안 라벨 + tone */
export function describeStatus(status: DbOrderStatus): { label: string; tone: StatusTone } {
  const d = STATUS_DESCRIPTORS[status];
  return { label: d.label, tone: d.tone };
}

/** payment_method enum → 시안 라벨 */
export function describePayment(method: 'card' | 'transfer'): string {
  return method === 'card' ? '카드' : '계좌이체';
}

/* ── 배송 메시지 프리셋 매핑 ─────────────────────────────────────────── */

/**
 * CheckoutPage.DELIVERY_OPTIONS 와 정합 — DB shipping_message_code 값.
 * 'direct' 는 코드가 아니라 "직접 입력" 분기. 사용자 직접 입력은 message_custom 에 저장.
 */
const SHIPPING_MESSAGE_LABELS: Record<string, string> = {
  경비실:    '부재 시 경비실에 맡겨 주세요.',
  문앞:      '부재 시 문 앞에 놓아 주세요.',
  택배함:    '부재 시 택배함에 넣어 주세요.',
  직접수령:  '직접 받겠습니다. 배송 전 연락 부탁드립니다.',
  파손주의:  '파손 위험 상품입니다. 취급에 주의해 주세요.',
};

/**
 * shipping_message_code / shipping_message_custom → 표시 텍스트.
 * - custom 우선 (사용자 직접 입력)
 * - 없으면 code → 라벨 lookup
 * - 둘 다 없으면 null
 */
export function describeShippingMessage(
  code: string | null,
  custom: string | null,
): { text: string; presetCode: string | null } | null {
  if (custom && custom.length > 0) {
    return { text: custom, presetCode: null };
  }
  if (code && code.length > 0) {
    const text = SHIPPING_MESSAGE_LABELS[code] ?? code;
    return { text, presetCode: code };
  }
  return null;
}

/* ── 아이템 집계 ──────────────────────────────────────────────────────── */

type OrderItemRow = {
  product_name: string;
  product_volume: string | null;
  quantity: number;
};

/**
 * order_items 배열을 한 줄 라벨로 집계.
 * 예) [{name:'에티오피아', volume:'200g', qty:1}, {name:'콜롬비아', volume:'200g', qty:2}]
 *  → "에티오피아 200g · 콜롬비아 200g × 2"
 *
 * - quantity 1 은 "× N" 생략
 * - volume 없으면 상품명만
 * - 빈 배열은 빈 문자열
 */
export function summarizeItems(items: OrderItemRow[]): string {
  return items
    .map((it) => {
      const name = it.product_volume ? `${it.product_name} ${it.product_volume}` : it.product_name;
      return it.quantity > 1 ? `${name} × ${it.quantity}` : name;
    })
    .join(' · ');
}

/* ── 검색 입력 sanitize ──────────────────────────────────────────────── */

/**
 * q 를 PostgREST .or() ilike 절에 안전히 삽입하기 위한 sanitize.
 * - 와일드카드 (% _), 메타문자 (, *), 따옴표·백슬래시 제거.
 * - 공백 양끝 trim, 60자 cap.
 *
 * 검색은 부분일치 (`%${q}%`) 로 사용되므로 빈 문자열은 호출처에서 가드.
 */
export function sanitizeSearchQuery(raw: string): string {
  return raw
    .trim()
    .replace(/[%_,()*"\\]/g, '')
    .slice(0, 60);
}

/* ── searchParams 파싱 ──────────────────────────────────────────────── */

const SearchParamsSchema = z.object({
  status: z.enum(['all', 'new', 'shipping', 'delivered', 'cancelled']).default('all'),
  period: z.enum(['all', '7d', '30d', '90d']).default('all'),
  payment: z.enum(['all', 'card', 'transfer']).default('all'),
  q: z.string().default(''),
  page: z.coerce.number().int().min(1).max(9999).default(1),
});

export type AdminOrdersSearchParams = z.infer<typeof SearchParamsSchema>;

/**
 * URL searchParams (object) → 정규화된 필터.
 * 잘못된 값은 기본값(전체·1페이지)로 fallback (UI 깨짐 방지).
 */
export function parseSearchParams(
  raw: Record<string, string | string[] | undefined>,
): AdminOrdersSearchParams {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') flat[k] = v;
    else if (Array.isArray(v) && v.length > 0) flat[k] = v[0];
  }
  const parsed = SearchParamsSchema.safeParse(flat);
  if (parsed.success) return parsed.data;
  /* 부분적으로만 깨졌어도 전부 기본값으로. UX 우선. */
  return SearchParamsSchema.parse({});
}

/** 기간 → ISO timestamp (gte 비교용). 'all' 이면 null. */
export function periodToSinceIso(period: PeriodKey, now: Date = new Date()): string | null {
  if (period === 'all') return null;
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return since.toISOString();
}

/* ── 표시 형태 (서버 → 클라 전달) ────────────────────────────────────── */

/** 시안 테이블 1행 표시용 형태 */
export type ListedOrder = {
  id: string;                  /* uuid (선택 state · key 용) */
  orderNumber: string;         /* GT-YYYYMMDD-NNNNN */
  createdAtIso: string;        /* DB 원본 timestamptz */
  customerName: string;        /* shipping_name */
  contactEmail: string;
  itemsLabel: string;          /* summarizeItems 결과 */
  totalAmount: number;
  paymentLabel: string;        /* describePayment */
  status: DbOrderStatus;       /* 원본 enum (badge 매핑은 클라에서) */
};

/* ── 표시 포맷 헬퍼 ──────────────────────────────────────────────────── */

/** 내부: ISO → KST 분해 (year/month/day/weekday/hours/minutes/seconds) */
function toKstParts(iso: string): {
  yyyy: number;
  mm: number;
  dd: number;
  weekday: string; /* '월'·'화'... */
  hh: number;
  mi: number;
  ss: number;
} {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
  return {
    yyyy: kst.getUTCFullYear(),
    mm: kst.getUTCMonth() + 1,
    dd: kst.getUTCDate(),
    weekday: WEEKDAYS[kst.getUTCDay()],
    hh: kst.getUTCHours(),
    mi: kst.getUTCMinutes(),
    ss: kst.getUTCSeconds(),
  };
}

/** ISO timestamp → KST "YYYY.MM.DD HH:mm" (목록 포맷) */
export function formatKstDateTime(iso: string): string {
  const p = toKstParts(iso);
  return `${p.yyyy}.${pad2(p.mm)}.${pad2(p.dd)} ${pad2(p.hh)}:${pad2(p.mi)}`;
}

/** ISO timestamp → KST "YYYY.MM.DD HH:mm:ss" (결제 시각 포맷) */
export function formatKstDateTimeWithSeconds(iso: string): string {
  const p = toKstParts(iso);
  return `${p.yyyy}.${pad2(p.mm)}.${pad2(p.dd)} ${pad2(p.hh)}:${pad2(p.mi)}:${pad2(p.ss)}`;
}

/** ISO timestamp → KST "YYYY년 M월 D일 (요일) HH:mm" (상세 헤더 포맷) */
export function formatKstFullDate(iso: string): string {
  const p = toKstParts(iso);
  return `${p.yyyy}년 ${p.mm}월 ${p.dd}일 (${p.weekday}) ${pad2(p.hh)}:${pad2(p.mi)}`;
}

/** profiles.created_at → "YYYY년 M월" (가입일 표기) */
export function formatJoinedAt(iso: string): string {
  const p = toKstParts(iso);
  return `${p.yyyy}년 ${p.mm}월`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
