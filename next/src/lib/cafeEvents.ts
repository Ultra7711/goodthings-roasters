/* ══════════════════════════════════════════════════════════════════════════
   lib/cafeEvents.ts — 카페 메뉴 chapter 이벤트 row 헬퍼 (S234 후속 overlay 재설계)

   역할:
   - 5-type Zod schema (campaign · collab · seasonal · new_item · oneplus)
   - 우선순위 + 활성 이벤트 선택 (selectActiveEvent · selectComingEvent)
   - DB row ↔ 코드 객체 변환 (parseCafeEventRow)

   모델 (060 마이그 — iframe HTML 진화):
   - 운영자가 제작한 단일 .html 파일을 Supabase Storage 에 업로드.
   - EventBanner 가 <iframe sandbox> 로 임베드 — 이미지/CSS/SVG/폰트 모두
     HTML 내부에서 처리.
   - brk 별 aspect-ratio 3 컬럼으로 iframe 컨테이너 사이즈 결정.
   - type 분류 + 우선순위 (자문 §5.3) 는 유지.

   설계:
   - client-safe — 어드민 폼 + B2C SSR 양쪽에서 import.

   참조:
   - 035_cafe_events.sql (최초 모델)
   - 059_cafe_events_overlay_redesign.sql (이미지+CSS 모델)
   - 060_cafe_events_iframe_html.sql (현 모델)
   ══════════════════════════════════════════════════════════════════════════ */

import { z } from 'zod';

/* ── 1. type enum + 우선순위 ────────────────────────────────────────────── */

export const CAFE_EVENT_TYPES = [
  'campaign',
  'collab',
  'seasonal',
  'new_item',
  'oneplus',
] as const;

export const CafeEventTypeSchema = z.enum(CAFE_EVENT_TYPES);
export type CafeEventType = z.infer<typeof CafeEventTypeSchema>;

/**
 * 자문 §5.3 + S149 결정 — 복수 active 시 type 우선순위.
 * 작은 인덱스가 우선 (campaign 가장 높음).
 */
export const CAFE_EVENT_TYPE_PRIORITY: Record<CafeEventType, number> = {
  campaign: 0,
  collab: 1,
  seasonal: 2,
  new_item: 3,
  oneplus: 4,
};

/** 어드민 폼 select 라벨 — 운영자 친화 한글 (S234 DEC-4 답습). */
export const CAFE_EVENT_TYPE_LABELS: Record<CafeEventType, string> = {
  campaign: '캠페인',
  collab: '콜라보',
  seasonal: '시즌 한정',
  new_item: '신메뉴',
  oneplus: '1+1',
};

/* ── 2. CafeEvent schema ────────────────────────────────────────────────── */

const dateOrEmpty = z
  .string()
  .trim()
  .transform((v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ''))
  .pipe(z.string());

export const CafeEventSchema = z.object({
  id: z.string().uuid(),
  type: CafeEventTypeSchema,
  enabled: z.boolean().default(true),

  /** 운영자 .html 파일 Storage URL — 필수 (빈 값이면 EventBanner 렌더 skip).
      <iframe sandbox="allow-same-origin"> 로 임베드. */
  custom_html_path: z.string().trim().max(500).default(''),
  /** iframe 컨테이너 aspect-ratio (>=1024px). CSS aspect-ratio 형식. */
  aspect_desktop: z.string().trim().max(40).default('1320/480'),
  /** iframe 컨테이너 aspect-ratio (768~1023px). */
  aspect_tablet: z.string().trim().max(40).default('1024/400'),
  /** iframe 컨테이너 aspect-ratio (<768px). */
  aspect_mobile: z.string().trim().max(40).default('390/640'),
  /** iframe title 속성 + 접근성 description */
  image_alt: z.string().trim().max(120).default(''),

  /** ISO date "YYYY-MM-DD" 또는 "" (자문 §5.3 active 판정 기준) */
  start_date: dateOrEmpty.default(''),
  end_date: dateOrEmpty.default(''),

  sort_order: z.number().int().default(0),
});

