/* ══════════════════════════════════════════════════════════════════════════
   uploadSeasonBanner.ts — 시즌 배너 이미지 업로드 (S129 H-3)

   책임:
   - 파일 사이즈/MIME 클라이언트 사전 검증 (UX — 실제 enforcement 는 RLS)
   - season-banners 버킷에 upload (admin only · 028_admin_storage_buckets.sql)
   - public URL 반환 (image_path 로 site_settings.season 에 저장)

   진행률:
   - Supabase JS v2 의 storage.upload() 는 progress 콜백 미지원.
   - UX 단순화: indeterminate "업로드 중" 상태 + 완료 시 100%.
   - 정확한 진행률이 필요해지면 추후 signed URL + XHR 로 교체.
   ══════════════════════════════════════════════════════════════════════════ */

import { supabase } from '@/lib/supabase';

export const SEASON_BANNER_BUCKET = 'season-banners';
export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB (028 버킷 limit 일치)
export const ALLOWED_MIME = [
  'image/webp',
  'image/avif',
  'image/jpeg',
  'image/png',
] as const;

export type UploadResult =
  | { ok: true; publicUrl: string; path: string }
  | {
      ok: false;
      error:
        | 'too_large'
        | 'unsupported_type'
        | 'unauthorized'
        | 'upload_failed'
        | 'public_url_failed';
      detail?: string;
    };

/** 파일명 안전화 + 타임스탬프 prefix → 캐시 무효화 + 충돌 방지 */
function buildObjectPath(file: File): string {
  const ts = Date.now();
  const safe = file.name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, '-')
    .replace(/-+/g, '-')
    .slice(-60);
  return `season/${ts}-${safe}`;
}

export async function uploadSeasonBanner(file: File): Promise<UploadResult> {
  /* 1) 사전 검증 */
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

  /* 2) Storage upload */
  const path = buildObjectPath(file);
  const { error: uploadError } = await supabase.storage
    .from(SEASON_BANNER_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    /* RLS 차단 → 401/403 매핑. 메시지 형식이 일관되지 않아 휴리스틱. */
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
