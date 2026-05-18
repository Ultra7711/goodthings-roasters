/* ══════════════════════════════════════════════════════════════════════════
   lib/siteSettings.ts — 사이트 설정 (site_settings) 순수 헬퍼 (S129 Group H)

   역할:
   - 영역별 Zod schema (notice · shipping · signature)
   - 기본값 (DB seed 와 동일 — 프론트에서도 fallback 으로 사용)
   - 영역 ID 상수 + 라벨 매핑

   설계:
   - client-safe — 어드민 페이지(client) 와 메인 사이트(server) 양쪽에서 import.
   - DB row(value JSONB) ↔ 코드 객체 변환은 Zod parse 로.
   - 위치는 lib/admin 이 아닌 lib/ 직속 — 메인 사이트도 사용.

   참조:
   - 032_site_settings.sql (테이블 + seed)
   ══════════════════════════════════════════════════════════════════════════ */

import { z } from 'zod';

/* ── 영역 상수 ────────────────────────────────────────────────────────── */

export const SITE_SETTING_KEYS = ['notice', 'shipping', 'signature'] as const;
export type SiteSettingKey = (typeof SITE_SETTING_KEYS)[number];

/* ── 1. 공지 배너 (notice) ────────────────────────────────────────────── */

export const NoticeSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  /**
   * true 면 shipping.free_threshold 로 자동 합성, text 필드 무시.
   * false 면 text 그대로 사용. 기본값 true (권장).
   */
  auto_text: z.boolean().default(true),
  text: z.string().trim().max(120).default(''),
  /** 우측 보조 영문 (현재 메인 사이트 ".ann-en" 위치) */
  secondary: z.string().trim().max(80).default(''),
  link: z.string().trim().max(200).default(''),
  /** COLOR_THEMES 인덱스 (0~3) */
  theme_idx: z.number().int().min(0).max(3).default(0),
});

export type NoticeSettings = z.infer<typeof NoticeSettingsSchema>;

export const NOTICE_DEFAULTS: NoticeSettings = {
  enabled: true,
  auto_text: true,
  text: '30,000원 이상 구매 시 무료 배송',
  secondary: 'Specialty Coffee For All',
  link: '',
  theme_idx: 0,
};

/* ── 2. 무료배송 정책 (shipping) ──────────────────────────────────────── */

export const ShippingSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  /** 무료배송 임계 금액 (원) — enabled=false 면 적용 안 함 */
  free_threshold: z.number().int().min(0).max(10_000_000).default(30000),
  /** 임계 미달 시 부과 배송비 (원) */
  base_fee: z.number().int().min(0).max(100_000).default(3500),
});

export type ShippingSettings = z.infer<typeof ShippingSettingsSchema>;

export const SHIPPING_DEFAULTS: ShippingSettings = {
  enabled: true,
  free_threshold: 30000,
  base_fee: 3500,
};

/* ── 3. 시그니처 chapter (signature) — S237 iframe HTML 모델 (062) ────── */

/**
 * cafe-events (060/061) 답습 — 운영자가 .html 1 + 이미지 3 (desktop/tablet/mobile)
 * 을 업로드하면 SignatureChapter 가 placeholder 치환 후 <iframe sandbox srcDoc>
 * 으로 임베드. 디자인·텍스트·SVG·폰트 모두 운영자 HTML 내부에서 처리.
 *
 * Zod nullable() — site_settings.value 의 jsonb 에 NULL 키가 섞일 수 있는
 * 가능성 대비 (S235 학습 #3 cafe-events 답습).
 */
export const SignatureSettingsSchema = z.object({
  enabled: z.boolean().default(false),

  /** 운영자 .html 파일 Storage URL (season-banners/signature/html/*) — 필수.
      빈 값이면 chapter hide. SignatureChapter 가 fetch → placeholder 치환 →
      <iframe srcDoc sandbox="allow-same-origin"> 임베드. */
  custom_html_path: z.union([z.string(), z.null()]).transform((v) => v ?? '').pipe(
    z.string().trim().max(500),
  ).default(''),

  /** 데스크탑 이미지 Storage URL. HTML 안 {{IMAGE_DESKTOP}} placeholder 치환. */
  image_path_desktop: z.union([z.string(), z.null()]).transform((v) => v ?? '').pipe(
    z.string().trim().max(500),
  ).default(''),
  /** 태블릿 이미지 — 비어있으면 desktop fallback. {{IMAGE_TABLET}} 치환. */
  image_path_tablet: z.union([z.string(), z.null()]).transform((v) => v ?? '').pipe(
    z.string().trim().max(500),
  ).default(''),
  /** 모바일 이미지 — 비어있으면 desktop fallback. {{IMAGE_MOBILE}} 치환. */
  image_path_mobile: z.union([z.string(), z.null()]).transform((v) => v ?? '').pipe(
    z.string().trim().max(500),
  ).default(''),

  /** iframe 컨테이너 aspect-ratio (>=1024px). CSS aspect-ratio 형식 "W/H". */
  aspect_desktop: z.union([z.string(), z.null()]).transform((v) => v ?? '').pipe(
    z.string().trim().max(40),
  ).default('1320/600'),
  /** iframe 컨테이너 aspect-ratio (768~1023px). */
  aspect_tablet: z.union([z.string(), z.null()]).transform((v) => v ?? '').pipe(
    z.string().trim().max(40),
  ).default('1024/520'),
  /** iframe 컨테이너 aspect-ratio (<768px). */
  aspect_mobile: z.union([z.string(), z.null()]).transform((v) => v ?? '').pipe(
    z.string().trim().max(40),
  ).default('390/520'),

  /** iframe title 속성 + 접근성 description. */
  image_alt: z.union([z.string(), z.null()]).transform((v) => v ?? '').pipe(
    z.string().trim().max(120),
  ).default(''),
});

