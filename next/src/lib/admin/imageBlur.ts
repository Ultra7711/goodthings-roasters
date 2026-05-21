'use server';

/* ══════════════════════════════════════════════════════════════════════════
   lib/admin/imageBlur.ts — Storage URL → LQIP base64 dataURL (S246)

   책임:
   - 어드민이 업로드한 이미지 (Storage publicUrl) 의 LQIP base64 dataURL 생성.
   - iframe srcDoc 모델 배너 (signature / cafe-event) 의 `{{IMAGE_BLUR_*}}`
     placeholder 치환용.

   호출처:
   - admin/settings/SettingsForm — signature 이미지 업로드 후
   - admin/cafe-events/[id]/edit/CafeEventForm — cafe-event 이미지 업로드 후

   설계:
   - imageProcessing.ts 의 processAdminImage 는 원본 Buffer 받음.
     본 헬퍼는 이미 Storage 에 업로드된 publicUrl 을 받아 fetch → plaiceholder.
   - 클라이언트 측 업로드 (uploadSignatureImage / uploadCafeEventImage · Canvas
     API) 흐름 유지. 업로드 직후 본 server action 으로 LQIP 만 별도 생성.
   ══════════════════════════════════════════════════════════════════════════ */

import { getPlaiceholder } from 'plaiceholder';

export type GenerateImageBlurResult =
  | { ok: true; blurDataURL: string }
  | { ok: false; error: 'fetch_failed' | 'placeholder_failed' };

export async function generateImageBlurAction(
  publicUrl: string,
): Promise<GenerateImageBlurResult> {
  let arrayBuffer: ArrayBuffer;
  try {
    const res = await fetch(publicUrl, { cache: 'no-store' });
    if (!res.ok) {
      return { ok: false, error: 'fetch_failed' };
    }
    arrayBuffer = await res.arrayBuffer();
  } catch (err) {
    console.error('[generateImageBlurAction] fetch failed', publicUrl, err);
    return { ok: false, error: 'fetch_failed' };
  }

  try {
    const buf = Buffer.from(arrayBuffer);
    const ph = await getPlaiceholder(buf, { size: 10 });
    return { ok: true, blurDataURL: ph.base64 };
  } catch (err) {
    console.error('[generateImageBlurAction] plaiceholder failed', publicUrl, err);
    return { ok: false, error: 'placeholder_failed' };
  }
}
