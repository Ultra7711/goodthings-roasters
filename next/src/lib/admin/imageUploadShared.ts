/* ══════════════════════════════════════════════════════════════════════════
   imageUploadShared.ts — admin 이미지 업로드 공유 상수/타입 (S234 폴리싱)

   답습 source: uploadSignatureImage · uploadCafeEventImage
   - `season-banners` 버킷은 시그니처/cafe-event 가 prefix 로 공유 (S148 D-3).
   - 버킷 rename 은 별 sprint 로 분리 (마이그 + storage policy 갱신 필요) — carry-over.
   ══════════════════════════════════════════════════════════════════════════ */

export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB (028 admin storage buckets RLS limit)
export const ALLOWED_MIME = [
  'image/webp',
  'image/avif',
  'image/jpeg',
  'image/png',
] as const;

export type UploadResult =
  | {
      ok: true;
      publicUrl: string;
      path: string;
      /** S246: 업로드 직후 server action 으로 생성한 LQIP base64 dataURL.
          plaiceholder 실패 시 undefined — caller 는 빈 문자열로 DB 저장. */
      blurDataURL?: string;
    }
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
