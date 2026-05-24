/* ══════════════════════════════════════════════════════════════════════════
   lib/banners.ts — Y1 통합 배너 헬퍼 (S269)

   배경:
   - cafe_events (035 + 060 + 061 + 064 + 068) 와 site_settings.signature
     (062 + 063 + 068) 가 14 공통 필드 100% 동일.
   - 071 마이그로 banners 통합 테이블 + kind enum ('cafe_event' | 'signature')
     신설. 본 모듈이 그 단일 테이블의 read-side 헬퍼.

   역할:
   - discriminated union Zod schema (kind 분기)
   - DB row ↔ 코드 객체 변환 (parseBannerRow)
   - active 1 row 선택 헬퍼 (selectActiveBanner · kind 별 분기)
   - cafe_event 우선순위 / 시즌 라벨 (cafeEvents.ts 에서 흡수)
   - 날짜 유틸 (todayIsoSeoul · addDaysIso · dateOrEmpty)

   설계:
   - client-safe — 어드민 폼 + B2C SSR 양쪽에서 import.
   - server-only fetch / cache 는 lib/bannersServer.ts 분리.
   - 향후 cafeEvents.ts / siteSettings.signature 폐기 시 본 모듈이 owner.

   참조:
   - supabase/migrations/071_banners_unified.sql (테이블 + kind enum)
   - supabase/migrations/072_banners_data_migration.sql (data 이전)
   - lib/cafeEvents.ts (답습 source · S269 carry · 별 sprint 폐기 예정)
   ══════════════════════════════════════════════════════════════════════════ */

import { z } from 'zod';

/* ── 1. kind enum ────────────────────────────────────────────────────── */

export const BANNER_KINDS = ['cafe_event', 'signature'] as const;
export const BannerKindSchema = z.enum(BANNER_KINDS);
export type BannerKind = z.infer<typeof BannerKindSchema>;

/* ── 2. cafe_event type enum + 우선순위 (cafeEvents.ts 답습) ──────────── */

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

/* ── 3. 공통 필드 schema (BannerBaseShape) ────────────────────────────── */

/* DB date 컬럼은 NULL 또는 ISO "YYYY-MM-DD" 문자열. 둘 다 빈 문자열로 정규화. */
const dateOrEmpty = z
  .union([z.string(), z.null()])
  .transform((v) => {
    if (v == null) return '';
    const trimmed = v.trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : '';
  });

/**
 * 14 공통 필드 + 기간/정렬 — cafe_event / signature 모두 동일.
 * (cafeEvents.ts CafeEventSchema 의 공통 필드와 1:1 대응)
 */
const BannerBaseShape = {
  id: z.string().uuid(),
  enabled: z.boolean().default(true),

  /** 운영자 .html 파일 Storage URL — 빈 값이면 chapter 렌더 skip. */
  custom_html_path: z.string().trim().max(500).default(''),
  image_path_desktop: z.string().trim().max(500).default(''),
  image_path_tablet: z.string().trim().max(500).default(''),
  image_path_mobile: z.string().trim().max(500).default(''),

  /** LQIP base64 dataURL (068) — 운영자 HTML {{IMAGE_BLUR_*}} 치환. */
  image_blur_desktop: z.string().trim().max(5000).default(''),
  image_blur_tablet: z.string().trim().max(5000).default(''),
  image_blur_mobile: z.string().trim().max(5000).default(''),

  /** iframe 컨테이너 aspect-ratio (CSS "W/H") */
  aspect_desktop: z.string().trim().max(40).default('1320/600'),
  aspect_tablet: z.string().trim().max(40).default('1024/520'),
  aspect_mobile: z.string().trim().max(40).default('390/520'),

  image_alt: z.string().trim().max(120).default(''),

  /* SEO 메타 — iframe 외부 sr-only `<h2>/<p>/<a>` 출력. 빈 값 = 미출력. */
  headline_text: z.string().trim().max(80).default(''),
  subhead_text: z.string().trim().max(200).default(''),
  cta_text: z.string().trim().max(30).default(''),
  cta_href: z.string().trim().max(500).default(''),

  /* 기간 — 빈 값 = "범위 무관" (signature 무입력 시 영구 active 자연 동작) */
  start_date: dateOrEmpty.default(''),
  end_date: dateOrEmpty.default(''),
  sort_order: z.number().int().default(0),
} as const;

/* ── 4. discriminated union Banner schema ─────────────────────────────── */

/** cafe_event 분기 — type (5-enum) 필수. */
export const CafeEventBannerSchema = z.object({
  kind: z.literal('cafe_event'),
  type: CafeEventTypeSchema,
  ...BannerBaseShape,
});

