/* ══════════════════════════════════════════════════════════════════════════
   lib/banners.ts — 통합 배너 헬퍼 (S273 단순화)

   배경:
   - S270 ~ S272 = 통합 schema (071/072) + 어드민 2 페이지 분리.
   - S273 = 운영 검증 결과 두 kind 모두 multi row + active 1 모델로 통합.
     · partial UNIQUE (signature 단일) 폐기
     · CHECK (cafe_event type 필수) 폐기
     · cafe_event_type enum + banners.type 컬럼 폐기
     · banners.internal_label 신설 (운영자 식별 자유 텍스트)
     · selectActiveBanner = enabled + period(NULL=무제한) + sort_order ASC
       → 어드민 list 화살표로 1번 위치에 둔 카드가 메인 노출 (직관 정합)

   역할:
   - 단일 Banner Zod schema (kind 만 분기 인자)
   - DB row ↔ 코드 객체 변환 (parseBannerRow)
   - active 1 row 선택 헬퍼 (selectActiveBanner)
   - Coming Soon 헬퍼 (selectComingBanner) — sort_order ASC
   - 날짜 유틸 (todayIsoSeoul · dateOrEmpty)

   설계:
   - client-safe — 어드민 폼 + B2C SSR 양쪽에서 import.
   - server-only fetch / cache 는 lib/bannersServer.ts 분리.

   참조:
   - supabase/migrations/071_banners_unified.sql (테이블 + kind enum)
   - supabase/migrations/073_banners_unify_simplify.sql (S273 단순화)
   ══════════════════════════════════════════════════════════════════════════ */

import { z } from 'zod';

/* ── 1. kind enum ────────────────────────────────────────────────────── */

export const BANNER_KINDS = ['cafe_event', 'signature'] as const;
export const BannerKindSchema = z.enum(BANNER_KINDS);
export type BannerKind = z.infer<typeof BannerKindSchema>;

/* ── 2. 공통 schema (Banner 단일) ──────────────────────────────────────── */

/* DB date 컬럼은 NULL 또는 ISO "YYYY-MM-DD" 문자열. 둘 다 빈 문자열로 정규화.
   selectActiveBanner 는 빈 문자열 = "범위 무관" 으로 해석. */
const dateOrEmpty = z
  .union([z.string(), z.null()])
  .transform((v) => {
    if (v == null) return '';
    const trimmed = v.trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : '';
  });

export const BannerSchema = z.object({
  id: z.string().uuid(),
  kind: BannerKindSchema,
  enabled: z.boolean().default(true),

  /** 운영자 자유 식별 텍스트 — 어드민 list 카드 라벨. 사이트 노출 없음. */
  internal_label: z.string().trim().max(120).default(''),

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

  /* 기간 — 빈 값 = "범위 무관" (NULL=무제한 유효). */
  start_date: dateOrEmpty.default(''),
  end_date: dateOrEmpty.default(''),

  /* 어드민 화살표 reorder 결과. 작은 값 우선 (1번 = 노출 배너). */
  sort_order: z.number().int().default(0),
});

export type Banner = z.infer<typeof BannerSchema>;

/* 폐기된 type alias 들 — caller 일괄 Banner 로 변경 후 본 alias 제거.
   S273 진행 중 임시 backward compat 용. */
export type CafeEventBanner = Banner;
export type SignatureBanner = Banner;

/* ── 3. DB row 변환 ───────────────────────────────────────────────────── */

/**
 * Supabase row (snake_case) → Banner.
 * 실패 시 null 반환 (호출부가 fallback 처리).
 */
export function parseBannerRow(raw: unknown): Banner | null {
  if (raw == null || typeof raw !== 'object') return null;
  const result = BannerSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/* ── 4. active 1 row 선택 ─────────────────────────────────────────────── */

export interface SelectActiveBannerOptions {
  /** ISO date "YYYY-MM-DD" — 기본은 today (Asia/Seoul) */
  today?: string;
}

/**
 * banners 배열에서 kind 매치 + active 1 row 선택.
 *
 * S273 정렬 룰 (사용자 시그널 정합):
 *   1. kind 일치
 *   2. enabled = true
 *   3. start_date ≤ today (빈 값 = 무제한 통과)
 *   4. end_date ≥ today (빈 값 = 무제한 통과)
 *   5. sort_order ASC (작은 값 우선 = 어드민 list 1번 카드)
 *   6. tie-break: created_at 오래된 row 우선 (id ASC 로 deterministic)
 *
 * 어드민 list 에서 화살표로 1번 위치에 둔 카드가 곧 메인 노출 배너.
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
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.id < b.id ? -1 : 1;
  })[0]!;
}

/**
 * active 0 + 7일 내 시작 예정 banner 있으면 Coming 반환.
 * 호출부는 active=null 인 경우에만 추가 호출 (주로 cafe_event chapter).
 *
 * 정렬: start_date ASC (가장 빨리 시작) → sort_order ASC.
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
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.id < b.id ? -1 : 1;
  })[0]!;
}

/* ── 5. 날짜 유틸 (Asia/Seoul 기준) ─────────────────────────────────────── */

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
