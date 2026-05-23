/* ══════════════════════════════════════════
   _shared/helpers.ts — settings 폼 공용 헬퍼 (S256-A 분리)

   - format/parse/summarize: 입력 표현 보조
   - measureImageAspect: Signature 이미지 업로드 시 naturalWidth/Height 측정
   - shallowEqual* 4종: orchestrator dirty 계산
   - buildPreviewSrc: Signature Preview iframe URL 빌드 (orchestrator)
   - describeUpdatedKeys / describeError / describeUploadError: toast 메시지
   - formatAspectDisplay: AspectInput read-only 표시
   ══════════════════════════════════════════ */

import type {
  HomeFeaturedSettings,
  NoticeSettings,
  ShippingSettings,
  SignatureSettings,
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

/* ── URL summarize ────────────────────────────────────────────── */

export function summarizeUrl(url: string): string {
  const parts = url.split('/');
  const name = parts[parts.length - 1] ?? url;
  return name.length > 36 ? `${name.slice(0, 32)}…` : name;
}

/* ── Image aspect 측정 ────────────────────────────────────────── */

/** File 의 naturalWidth/Height 측정 → "W/H" 문자열. 실패 시 reject. */
export function measureImageAspect(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { naturalWidth: w, naturalHeight: h } = img;
      if (w > 0 && h > 0) resolve(`${w}/${h}`);
      else reject(new Error('invalid dimension'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image load failed'));
    };
    img.src = url;
  });
}

/** "2008/783" → "2008px x 783px" · 빈 값 → "—" · 형식 오류 → 원본 그대로. */
export function formatAspectDisplay(value: string): string {
  if (!value) return '—';
  const m = /^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/.exec(value);
  if (!m) return value;
  return `${m[1]}px x ${m[2]}px`;
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

export function shallowEqualSignature(a: SignatureSettings, b: SignatureSettings): boolean {
  return (
    a.enabled === b.enabled &&
    a.custom_html_path === b.custom_html_path &&
    a.image_path_desktop === b.image_path_desktop &&
    a.image_path_tablet === b.image_path_tablet &&
    a.image_path_mobile === b.image_path_mobile &&
    a.image_blur_desktop === b.image_blur_desktop &&
    a.image_blur_tablet === b.image_blur_tablet &&
    a.image_blur_mobile === b.image_blur_mobile &&
    a.aspect_desktop === b.aspect_desktop &&
    a.aspect_tablet === b.aspect_tablet &&
    a.aspect_mobile === b.aspect_mobile &&
    a.image_alt === b.image_alt &&
    a.headline_text === b.headline_text &&
    a.subhead_text === b.subhead_text &&
    a.cta_text === b.cta_text &&
    a.cta_href === b.cta_href
  );
}

/* ── Preview URL 빌드 (orchestrator) ───────────────────────────── */

/** SignatureSettings → /preview/signature URL. */
export function buildPreviewSrc(s: SignatureSettings): string {
  const params = new URLSearchParams({
    enabled: String(s.enabled),
    custom_html_path: s.custom_html_path,
    image_path_desktop: s.image_path_desktop,
    image_path_tablet: s.image_path_tablet,
    image_path_mobile: s.image_path_mobile,
    aspect_desktop: s.aspect_desktop,
    aspect_tablet: s.aspect_tablet,
    aspect_mobile: s.aspect_mobile,
    image_alt: s.image_alt,
    headline_text: s.headline_text,
    subhead_text: s.subhead_text,
    cta_text: s.cta_text,
    cta_href: s.cta_href,
  });
  return `/preview/signature?${params.toString()}`;
}

/* ── Toast 메시지 ──────────────────────────────────────────────── */

export function describeUpdatedKeys(keys: ReadonlyArray<string>): string {
  const labels: Record<string, string> = {
    notice: '공지 배너',
    shipping: '무료 배송 정책',
    signature: '시그니처 섹션',
    home_featured: '메인 노출 메뉴',
  };
  return keys.map((k) => labels[k] ?? k).join(' · ');
}

export function describeUploadError(error: string, detail?: string): string {
  switch (error) {
    case 'too_large':
      return `파일이 너무 큽니다 — ${detail ?? '5MB 이하로 다시 시도해 주세요'}`;
    case 'unsupported_type':
      return `지원하지 않는 파일 형식이에요 — ${detail ?? 'webp/avif/jpeg/png · .html 만 지원합니다'}`;
    case 'unauthorized':
      return '업로드 권한이 없습니다. 다시 로그인해 주세요.';
    case 'public_url_failed':
      return '업로드는 됐지만 주소를 만들지 못했습니다. 다시 시도해 주세요.';
    case 'upload_failed':
    default:
      return '파일을 업로드하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  }
}

export function describeError(error: string, detail?: string): string {
  switch (error) {
    case 'unauthorized':
      return '권한이 없습니다. 다시 로그인해 주세요.';
    case 'validation_failed':
      return `입력값을 확인해 주세요${detail ? ` (${detail})` : ''}`;
    case 'no_changes':
      return '변경된 항목이 없습니다.';
    case 'server_error':
    default:
      return '저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  }
}