export type SignatureSettings = z.infer<typeof SignatureSettingsSchema>;

/** 코드 default — DB row 없을 때 fallback. enabled=false → chapter hide. */
export const SIGNATURE_DEFAULTS: SignatureSettings = {
  enabled: false,
  custom_html_path: '',
  image_path_desktop: '',
  image_path_tablet: '',
  image_path_mobile: '',
  aspect_desktop: '1320/600',
  aspect_tablet: '1024/520',
  aspect_mobile: '390/520',
  image_alt: '',
};

/* ── 통합 ────────────────────────────────────────────────────────────── */

export interface SiteSettings {
  notice: NoticeSettings;
  shipping: ShippingSettings;
  signature: SignatureSettings;
}

export const SITE_SETTINGS_DEFAULTS: SiteSettings = {
  notice: NOTICE_DEFAULTS,
  shipping: SHIPPING_DEFAULTS,
  signature: SIGNATURE_DEFAULTS,
};

/**
 * DB rows ([{key, value}, ...]) → SiteSettings 객체.
 * 누락된 영역은 DEFAULTS 로 채움. parse 실패 시 해당 영역만 DEFAULTS.
 */
export function parseSiteSettingsRows(
  rows: ReadonlyArray<{ key: string; value: unknown }>,
): SiteSettings {
  const map = new Map<string, unknown>();
  for (const row of rows) map.set(row.key, row.value);

  const safeParse = <T>(schema: z.ZodType<T>, raw: unknown, fallback: T): T => {
    if (raw == null) return fallback;
    const result = schema.safeParse(raw);
    return result.success ? result.data : fallback;
  };

  return {
    notice: safeParse(NoticeSettingsSchema, map.get('notice'), NOTICE_DEFAULTS),
    shipping: safeParse(ShippingSettingsSchema, map.get('shipping'), SHIPPING_DEFAULTS),
    signature: safeParse(SignatureSettingsSchema, map.get('signature'), SIGNATURE_DEFAULTS),
  };
}

/* ── 색상 테마 (notice 배너) ──────────────────────────────────────────── */

/** [bg, fg] tuple. 시안 settings.jsx 의 4종을 베이스로, theme 0 은
   메인 사이트 토큰 (`--color-background-inverse: #1E1B16` / `--color-text-inverse: #FAFAF8`)
   실측치로 맞춰 어드민 미리보기와 메인 사이트 색이 일치하도록 한다. */
export const NOTICE_COLOR_THEMES = [
  ['#1E1B16', '#FAFAF8'],
  ['#C96442', '#FFFFFF'],
  ['#2F7D4F', '#FFFFFF'],
  ['#FAF6EE', '#1A1A1A'],
] as const satisfies ReadonlyArray<readonly [string, string]>;

/**
 * 변경 영역 카운트 — "저장되지 않은 변경 N개" 뱃지용.
 * 영역별 객체 비교 (얕은 동등) — 한 영역 내 어떤 필드라도 다르면 1로 카운트.
 */
export function countDirtyAreas(
  initial: SiteSettings,
  current: SiteSettings,
): number {
  let n = 0;
  if (!shallowEqual(initial.notice, current.notice)) n += 1;
  if (!shallowEqual(initial.shipping, current.shipping)) n += 1;
  if (!shallowEqual(initial.signature, current.signature)) n += 1;
  return n;
}

function shallowEqual<T extends Record<string, unknown>>(a: T, b: T): boolean {
  const keys = Object.keys(a) as Array<keyof T>;
  if (keys.length !== Object.keys(b).length) return false;
  for (const k of keys) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

/* ── 공지 텍스트 합성 ────────────────────────────────────────────────── */

/**
 * 공지 배너에 표시할 최종 텍스트 — auto_text 모드 처리.
 * - auto_text=true  : shipping.free_threshold 로 자동 합성 ("N원 이상 구매 시 무료 배송")
 * - auto_text=false : notice.text 그대로
 *
 * shipping.enabled=false 이면 "무료 배송 정책" 자체가 비활성 → auto 모드여도
 * 공지 텍스트가 어색해지므로 fallback 으로 빈 문자열 반환 (어드민이 manual 로 전환 권장).
 */
export function composeNoticeText(
  notice: NoticeSettings,
  shipping: ShippingSettings,
): string {
  if (!notice.auto_text) return notice.text;
  if (!shipping.enabled) return '';
  return `${shipping.free_threshold.toLocaleString('ko-KR')}원 이상 구매 시 무료 배송`;
}
