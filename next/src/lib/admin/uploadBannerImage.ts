/* ══════════════════════════════════════════════════════════════════════════
   uploadBannerImage.ts — banners 통합 이미지 업로드 (S270 Phase 3b · 071)

   책임:
   - 파일 사이즈/MIME 클라이언트 사전 검증 (UX — 실제 enforcement 는 RLS)
   - banners 버킷 + prefix '{kind-slug}/images/{brk}/' (071 마이그)
   - public URL 반환 + LQIP base64 자동 생성

   설계:
   - kind: BannerKind ('cafe_event' | 'signature') 인자 → Storage prefix 분기
   - prefix 명명 규칙 = 071 마이그 주석의 규약 답습 (URL-safe hyphen)
       cafe_event → 'cafe-event'
       signature  → 'signature'
   - uploadCafeEventImage + uploadSignatureImage 통합본 (S270 Phase 3b).
   ══════════════════════════════════════════════════════════════════════════ */

import { supabase } from '@/lib/supabase';
import { MAX_FILE_BYTES, ALLOWED_MIME } from './imageUploadShared';
import type { UploadResult } from './imageUploadShared';
import { convertToWebPClient } from './clientImageProcessing';
import { generateImageBlurAction } from './imageBlur';
import type { BannerKind } from '@/lib/banners';

const BANNERS_BUCKET = 'banners';

export type BannerBreakpoint = 'desktop' | 'tablet' | 'mobile';

/** kind enum (underscore) → Storage prefix (hyphen · 071 마이그 규약). */
const KIND_STORAGE_PREFIX: Record<BannerKind, string> = {
  cafe_event: 'cafe-event',
  signature: 'signature',
};

function buildObjectPath(file: File, kind: BannerKind, brk: BannerBreakpoint): string {
  const ts = Date.now();
  const safe = file.name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, '-')
    .replace(/-+/g, '-')
    .slice(-60);
  return `${KIND_STORAGE_PREFIX[kind]}/images/${brk}/${ts}-${safe}`;
}

export async function uploadBannerImage(
  file: File,
  kind: BannerKind,
  brk: BannerBreakpoint,
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

  const path = buildObjectPath(uploadFile, kind, brk);
  const { error: uploadError } = await supabase.storage
    .from(BANNERS_BUCKET)
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

  const { data } = supabase.storage.from(BANNERS_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    return { ok: false, error: 'public_url_failed' };
  }

  /* server action 으로 LQIP base64 dataURL 생성. 실패 시 graceful — blur 없이
     이미지만 저장. iframe 안 운영자 HTML 이 {{IMAGE_BLUR_*}} 를 빈 문자열로
     받는 케이스 대비 (운영자 HTML 측 fallback 처리). */
  const blurRes = await generateImageBlurAction(data.publicUrl);
  const blurDataURL = blurRes.ok ? blurRes.blurDataURL : undefined;

  return { ok: true, publicUrl: data.publicUrl, path, blurDataURL };
}
