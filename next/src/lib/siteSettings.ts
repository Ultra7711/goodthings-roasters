/* ══════════════════════════════════════════════════════════════════════════
   lib/siteSettings.ts — 사이트 설정 (site_settings) 순수 헬퍼 (S129 Group H)

   역할:
   - 영역별 Zod schema (notice · shipping · home_featured)
   - 기본값 (DB seed 와 동일 — 프론트에서도 fallback 으로 사용)
   - 영역 ID 상수

   설계:
   - client-safe — 어드민 페이지(client) 와 메인 사이트(server) 양쪽에서 import.
   - DB row(value JSONB) ↔ 코드 객체 변환은 Zod parse 로.
   - 위치는 lib/admin 이 아닌 lib/ 직속 — 메인 사이트도 사용.

   S270 Phase 3b — signature 분리:
   - signature 는 banners 통합 테이블 + lib/banners.ts 로 이전.
   - site_settings.signature row 는 legacy 보존 (별 sprint 에서 074 마이그로 삭제).

   참조:
   - 032_site_settings.sql (테이블 + seed)
   - 071_banners_unified.sql (signature 통합 이전)
   ══════════════════════════════════════════════════════════════════════════ */

import { z } from 'zod';

/* ── 영역 상수 ────────────────────────────────────────────────────────── */

export const SITE_SETTING_KEYS = ['notice', 'shipping', 'home_featured', 'hours'] as const;
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

/* ── 3. 메인 노출 카페 메뉴 슬롯 (home_featured) — S248 (069) ───────────── */

/**
 * 메인 페이지 §2.5 CafeMenuSection 의 시그니처 메뉴 3종 노출 슬롯.
 *
 * 운영자가 `/admin/settings` 에서 `cafe_menus` 전체 (is_active=true ·
 * status 무관) 중 0~3 종을 명시 선택. 순서 = 노출 순서.
 *
 * 빈 배열·미설정 시 CafeMenuSection 이 기존 `status='시그니처' .slice(0,3)` 으로
 * 자동 fallback (DEC-S248-8 안전망).
 *
 * id 형식: cafe_menus.id 는 **text PK** ('s01' / 'b04' 같은 prefix + 2자리 패턴).
 * 047 마이그 check constraint `id ~ '^[a-z][0-9]{2,}$'` 와 동일 규칙 답습.
 */
export const HomeFeaturedSettingsSchema = z.object({
  /** cafe_menus.id (text) 배열. 길이 0~3 · 순서 = 노출 순서. */
  menu_ids: z
    .array(z.string().regex(/^[a-z][0-9]{2,}$/))
    .max(3)
    .default([]),
});

export type HomeFeaturedSettings = z.infer<typeof HomeFeaturedSettingsSchema>;

const HOME_FEATURED_DEFAULTS: HomeFeaturedSettings = {
  menu_ids: [],
};

/* ── 4. 매장 영업시간 (hours) ─────────────────────────────────────────── */

/** 'HH:MM' (00:00~23:59) */
const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** 하루 영업 — null 이면 정기 휴무 */
export const DayHoursSchema = z
  .object({ open: HHMM, close: HHMM })
  .nullable();
export type DayHours = z.infer<typeof DayHoursSchema>;

/** 비정기 휴무 (날짜 + 사유) */
export const ClosureSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().max(60).default(''),
});
export type Closure = z.infer<typeof ClosureSchema>;

/**
 * 영업시간 — 요일별 기본 규칙(0=일 ~ 6=토) + 비정기 휴무.
 * shopHours.ts 의 상태 계산이 이 설정을 소비한다.
 */
export const HoursSettingsSchema = z.object({
  /** 위젯 표시 여부 — false 면 Story Location 영업시간 위젯 자체를 숨김 (다른 섹션 enabled 패턴 답습) */
  enabled: z.boolean().default(true),
  weekly: z.object({
    '0': DayHoursSchema,
    '1': DayHoursSchema,
    '2': DayHoursSchema,
    '3': DayHoursSchema,
    '4': DayHoursSchema,
    '5': DayHoursSchema,
    '6': DayHoursSchema,
  }),
  closures: z.array(ClosureSchema).max(50).default([]),
});

export type HoursSettings = z.infer<typeof HoursSettingsSchema>;

export const HOURS_DEFAULTS: HoursSettings = {
  enabled: true,
  weekly: {
    '0': { open: '11:00', close: '21:00' }, // 일
    '1': null, // 월 휴무
    '2': { open: '12:00', close: '21:00' }, // 화
    '3': { open: '12:00', close: '21:00' }, // 수
    '4': { open: '12:00', close: '21:00' }, // 목
    '5': { open: '12:00', close: '21:00' }, // 금
    '6': { open: '11:00', close: '21:00' }, // 토
  },
  closures: [],
};

/* ── 통합 ────────────────────────────────────────────────────────────── */

export interface SiteSettings {
  notice: NoticeSettings;
  shipping: ShippingSettings;
  home_featured: HomeFeaturedSettings;
  hours: HoursSettings;
}

export const SITE_SETTINGS_DEFAULTS: SiteSettings = {
  notice: NOTICE_DEFAULTS,
  shipping: SHIPPING_DEFAULTS,
  home_featured: HOME_FEATURED_DEFAULTS,
  hours: HOURS_DEFAULTS,
};

/**
 * DB rows ([{key, value}, ...]) → SiteSettings 객체.
 * 누락된 영역은 DEFAULTS 로 채움. parse 실패 시 해당 영역만 DEFAULTS.
 * site_settings.signature 같은 legacy row 는 자연 무시.
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
    home_featured: safeParse(HomeFeaturedSettingsSchema, map.get('home_featured'), HOME_FEATURED_DEFAULTS),
    hours: safeParse(HoursSettingsSchema, map.get('hours'), HOURS_DEFAULTS),
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
