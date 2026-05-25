'use server';

/* ══════════════════════════════════════════════════════════════════════════
   /mypage server actions — S282-P2 lazy fetch

   SubscriptionView 진입 시점에 client → server action 으로 products 호출.
   orders tab 사용자 90% 가 dead fetch 회피 (다운로드 -50~200KB).
   기존 page.tsx Promise.all 의 fetchProducts 폐기.
   ══════════════════════════════════════════════════════════════════════════ */

import { fetchProducts } from '@/lib/productsServer';
import type { Product } from '@/lib/products';

/**
 * S282-P2: SubscriptionView 진입 시 lazy fetch.
 * SubscriptionItem 아코디언 카드 매핑 (category/price/imageBg) 용.
 */
export async function getMypageProductsAction(): Promise<Product[]> {
  return fetchProducts();
}
