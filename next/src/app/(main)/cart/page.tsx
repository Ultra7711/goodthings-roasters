/* ══════════════════════════════════════════
   Cart Route — /cart (S199 server prefetch)

   인증 카트만 server prefetch — listCartItems() RLS 로 본인 행만 → mapRowToCartItem 변환
   → CartClient initialItems prop → TanStack Query initialData 로 SSR HTML 즉시 정확 렌더.

   게스트는 prefetch skip (claims 없음) → CartClient 내부 fetchCart 가 readGuestCart
   로 분기 → localStorage 사용 (변경 없음).

   prefetch 실패 시 빈 array fallback — UI 는 client fetch 로 복구 (자연 흐름).

   BUG-006 Stage E (S67): page.tsx server component 유지. cookies() 접근은
   inner async 컴포넌트로 분리 (cacheComponents Suspense 가드).
   ══════════════════════════════════════════ */

import { Suspense } from 'react';
import { connection } from 'next/server';
import CartClient from '@/components/cart/CartClient';
import CartSkeleton from '@/components/cart/CartSkeleton';
import { getClaims } from '@/lib/auth/getClaims';
import { listCartItems } from '@/lib/repositories/cartRepo';
import { mapRowToCartItem } from '@/lib/cart/mapRow';
import { fetchProducts } from '@/lib/productsServer';
import type { CartItem } from '@/types/cart';

async function CartWithPrefetch() {
  /* S279-D · DEC-S279-D-1: productsServer 'use cache' 폐기로 caller 측
     connection() 명시. getClaims() 의 cookies() 호출과 idempotent — 안전망. */
  await connection();
  const claims = await getClaims();

  if (!claims) {
    /* 게스트 — server prefetch skip. CartClient 가 client store / localStorage 처리. */
    return <CartClient />;
  }

  /* 인증 — server prefetch (실패 시 빈 array fallback) */
  let initialItems: CartItem[] = [];
  try {
    const [rows, products] = await Promise.all([listCartItems(), fetchProducts()]);
    initialItems = rows
      .map((r) => mapRowToCartItem(r, products))
      .filter((i): i is CartItem => i !== null);
  } catch (err) {
    console.error('[cart.prefetch] failed', err);
  }

  return <CartClient initialItems={initialItems} />;
}

export default function CartPage() {
  return (
    <Suspense fallback={<CartSkeleton />}>
      <CartWithPrefetch />
    </Suspense>
  );
}
