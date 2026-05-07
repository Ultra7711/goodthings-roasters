/* ══════════════════════════════════════════════════════════════════════════
   lib/admin/subscriptions.ts — 어드민 구독 목록·편집 순수 헬퍼 (S188)

   역할:
   - status 탭 정의 (전체 / active / paused / cancelled / expired) + tone 매핑
   - searchParams (status · q · page) Zod 파싱
   - 검색어 sanitize (PostgREST .or ilike 우회 방지)
   - 표시 형태 (ListedSubscription) 타입
   - cycle 라벨 (subscription_period enum → 한글)
   - next_delivery_at 표시 포맷 (KST YYYY.MM.DD)

   설계:
   - 클라이언트(SubscriptionsTableClient) + 서버(subscriptionsServer) 양쪽이
     import 하므로 client-safe (next/headers · cookies 의존 금지).
   - Supabase 호출은 subscriptionsServer.ts 의 fetchAdminSubscriptions() 에 격리.
   - orders.ts / users.ts 답습 — 동형 패턴.

   RLS:
   - 044 의 subscriptions_select_admin / update_admin 정책 의존.
   - service_role 우회 불필요.
   ══════════════════════════════════════════════════════════════════════════ */

import { z } from 'zod';
import type { DbSubscriptionPeriod } from '@/types/db';

/* ── 상수 ────────────────────────────────────────────────────────────── */

/** 페이지당 행 수 (orders / users 와 동일) */
export const PAGE_SIZE = 10;

/** subscription_status enum (005_subscriptions.sql) */
export type DbSubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'expired';

export type { DbSubscriptionPeriod };

/** status 탭 정의 */
export const STATUS_TABS = [
  { id: 'all', label: '전체' },
  { id: 'active', label: '진행중' },
  { id: 'paused', label: '일시정지' },
  { id: 'cancelled', label: '해지' },
  { id: 'expired', label: '만료' },
] as const;

export type StatusTabKey = (typeof STATUS_TABS)[number]['id'];

/** Badge tone — orders 의 StatusTone 부분집합 */
export type StatusTone = 'success' | 'warning' | 'neutral' | 'info';

/** DB status → 시안 라벨 + tone */
export function describeStatus(
  status: DbSubscriptionStatus,
): { label: string; tone: StatusTone } {
  switch (status) {
    case 'active':
      return { label: '진행중', tone: 'success' };
    case 'paused':
      return { label: '일시정지', tone: 'warning' };
    case 'cancelled':
      return { label: '해지', tone: 'neutral' };
    case 'expired':
      return { label: '만료', tone: 'neutral' };
  }
}

/** cycle enum → 한글 라벨 (enum 자체가 이미 한글) */
export function describeCycle(cycle: DbSubscriptionPeriod): string {
  return cycle;
}

/* ── 검색 입력 sanitize ──────────────────────────────────────────────── */

/**
 * q 를 PostgREST .or() ilike 절에 안전히 삽입하기 위한 sanitize.
 * users.sanitizeSearchQuery 와 동일 규칙.
 */
export function sanitizeSearchQuery(raw: string): string {
  return raw
    .trim()
    .replace(/[%_,()*"\\]/g, '')
    .slice(0, 60);
}

/* ── searchParams 파싱 ──────────────────────────────────────────────── */

const SearchParamsSchema = z.object({
  status: z.enum(['all', 'active', 'paused', 'cancelled', 'expired']).default('all'),
  q: z.string().default(''),
  page: z.coerce.number().int().min(1).max(9999).default(1),
});

export type AdminSubscriptionsSearchParams = z.infer<typeof SearchParamsSchema>;

/**
 * URL searchParams (object) → 정규화된 필터.
 * 잘못된 값은 기본값(전체·1페이지)로 fallback (UI 깨짐 방지).
 */
export function parseSearchParams(
  raw: Record<string, string | string[] | undefined>,
): AdminSubscriptionsSearchParams {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') flat[k] = v;
    else if (Array.isArray(v) && v.length > 0) flat[k] = v[0];
  }
  const parsed = SearchParamsSchema.safeParse(flat);
  if (parsed.success) return parsed.data;
  return SearchParamsSchema.parse({});
}

/* ── 표시 형태 (서버 → 클라 전달) ────────────────────────────────────── */

/** 시안 테이블 1행 표시용 */
export type ListedSubscription = {
  id: string;                       /* uuid */
  userId: string;                   /* uuid */
  userEmail: string;                /* JOIN profiles.email */
  userDisplayName: string | null;   /* JOIN profiles.display_name */
  userFullName: string | null;      /* JOIN profiles.full_name */
  productSlug: string;
  productName: string;
  productVolume: string | null;
  cycle: DbSubscriptionPeriod;
  status: DbSubscriptionStatus;
  nextDeliveryAtIso: string;        /* DB 원본 timestamptz */
  lastDeliveryAtIso: string | null;
  createdAtIso: string;
};

/* ── 표시 포맷 헬퍼 ──────────────────────────────────────────────────── */

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** 내부: ISO → KST 분해 */
function toKstParts(iso: string): { yyyy: number; mm: number; dd: number } {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return {
    yyyy: kst.getUTCFullYear(),
    mm: kst.getUTCMonth() + 1,
    dd: kst.getUTCDate(),
  };
}

/** ISO timestamp → KST "YYYY.MM.DD" (배송일 표시) */
export function formatDeliveryDate(iso: string): string {
  const p = toKstParts(iso);
  return `${p.yyyy}.${pad2(p.mm)}.${pad2(p.dd)}`;
}

/** Date → "YYYY-MM-DD" (input[type=date] value 용 · KST 기준) */
export function isoToDateInput(iso: string): string {
  const p = toKstParts(iso);
  return `${p.yyyy}-${pad2(p.mm)}-${pad2(p.dd)}`;
}

/** "YYYY-MM-DD" (input value · KST) → ISO timestamptz (해당 일자 KST 00:00) */
export function dateInputToIso(dateStr: string): string {
  /* 날짜 입력은 KST 기준으로 해석 → KST 00:00 = UTC 전날 15:00 */
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) throw new Error('invalid_date_format');
  const [, y, mo, d] = m;
  /* KST 00:00 → UTC -9h */
  const utc = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), 0, 0, 0));
  utc.setUTCHours(utc.getUTCHours() - 9);
  return utc.toISOString();
}

/** 이름 표시 우선순위 — display_name → full_name → email local-part. */
export function resolveUserName(u: {
  userEmail: string;
  userFullName: string | null;
  userDisplayName: string | null;
}): string {
  return (
    u.userDisplayName?.trim() ||
    u.userFullName?.trim() ||
    u.userEmail.split('@')[0] ||
    u.userEmail
  );
}
