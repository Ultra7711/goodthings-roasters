/* ══════════════════════════════════════════
   Shop Route — /shop (S69)
   /menu 패턴으로 통일 — Suspense + client useSearchParams.
   - 이전: `async` + `await searchParams` → dynamic 요소로 PPR (◐)
   - 현재: server component 는 Suspense 만 · filter 는 ShopPage 가 직접 읽음
   - 결과: Static (○) 라우트 · Router Cache + Activity 보존 → 재진입 시
     DOM 유지 · 연출 중복 없음 · /menu 와 동일 UX
   ══════════════════════════════════════════ */

import { Suspense } from 'react';
import { connection } from 'next/server';
import ShopPage from '@/components/shop/ShopPage';
import ShopSkeleton from '@/components/shop/ShopSkeleton';
import { fetchProducts } from '@/lib/productsServer';

export const metadata = { title: '모든 상품' };

export default async function ShopRoute() {
  /* S279-D · DEC-S279-D-1: productsServer 의 'use cache' 폐기로
     caller 측 connection() 명시 — admin 변경 즉시 메인 반영 보장. */
  await connection();
  const products = await fetchProducts();
  return (
    <Suspense fallback={<ShopSkeleton />}>
      <ShopPage products={products} />
    </Suspense>
  );
}
