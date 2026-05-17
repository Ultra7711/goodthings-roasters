/* ══════════════════════════════════════════════════════════════════════════
   uploadSignatureImage.ts — 시그니처 chapter 이미지 업로드 (S148 PR-2)

   책임:
   - 파일 사이즈/MIME 클라이언트 사전 검증 (UX — 실제 enforcement 는 RLS)
   - season-banners 버킷 재사용 (S148 결정 D-3) · prefix `signature/` 로 시즌 배너와 분리
   - public URL 반환 (image_path 로 site_settings.signature 에 저장)

   설계:
   - 028_admin_storage_buckets.sql 의 season-banners 버킷이 시즌 자산 의미와 일치 →
     별도 버킷 마이그레이션 없이 prefix 분리만으로 운영 (S148 D-3 채택).
   - imageUploadShared 의 검증·에러 매핑 패턴 답습. 차이는 prefix `signature/` 와 export 명만.
   ══════════════════════════════════════════════════════════════════════════ */

import { supabase } from '@/lib/supabase';
import { SEASON_BANNER_BUCKET, MAX_FILE_BYTES, ALLOWED_MIME } from './imageUploadShared';
import type { UploadResult } from './imageUploadShared';

/** 파일명 안전화 + 타임스탬프 prefix → 캐시 무효화 + 충돌 방지.
    `signature/` prefix 로 시즌 배너 자산과 분리. */
function buildObjectPath(file: File): string {
  const ts = Date.now();
  const safe = file.name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, '-')
    .replace(/-+/g, '-')
    .slice(-60);
  return `signature/${ts}-${safe}`;
}

export async function uploadSignatureImage(file: File): Promise<UploadResult> {
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
    .from(SEASON_BANNER_BUCKET)
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

  const { data } = supabase.storage.from(SEASON_BANNER_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    return { ok: false, error: 'public_url_failed' };
  }

  return { ok: true, publicUrl: data.publicUrl, path };
}
