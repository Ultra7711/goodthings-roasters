/* ══════════════════════════════════════════
   _constants.ts — /admin/products 공유 상수 (S256-B v2)

   Next.js 16 `'use server'` 파일은 export async function 만 허용
   (React 19 spec · feedback_use_server_async_only.md).
   따라서 productActions.ts / imageActions.ts 양쪽에서 사용하는 보조
   상수는 본 모듈로 격리 — 'use server' 디렉티브 없음.
   ══════════════════════════════════════════ */

/** Supabase Storage 버킷 이름 — 상품 이미지 갤러리. */
export const PRODUCT_IMAGES_BUCKET = 'product-images';
