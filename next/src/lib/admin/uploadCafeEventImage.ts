/* ══════════════════════════════════════════════════════════════════════════
   uploadCafeEventImage.ts — cafe_events 이미지 업로드 (S234 후속 · 061 복원)

   책임:
   - 파일 사이즈/MIME 클라이언트 사전 검증 (UX — 실제 enforcement 는 RLS)
   - cafe-events 버킷 + prefix 'images/{breakpoint}/' (059 마이그)
   - public URL 반환 (image_path_{desktop|tablet|mobile} 컬럼에 저장)

   설계:
   - imageUploadShared 의 검증·에러 매핑 패턴 답습.
   - 061 자동화 — EventBanner 가 HTML placeholder ({{IMAGE_DESKTOP}} 등) 를
     이 헬퍼가 반환한 URL 로 runtime 치환.
   ══════════════════════════════════════════════════════════════════════════ */

import { supabase } from '@/lib/supabase';
import { MAX_FILE_BYTES, ALLOWED_MIME } from './imageUploadShared';
import type { UploadResult } from './imageUploadShared';

const CAFE_EVENT_BUCKET = 'cafe-events';

export type CafeEventBreakpoint = 'desktop' | 'tablet' | 'mobile';

function buildObjectPath(file: File, brk: CafeEventBreakpoint): string {
  const ts = Date.now();
  const safe = file.name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, '-')
    .replace(/-+/g, '-')
    .slice(-60);
  return `images/${brk}/${ts}-${safe}`;
}

export async function uploadCafeEventImage(
  file: File,
  brk: CafeEventBreakpoint,
): Promise<UploadResult> {
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      error: 'too_large',
      detail: `${(file.size / 1024 / 1024).toFixed(1)}MB · 최대 5MB`,
    };
  }
  if (!ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number])) {
    return {
      ok: false,
      error: 'unsupported_type',
      detail: `${file.type || 'unknown'} · webp/avif/jpeg/png 만 지원`,
    };
  }

  const path = buildObjectPath(file, brk);
  const { error: uploadError } = await supabase.storage
    .from(CAFE_EVENT_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    const msg = uploadError.message ?? '';
    if (/unauthorized|forbidden|policy|admin/i.test(msg)) {
      return { ok: false, error: 'unauthorized', detail: msg.slice(0, 200) };
    }
    return { ok: false, error: 'upload_failed', detail: msg.slice(0, 200) };
  }

  const { data } = supabase.storage.from(CAFE_EVENT_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    return { ok: false, error: 'public_url_failed' };
  }

  return { ok: true, publicUrl: data.publicUrl, path };
}
