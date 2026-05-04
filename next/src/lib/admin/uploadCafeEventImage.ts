/* ══════════════════════════════════════════════════════════════════════════
   uploadCafeEventImage.ts — cafe_events 이미지 업로드 (S151 PR-2a)

   책임:
   - 파일 사이즈/MIME 클라이언트 사전 검증 (UX — 실제 enforcement 는 RLS)
   - cafe-events 버킷 (035_cafe_events.sql 에서 생성)
   - public URL 반환 (image_path 로 cafe_events 행에 저장)

   설계:
   - uploadSeasonBanner 의 검증·에러 매핑 패턴 답습.
   - 035 마이그레이션이 cafe-events 버킷을 별도로 만들었으므로 prefix 분리 불필요.
   ══════════════════════════════════════════════════════════════════════════ */

import { supabase } from '@/lib/supabase';
import { MAX_FILE_BYTES, ALLOWED_MIME } from './uploadSeasonBanner';
import type { UploadResult } from './uploadSeasonBanner';

export const CAFE_EVENT_BUCKET = 'cafe-events';

function buildObjectPath(file: File): string {
  const ts = Date.now();
  const safe = file.name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, '-')
    .replace(/-+/g, '-')
    .slice(-60);
  return `${ts}-${safe}`;
}

export async function uploadCafeEventImage(file: File): Promise<UploadResult> {
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

  const path = buildObjectPath(file);
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