export type CafeEvent = z.infer<typeof CafeEventSchema>;

/* ── 3. DB row 변환 ─────────────────────────────────────────────────────── */

/**
 * Supabase row (snake_case) → CafeEvent.
 * date 컬럼은 PostgREST 가 ISO "YYYY-MM-DD" 문자열로 내려줌.
 * 실패 시 null 반환 (호출부가 fallback 처리).
 */
export function parseCafeEventRow(raw: unknown): CafeEvent | null {
  if (raw == null || typeof raw !== 'object') return null;
  const result = CafeEventSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/* ── 4. 활성 이벤트 선택 (자문 §5.3) ────────────────────────────────────── */

export interface SelectActiveEventOptions {
  /** ISO date "YYYY-MM-DD" — 기본은 today (Asia/Seoul) */
  today?: string;
}

/**
 * 자문 §5.3 우선순위:
 *   1. enabled=true
 *   2. start_date ≤ today ≤ end_date (빈 값은 "범위 무관" 처리)
 *   3. 동시 active 시 — start_date 최신
 *   4. 동률 — type 우선순위 (campaign > collab > seasonal > new_item > oneplus)
 *   5. 동률 — sort_order (작은 값 우선)
 */
export function selectActiveEvent(
  events: ReadonlyArray<CafeEvent>,
  options: SelectActiveEventOptions = {},
): CafeEvent | null {
  const today = options.today ?? todayIsoSeoul();

  const active = events.filter((ev) => {
    if (!ev.enabled) return false;
    if (ev.start_date && ev.start_date > today) return false;
    if (ev.end_date && ev.end_date < today) return false;
    return true;
  });

  if (active.length === 0) return null;
  if (active.length === 1) return active[0]!;

  return [...active].sort((a, b) => {
    if (a.start_date !== b.start_date) {
      return a.start_date > b.start_date ? -1 : 1;
    }
    const pa = CAFE_EVENT_TYPE_PRIORITY[a.type];
    const pb = CAFE_EVENT_TYPE_PRIORITY[b.type];
    if (pa !== pb) return pa - pb;
    return a.sort_order - b.sort_order;
  })[0]!;
}

/**
 * 자문 §5.3 — active 0 + 7일 내 시작 이벤트 있으면 Coming 이벤트.
 */
export function selectComingEvent(
  events: ReadonlyArray<CafeEvent>,
  options: SelectActiveEventOptions = {},
): CafeEvent | null {
  const today = options.today ?? todayIsoSeoul();
  const sevenDaysFromNow = addDaysIso(today, 7);

  const upcoming = events.filter((ev) => {
    if (!ev.enabled) return false;
    if (!ev.start_date) return false;
    return ev.start_date > today && ev.start_date <= sevenDaysFromNow;
  });

  if (upcoming.length === 0) return null;
  if (upcoming.length === 1) return upcoming[0]!;

  return [...upcoming].sort((a, b) => {
    if (a.start_date !== b.start_date) {
      return a.start_date < b.start_date ? -1 : 1;
    }
    const pa = CAFE_EVENT_TYPE_PRIORITY[a.type];
    const pb = CAFE_EVENT_TYPE_PRIORITY[b.type];
    if (pa !== pb) return pa - pb;
    return a.sort_order - b.sort_order;
  })[0]!;
}

/* ── 5. 날짜 유틸 (Asia/Seoul 기준) ──────────────────────────────────────── */

/** Asia/Seoul 기준 today (ISO "YYYY-MM-DD"). */
export function todayIsoSeoul(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date());
}

function addDaysIso(iso: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const date = new Date(Date.UTC(
    parseInt(m[1]!, 10),
    parseInt(m[2]!, 10) - 1,
    parseInt(m[3]!, 10),
  ));
  date.setUTCDate(date.getUTCDate() + days);
  const y = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}
