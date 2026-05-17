/* ══════════════════════════════════════════════════════════════════════════
   uploadCafeEventCss.ts — cafe_events overlay CSS 파일 업로드 (S234 후속)

   책임:
   - .css 파일 사이즈/MIME 사전 검증 (UX — 실제 enforcement 는 RLS)
   - cafe-events 버킷 + prefix 'css/' (059 마이그)
   - public URL 반환 (custom_css_path 로 cafe_events 행에 저장)

   설계:
   - uploadCafeEventImage 패턴 답습. 차이는 MIME (text/css) 와 prefix ('css/').
   - 059 마이그가 cafe-events 버킷의 allowed_mime_types 에 text/css 추가.
   ══════════════════════════════════════════════════════════════════════════ */

import { supabase } from '@/lib/supabase';
import { MAX_FILE_BYTES } from './imageUploadShared';
import type { UploadResult } from './imageUploadShared';
import { CAFE_EVENT_BUCKET } from './uploadCafeEventImage';

const CSS_MIME = ['text/css'] as const;
const CSS_EXT_RE = /\.css$/i;

function buildObjectPath(file: File): string {
  const ts = Date.now();
  const safe = file.name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, '-')
    .replace(/-+/g, '-')
    .slice(-60);
  return `css/${ts}-${safe}`;
}

export async function uploadCafeEventCss(file: File): Promise<UploadResult> {
  /* 1) 사전 검증 — 크기 + MIME + 확장자 */
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      error: 'too_large',
      detail: `${(file.size / 1024 / 1024).toFixed(1)}MB · 최대 5MB`,
    };
  }
  /* MIME 이 비어있는 경우 (운영자가 .css 파일 인식 불가 시) 확장자로 fallback */
  const mimeOk = CSS_MIME.includes(file.type as (typeof CSS_MIME)[number]);
  const extOk = CSS_EXT_RE.test(file.name);
  if (!mimeOk && !extOk) {
    return {
      ok: false,
      error: 'unsupported_type',
      detail: `${file.type || 'unknown'} · .css 파일만 지원`,
    };
  }

  /* 2) Storage upload */
  const path = buildObjectPath(file);
  const { error: uploadError } = await supabase.storage
    .from(CAFE_EVENT_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: 'text/css',
      upsert: false,
    });

  if (uploadError) {
    const msg = uploadError.message ?? '';
    if (/unauthorized|forbidden|policy|admin/i.test(msg)) {
      return { ok: false, error: 'unauthorized', detail: msg.slice(0, 200) };
    }
    return { ok: false, error: 'upload_failed', detail: msg.slice(0, 200) };
  }

  /* 3) public URL */
  const { data } = supabase.storage.from(CAFE_EVENT_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    return { ok: false, error: 'public_url_failed' };
  }

  return { ok: true, publicUrl: data.publicUrl, path };
}
