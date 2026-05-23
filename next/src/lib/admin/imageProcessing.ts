import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   lib/admin/imageProcessing.ts — 어드민 이미지 업로드 공통 처리 (S231-3)

   책임:
   - sharp webp 변환 (max 1600px 너비 · quality 85 · EXIF 자동 회전)
   - plaiceholder LQIP + width/height + dominant color (color.hex)
   - filename 생성 (prefix + timestamp + random · .webp 강제)
   - bg_theme 자동 판별 (luminance > 128 = light)

   호출처 (현재):
   - /admin/products uploadProductImageAction (S231-3)
   - /admin/gooddays uploadGoodDaysImageAction (S231-3 마이그)

   호출처 (carry-over · admin 업로드 작성 시 답습):
   - /admin/cafe-menu (project_admin_cafe_menu_upload)
   - /admin/season-banners (TBD)

   정책 일관:
   - 어떤 형식 (jpg/png/avif/webp) 업로드해도 webp 로 통일
   - 파일 크기 절감 (jpg 500KB → webp 150KB 약 1/3)
   - 운영자 사전 webp 변환 부담 0
   ══════════════════════════════════════════════════════════════════════════ */

import { getPlaiceholder } from 'plaiceholder';
import sharp from 'sharp';

export const ADMIN_IMAGE_MAX_WIDTH = 1600;
export const ADMIN_IMAGE_WEBP_QUALITY = 85;

/** Buffer → sharp 변환 (webp 1600px quality 85) → plaiceholder 메타. */
export type ProcessedImage = {
  buffer: Buffer;
  base64: string;
  width: number;
  height: number;
  colorHex: string;
  bgTheme: 'light' | 'dark';
};

/**
 * 원본 file Buffer → sharp webp 변환 + plaiceholder 메타 추출.
 *
 * 실패 시:
 * - sharp 변환 실패 → 'convert_failed'
 * - plaiceholder 실패 → 'placeholder_failed'
 */
export async function processAdminImage(
  original: Buffer,
): Promise<
  | { ok: true; image: ProcessedImage }
  | { ok: false; error: 'convert_failed' | 'placeholder_failed' }
> {
  let webpBuffer: Buffer;
  try {
    webpBuffer = await sharp(original)
      .rotate()
      .resize({ width: ADMIN_IMAGE_MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: ADMIN_IMAGE_WEBP_QUALITY })
      .toBuffer();
  } catch (err) {
    console.error('[processAdminImage] sharp convert failed', err);
    return { ok: false, error: 'convert_failed' };
  }

  try {
    const ph = await getPlaiceholder(webpBuffer, { size: 10 });
    return {
      ok: true,
      image: {
        buffer: webpBuffer,
        base64: ph.base64,
        width: ph.metadata.width,
        height: ph.metadata.height,
        colorHex: ph.color.hex,
        bgTheme: isLightHex(ph.color.hex) ? 'light' : 'dark',
      },
    };
  } catch (err) {
    console.error('[processAdminImage] plaiceholder failed', err);
    return { ok: false, error: 'placeholder_failed' };
  }
}

/** WCAG luminance 단순 근사 (0.299R + 0.587G + 0.114B > 128 = light). */
function isLightHex(hex: string): boolean {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return true;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 128;
}

/**
 * .webp 강제 filename 생성.
 *
 * @param prefix - 도메인 별 prefix (예: 'pd' · 'gd' · 'cm' · 'sb')
 */
export function buildAdminImageFilename(prefix: string): string {
  const safe = prefix.replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'img';
  return `${safe}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
}
