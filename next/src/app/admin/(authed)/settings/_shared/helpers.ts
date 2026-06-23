/* ══════════════════════════════════════════
   _shared/helpers.ts — settings 폼 공용 헬퍼 (S256-A 분리 · S270 Phase 3b)

   - format/parse/summarize: 입력 표현 보조
   - shallowEqual* 3종: orchestrator dirty 계산 (signature 는 S270 에서 분리)
   - describeUpdatedKeys: 저장 성공 시 갱신 영역 라벨

   S257: describeError · describeUploadError 는 lib/admin/errorDescribe.ts 로 이관.
   S270 Phase 3b: shallowEqualSignature · buildPreviewSrc · measureImageAspect ·
                  summarizeUrl · formatAspectDisplay 는 /admin/signatures 페이지로
                  이전 (SignaturesForm 내부 inline).
   ══════════════════════════════════════════ */

import type {
  HomeFeaturedSettings,
  NoticeSettings,
  ShippingSettings,
  HoursSettings,
  PointsSettings,
} from '@/lib/siteSettings';

/* ── Number format ────────────────────────────────────────────── */

export function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR');
}

export function parseNumber(s: string): number {
  const cleaned = s.replace(/[^\d]/g, '');
  if (cleaned === '') return 0;
  const n = Number.parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : 0;
}

/* ── Shallow equal (영역별 dirty 비교) ────────────────────────── */

export function shallowEqualNotice(a: NoticeSettings, b: NoticeSettings): boolean {
  return (
    a.enabled === b.enabled &&
    a.auto_text === b.auto_text &&
    a.text === b.text &&
    a.secondary === b.secondary &&
    a.link === b.link &&
    a.theme_idx === b.theme_idx
  );
}

export function shallowEqualShipping(a: ShippingSettings, b: ShippingSettings): boolean {
  return (
    a.enabled === b.enabled &&
    a.free_threshold === b.free_threshold &&
    a.base_fee === b.base_fee
  );
}

export function shallowEqualHomeFeatured(
  a: HomeFeaturedSettings,
  b: HomeFeaturedSettings,
): boolean {
  if (a.menu_ids.length !== b.menu_ids.length) return false;
  for (let i = 0; i < a.menu_ids.length; i += 1) {
    if (a.menu_ids[i] !== b.menu_ids[i]) return false;
  }
  return true;
}

/** 영업시간 — 요일별·비정기 휴무 중첩 구조라 deep 비교 (JSON 직렬화). */
export function equalHours(a: HoursSettings, b: HoursSettings): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** 포인트 — earn.triggers 등 중첩 구조라 deep 비교 (JSON 직렬화). */
export function equalPoints(a: PointsSettings, b: PointsSettings): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/* ── Toast 메시지 ──────────────────────────────────────────────── */

export function describeUpdatedKeys(keys: ReadonlyArray<string>): string {
  const labels: Record<string, string> = {
    notice: '공지 배너',
    shipping: '무료 배송 정책',
    home_featured: '메인 노출 메뉴',
    hours: '영업시간',
    points: '적립금 정책',
  };
  return keys.map((k) => labels[k] ?? k).join(' · ');
}
