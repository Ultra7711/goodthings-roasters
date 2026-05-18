/* ══════════════════════════════════════════════════════════════════════════
   uploadSignatureHtml.ts — signature 운영자 HTML 파일 업로드 (S237 · 062)

   책임:
   - .html 파일 사이즈/MIME 사전 검증 (UX — 실제 enforcement 는 RLS)
   - season-banners 버킷 + prefix 'signature/html/' (062 마이그)
   - public URL 반환 (custom_html_path 로 site_settings.signature payload 에 저장)

   설계:
   - uploadCafeEventHtml.ts 답습. 버킷·prefix 만 변경.
   - 062 마이그가 season-banners 버킷의 allowed_mime_types 에 text/html 추가.
   - SignatureChapter 가 <iframe sandbox="allow-same-origin"> 으로 임베드 →
     운영자 HTML 의 <script> 차단.
   ══════════════════════════════════════════════════════════════════════════ */

import { supabase } from '@/lib/supabase';
import { SEASON_BANNER_BUCKET, MAX_FILE_BYTES } from './imageUploadShared';
import type { UploadResult } from './imageUploadShared';

const HTML_MIME = ['text/html'] as const;
const HTML_EXT_RE = /\.html?$/i;

function buildObjectPath(file: File): string {
  const ts = Date.now();
  const safe = file.name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, '-')
    .replace(/-+/g, '-')
    .slice(-60);
  return `signature/html/${ts}-${safe}`;
}

export async function uploadSignatureHtml(file: File): Promise<UploadResult> {
  /* 1) 사전 검증 — 크기 + MIME + 확장자 */
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      error: 'too_large',
      detail: `${(file.size / 1024 / 1024).toFixed(1)}MB · 최대 5MB`,
    };
  }
  /* MIME 이 비어있는 경우 (운영자가 .html 파일 인식 불가 시) 확장자로 fallback */
  const mimeOk = HTML_MIME.includes(file.type as (typeof HTML_MIME)[number]);
  const extOk = HTML_EXT_RE.test(file.name);
  if (!mimeOk && !extOk) {
    return {
      ok: false,
      error: 'unsupported_type',
      detail: `${file.type || 'unknown'} · .html 파일만 지원`,
    };
  }

  /* 2) Storage upload */
  const path = buildObjectPath(file);
  const { error: uploadError } = await supabase.storage
    .from(SEASON_BANNER_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: 'text/html',
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
  const { data } = supabase.storage.from(SEASON_BANNER_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    return { ok: false, error: 'public_url_failed' };
  }

  return { ok: true, publicUrl: data.publicUrl, path };
}
