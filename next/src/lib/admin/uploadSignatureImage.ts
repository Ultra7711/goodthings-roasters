/* ══════════════════════════════════════════════════════════════════════════
   uploadSignatureImage.ts — 시그니처 chapter 이미지 업로드 (S237 · 062 재구성)

   책임:
   - 파일 사이즈/MIME 클라이언트 사전 검증 (UX — 실제 enforcement 는 RLS)
   - season-banners 버킷 + prefix `signature/images/{breakpoint}/` (062 마이그)
   - public URL 반환 (image_path_{desktop|tablet|mobile} 로 site_settings.signature
     payload 에 저장)

   설계:
   - uploadCafeEventImage.ts 답습 (브레이크포인트 3종 지원).
   - 062 모델 자동화 — SignatureChapter 가 HTML placeholder ({{IMAGE_DESKTOP}} 등)
     를 이 헬퍼가 반환한 URL 로 server-side 치환.
   ══════════════════════════════════════════════════════════════════════════ */

import { supabase } from '@/lib/supabase';
import { SEASON_BANNER_BUCKET, MAX_FILE_BYTES, ALLOWED_MIME } from './imageUploadShared';
import type { UploadResult } from './imageUploadShared';
import { convertToWebPClient } from './clientImageProcessing';
import { generateImageBlurAction } from './imageBlur';

export type SignatureBreakpoint = 'desktop' | 'tablet' | 'mobile';

function buildObjectPath(file: File, brk: SignatureBreakpoint): string {
  const ts = Date.now();
  const safe = file.name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, '-')
    .replace(/-+/g, '-')
    .slice(-60);
  return `signature/images/${brk}/${ts}-${safe}`;
}

export async function uploadSignatureImage(
  file: File,
  brk: SignatureBreakpoint,
): Promise<UploadResult> {
  if (!ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number])) {
    return {
      ok: false,
      error: 'unsupported_type',
      detail: `${file.type || 'unknown'} · webp/avif/jpeg/png 만 지원`,
    };
  }

  /* AI 서비스 출력 포맷이 제각각이므로 Canvas API 로 WebP 자동 변환 + 2000px
     downscale. 이미 WebP 면 skip. 변환 실패 시 fallback 으로 원본 사용. */
  const converted = await convertToWebPClient(file);
  const uploadFile = converted.ok ? converted.file : file;

  if (uploadFile.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      error: 'too_large',
      detail: `${(uploadFile.size / 1024 / 1024).toFixed(1)}MB · 최대 5MB`,
    };
  }

  const path = buildObjectPath(uploadFile, brk);
  const { error: uploadError } = await supabase.storage
    .from(SEASON_BANNER_BUCKET)
    .upload(path, uploadFile, {
      cacheControl: '3600',
      contentType: uploadFile.type,
      upsert: false,
    });

  if (uploadError) {
    const msg = uploadError.message ?? '';
    if (/unauthorized|forbidden|policy|admin/i.test(msg)) {
      return { ok: false, error: 'unauthorized', detail: msg.slice(0, 200) };
    }
    return { ok: false, error: 'upload_failed', detail: msg.slice(0, 200) };
  }

  const { data } = supabase.storage.from(SEASON_BANNER_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    return { ok: false, error: 'public_url_failed' };
  }

  /* S246: server action 으로 LQIP base64 dataURL 생성. 실패 시 graceful — blur 없이
     이미지만 저장. iframe 안 운영자 HTML 이 {{IMAGE_BLUR_*}} 를 빈 문자열로 받는 케이스
     대비 (운영자 HTML 측 fallback 처리). */
  const blurRes = await generateImageBlurAction(data.publicUrl);
  const blurDataURL = blurRes.ok ? blurRes.blurDataURL : undefined;

  return { ok: true, publicUrl: data.publicUrl, path, blurDataURL };
}
