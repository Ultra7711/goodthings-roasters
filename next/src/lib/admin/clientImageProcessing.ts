/* ══════════════════════════════════════════════════════════════════════════
   lib/admin/clientImageProcessing.ts — 어드민 이미지 client-side 변환 (S239 B-1b)

   목적:
   - AI 서비스 (Gemini · ChatGPT · Imagen 등) 출력 이미지의 포맷이 PNG · JPEG ·
     WebP 등 제각각이므로, admin client 가 Canvas API 로 업로드 직전 자동 WebP
     변환. 운영자 사전 변환 부담 0.
   - sharp (`server-only`) 가 적용 안 되는 client-side direct upload 경로
     (uploadSignatureImage · uploadCafeEventImage) 에서 사용.

   설계:
   - 이미 WebP 인 파일은 변환 skip (no-op).
   - max-width 초과 시 비율 유지 downscale (HiDPI 대응 권장 크기 ~2000px).
   - quality 0.85 (sharp 패턴 답습).
   - Canvas API 표준 — Chrome / Firefox / Safari / Edge 모두 지원.
   - 변환 실패 시 명시적 에러 반환 — 호출부가 사용자에게 안내.

   호출처:
   - uploadSignatureImage.ts
   - uploadCafeEventImage.ts
   ══════════════════════════════════════════════════════════════════════════ */

export const CLIENT_IMAGE_MAX_WIDTH = 2000;
export const CLIENT_IMAGE_WEBP_QUALITY = 0.85;

export type ConvertResult =
  | { ok: true; file: File }
  | { ok: false; error: 'image_load_failed' | 'canvas_failed' | 'toblob_failed' };

/**
 * 원본 File → WebP File 변환 (Canvas API).
 *
 * - 입력이 이미 WebP 면 변환 skip · 원본 File 그대로 반환.
 * - max-width 초과 시 비율 유지 downscale.
 * - 실패 시 에러 코드 반환 (호출부가 fallback 또는 사용자 안내).
 */
export async function convertToWebPClient(
  original: File,
  options: { maxWidth?: number; quality?: number } = {},
): Promise<ConvertResult> {
  const maxWidth = options.maxWidth ?? CLIENT_IMAGE_MAX_WIDTH;
  const quality = options.quality ?? CLIENT_IMAGE_WEBP_QUALITY;

  /* 이미 WebP 면 변환 skip — Canvas 거치면 화질 손실 발생. */
  if (original.type === 'image/webp') return { ok: true, file: original };

  return new Promise<ConvertResult>((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(original);

    img.onload = () => {
      try {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve({ ok: false, error: 'canvas_failed' });
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (!blob) {
              resolve({ ok: false, error: 'toblob_failed' });
              return;
            }
            /* filename 도 .webp 로 강제 — Storage objectPath / contentType 정합 */
            const newName = original.name.replace(/\.[^.]+$/, '') + '.webp';
            const webpFile = new File([blob], newName, {
              type: 'image/webp',
              lastModified: original.lastModified,
            });
            resolve({ ok: true, file: webpFile });
          },
          'image/webp',
          quality,
        );
      } catch {
        URL.revokeObjectURL(url);
        resolve({ ok: false, error: 'canvas_failed' });
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ ok: false, error: 'image_load_failed' });
    };

    img.src = url;
  });
}