/** signature 분기 — type 없음 (DB 에선 NULL · Zod 에선 무시). */
export const SignatureBannerSchema = z.object({
  kind: z.literal('signature'),
  ...BannerBaseShape,
});

/** discriminated union — kind 로 분기. */
export const BannerSchema = z.discriminatedUnion('kind', [
  CafeEventBannerSchema,
  SignatureBannerSchema,
]);

export type CafeEventBanner = z.infer<typeof CafeEventBannerSchema>;
export type SignatureBanner = z.infer<typeof SignatureBannerSchema>;
export type Banner = z.infer<typeof BannerSchema>;

/* ── 5. DB row 변환 ───────────────────────────────────────────────────── */

/**
 * Supabase row (snake_case) → Banner.
 * 실패 시 null 반환 (호출부가 fallback 처리).
 */
export function parseBannerRow(raw: unknown): Banner | null {
  if (raw == null || typeof raw !== 'object') return null;
  const result = BannerSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/* ── 6. active 1 row 선택 (kind 별 분기) ──────────────────────────────── */

export interface SelectActiveBannerOptions {
  /** ISO date "YYYY-MM-DD" — 기본은 today (Asia/Seoul) */
  today?: string;
}

/**
 * banners 배열에서 kind 매치 + active 1 row 선택.
 *
 * cafe_event 정렬 우선순위 (자문 §5.3):
 *   1. enabled=true
 *   2. start_date ≤ today ≤ end_date (빈 값은 "범위 무관" 처리)
 *   3. start_date 최신
 *   4. type 우선순위 (campaign > collab > seasonal > new_item > oneplus)
 *   5. sort_order (작은 값 우선)
 *
 * signature 정렬:
 *   1. enabled=true
 *   2. start_date ≤ today ≤ end_date (빈 값 = 영구)
 *   3. start_date 최신 (시즌 갱신 시 새 row 가 우선)
 *   4. sort_order (작은 값 우선)
 *
 * partial UNIQUE 가 signature 1 row 보장하지만 방어적으로 정렬 적용.
 */
export function selectActiveBanner(
  banners: ReadonlyArray<Banner>,
  kind: BannerKind,
  options: SelectActiveBannerOptions = {},
): Banner | null {
  const today = options.today ?? todayIsoSeoul();

  const active = banners.filter((b) => {
    if (b.kind !== kind) return false;
    if (!b.enabled) return false;
    if (b.start_date && b.start_date > today) return false;
    if (b.end_date && b.end_date < today) return false;
    return true;
  });

  if (active.length === 0) return null;
  if (active.length === 1) return active[0]!;

  return [...active].sort((a, b) => {
    if (a.start_date !== b.start_date) {
      return a.start_date > b.start_date ? -1 : 1;
    }
    if (a.kind === 'cafe_event' && b.kind === 'cafe_event') {
      const pa = CAFE_EVENT_TYPE_PRIORITY[a.type];
      const pb = CAFE_EVENT_TYPE_PRIORITY[b.type];
      if (pa !== pb) return pa - pb;
    }
    return a.sort_order - b.sort_order;
  })[0]!;
}

/**
 * 자문 §5.3 — active 0 + 7일 내 시작 예정 banner 있으면 Coming 반환.
 * cafe_event 만 의미 있음 (signature 는 보통 영구 active).
 */
export function selectComingBanner(
  banners: ReadonlyArray<Banner>,
  kind: BannerKind,
  options: SelectActiveBannerOptions = {},
): Banner | null {
  const today = options.today ?? todayIsoSeoul();
  const sevenDaysFromNow = addDaysIso(today, 7);

  const upcoming = banners.filter((b) => {
    if (b.kind !== kind) return false;
    if (!b.enabled) return false;
    if (!b.start_date) return false;
    return b.start_date > today && b.start_date <= sevenDaysFromNow;
  });

  if (upcoming.length === 0) return null;
  if (upcoming.length === 1) return upcoming[0]!;

  return [...upcoming].sort((a, b) => {
    if (a.start_date !== b.start_date) {
      return a.start_date < b.start_date ? -1 : 1;
    }
    if (a.kind === 'cafe_event' && b.kind === 'cafe_event') {
      const pa = CAFE_EVENT_TYPE_PRIORITY[a.type];
      const pb = CAFE_EVENT_TYPE_PRIORITY[b.type];
      if (pa !== pb) return pa - pb;
    }
    return a.sort_order - b.sort_order;
  })[0]!;
}

/* ── 7. 날짜 유틸 (Asia/Seoul 기준) ─────────────────────────────────────── */

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
  const date = new Date(
    Date.UTC(parseInt(m[1]!, 10), parseInt(m[2]!, 10) - 1, parseInt(m[3]!, 10)),
  );
  date.setUTCDate(date.getUTCDate() + days);
  const y = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}
