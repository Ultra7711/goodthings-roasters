'use server';

/* ══════════════════════════════════════════════════════════════════════════
   imageActions.ts — /admin/newsletter 본문 이미지 업로드 (S250-2 Phase 2)

   uploadNewsletterImageAction — Storage upload → public URL 반환.
   - products imageActions 답습. 단 DB INSERT 없음 — 캠페인 블록(jsonb)에 URL 직접 박음.
   - processAdminImage(sharp webp 1600px) + buildAdminImageFilename('nl').
   - newsletter-images 버킷 (083 · public · is_admin RLS).
   ══════════════════════════════════════════════════════════════════════════ */

import { getAdminClaims } from '@/lib/auth/getClaims';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  buildAdminImageFilename,
  processAdminImage,
} from '@/lib/admin/imageProcessing';
import { logActionError } from '@/lib/admin/logActionError';
import { NEWSLETTER_IMAGES_BUCKET } from './_constants';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB (083 버킷 제한 정합)

export type UploadNewsletterImageResult =
  | { ok: true; src: string; width: number; height: number }
  | {
      ok: false;
      error: 'unauthorized' | 'validation_failed' | 'invalid_image' | 'server_error';
      detail?: string;
    };

export async function uploadNewsletterImageAction(
  formData: FormData,
): Promise<UploadNewsletterImageResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'validation_failed', detail: 'file_missing' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, error: 'validation_failed', detail: 'file_too_large' };
  }

  const original = Buffer.from(await file.arrayBuffer());

  const processed = await processAdminImage(original);
  if (!processed.ok) {
    return { ok: false, error: 'invalid_image' };
  }
  const { image } = processed;

  /* 캠페인은 발송 전까지 저장되지 않으므로 그룹 폴더 없이 평면 경로. */
  const storagePath = buildAdminImageFilename('nl');
  const admin = getSupabaseAdmin();

  const { error: uploadErr } = await admin.storage
    .from(NEWSLETTER_IMAGES_BUCKET)
    .upload(storagePath, image.buffer, {
      contentType: 'image/webp',
      upsert: false,
    });
  if (uploadErr) {
    logActionError('[uploadNewsletterImageAction] storage upload failed', uploadErr);
    return { ok: false, error: 'server_error' };
  }

  const { data: urlData } = admin.storage
    .from(NEWSLETTER_IMAGES_BUCKET)
    .getPublicUrl(storagePath);

  return {
    ok: true,
    src: urlData.publicUrl,
    width: image.width,
    height: image.height,
  };
}
