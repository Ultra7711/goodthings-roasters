/* ══════════════════════════════════════════
   Shop Route — /shop (S69)
   /menu 패턴으로 통일 — Suspense + client useSearchParams.
   - 이전: `async` + `await searchParams` → dynamic 요소로 PPR (◐)
   - 현재: server component 는 Suspense 만 · filter 는 ShopPage 가 직접 읽음
   - 결과: Static (○) 라우트 · Router Cache + Activity 보존 → 재진입 시
     DOM 유지 · 연출 중복 없음 · /menu 와 동일 UX
   ══════════════════════════════════════════ */

import { Suspense } from 'react';
import ShopPage from '@/components/shop/ShopPage';
import ShopSkeleton from '@/components/shop/ShopSkeleton';
import { fetchProducts } from '@/lib/productsServer';

export const metadata = {
  title: '모든 상품',
  description: '굳띵즈 로스터스의 스페셜티 원두 전체 라인업. 갓 로스팅한 싱글 오리진과 블렌드를 만나보세요.',
  alternates: { canonical: '/shop' },
};

export default async function ShopRoute() {
  /* S323 (ADR-012): S321 에서 productsServer 'use cache' + cacheLife(60s) 복원.
     admin 변경 즉시 반영은 revalidateTag(PRODUCTS_CACHE_TAG, 'max') 가 담당 →
     caller connection() 불필요 → 정적 prerender (Active CPU 절감). */
  const products = await fetchProducts();
  return (
    <Suspense fallback={<ShopSkeleton />}>
      <ShopPage products={products} />
    </Suspense>
  );
}
