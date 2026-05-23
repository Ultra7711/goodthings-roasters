/* ══════════════════════════════════════════════════════════════════════════
   /mypage server actions (S253 마이페이지 최적화)

   - getShowcaseProducts: WelcomeCard 가 client mount 후 호출.
     fetchProducts ('use cache') 를 server 에서 wrap → 5% 신규 사용자만 호출.
     95%+ 기존 사용자에겐 RSC tree 의 dead prop 부담 0.
   ══════════════════════════════════════════════════════════════════════════ */

'use server';

import { fetchProducts } from '@/lib/productsServer';
import type { Product } from '@/lib/products';

export async function getShowcaseProducts(): Promise<Product[]> {
  try {
    return await fetchProducts();
  } catch (err) {
    console.error('[getShowcaseProducts] failed', err);
    return [];
  }
}
