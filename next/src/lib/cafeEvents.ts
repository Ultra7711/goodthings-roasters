/* ══════════════════════════════════════════════════════════════════════════
   lib/cafeEvents.ts — V2 §2.5 카페 메뉴 chapter 이벤트 row 헬퍼 (S149 PR-1a)

   역할:
   - 5-type Zod schema (campaign · collab · seasonal · new_item · oneplus)
   - 우선순위 + 활성 이벤트 선택 (selectActiveEvent)
   - DB row ↔ 코드 객체 변환 (parseCafeEventRow)

   설계:
   - client-safe — 어드민 폼 + B2C SSR 양쪽에서 import.
   - DB는 5-type enum + nullable 분기 컬럼. 코드 schema 도 동일한 모양.
   - 자문 §3.2 max-length 권고 (h4 22 / desc 80) 는 schema 에 박아 검증.
   - 자문 §5.3 우선순위 (campaign > collab > seasonal > new_item > oneplus)
     → CAFE_EVENT_TYPE_PRIORITY 배열로 명시.

   참조:
   - 035_cafe_events.sql (테이블 + seed)
   - memory/project_design_audit_v2.md §2.5 / advisory-E §3
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

  /** "Now On · ~5/31" — 11 caps · gold (자문 §3.2) */
  eyebrow: z.string().trim().max(40).default(''),
  /** max 22자 권고 (자문 §3.2 · 모바일 wrap 깨짐 방지) */
  h4: z.string().trim().max(40).default(''),
  /** 요일/매장/가격 등 mono 메타 (max 80자 — 운영 여유) */
  meta: z.string().trim().max(80).default(''),
  /** 본문 1~2줄 (max 80자 권고 — 자문 §3.2) */
  description: z.string().trim().max(160).default(''),

  image_path: z.string().trim().max(500).default(''),
  image_alt: z.string().trim().max(120).default(''),

  /** ISO date "YYYY-MM-DD" 또는 "" (자문 §5.3 active 판정 기준) */
  start_date: dateOrEmpty.default(''),
  end_date: dateOrEmpty.default(''),

  /** type 분기 필드 — 모두 optional */
  recurring: z.string().trim().max(40).nullable().default(null),
  linked_menu_slug: z.string().trim().max(80).nullable().default(null),
  season_label: z.string().trim().max(40).nullable().default(null),
  partner_name: z.string().trim().max(80).nullable().default(null),

  /** null = CTA 없음 */
  cta_target: z.string().trim().max(200).nullable().default(null),

  sort_order: z.number().int().default(0),
});

export type CafeEvent = z.infer<typeof CafeEventSchema>;

/* ── 3. DB row 변환 ─────────────────────────────────────────────────────── */

/**
 * Supabase row (snake_case + null/string 혼합) → CafeEvent.
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
 *
 * @returns 활성 이벤트 1개 또는 null.
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
 * @returns Coming 이벤트 1개 또는 null.
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

/* ── 5. eyebrow grammar (자문 §3.4) ──────────────────────────────────────── */

/**
 * eyebrow 자동 합성 (어드민 옵션). 어드민에서 manual 입력 시 그대로 사용.
 *
 * 자문 §3.4 grammar:
 *   - oneplus  : "Now On · 매주 화" (recurring 활용)
 *   - new_item : "Now On · ~MM/DD"
 *   - seasonal : "{Season} · ~MM/DD" — season_label 활용
 *   - collab   : "Coming · MM/DD~" (start_date 기준)
 *   - campaign : "Now On · ~MM/DD" (기본)
 */
export function composeEventEyebrow(event: Pick<CafeEvent,
  'type' | 'start_date' | 'end_date' | 'recurring' | 'season_label'>): string {
  const formatMd = (iso: string): string => {
    const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return '';
    return `${parseInt(m[1]!, 10)}/${parseInt(m[2]!, 10)}`;
  };

  const endMd = event.end_date ? formatMd(event.end_date) : '';
  const startMd = event.start_date ? formatMd(event.start_date) : '';

  switch (event.type) {
    case 'oneplus':
      if (event.recurring) return `Now On · ${event.recurring}`;
      return endMd ? `Now On · ~${endMd}` : 'Now On';
    case 'new_item':
      return endMd ? `Now On · ~${endMd}` : 'Now On';
    case 'seasonal':
      if (event.season_label) {
        return endMd
          ? `${event.season_label} · ~${endMd}`
          : event.season_label;
      }
      return endMd ? `Now On · ~${endMd}` : 'Now On';
    case 'collab':
      return startMd ? `Coming · ${startMd}~` : 'Coming';
    case 'campaign':
    default:
      return endMd ? `Now On · ~${endMd}` : 'Now On';
  }
}

/* ── 6. 날짜 유틸 (Asia/Seoul 기준) ──────────────────────────────────────── */

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
