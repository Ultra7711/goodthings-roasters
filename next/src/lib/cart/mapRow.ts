/* ══════════════════════════════════════════════════════════════════════════
   mapRow.ts — Cart DB row → CartItem 매핑 (S199)

   server / client 공용. server prefetch (app/(main)/cart/page.tsx) 와
   client fetch (hooks/useCart.ts fetchCart) 양쪽에서 동일하게 사용.

   PRODUCTS 정적 데이터에 의존. row 의 product_slug 가 PRODUCTS 에 없으면 null.
   ══════════════════════════════════════════════════════════════════════════ */

import type { CartItem } from '@/types/cart';
import type { Product } from '@/lib/products';
import { parsePrice } from '@/lib/utils';

export type ServerCartRow = {
  id: string;
  user_id: string;
  product_slug: string;
  product_volume: string;
  quantity: number;
  unit_price_snapshot: number;
  item_type: CartItem['type'];
  subscription_period: string | null;
  created_at: string;
  updated_at: string;
};

export function mapRowToCartItem(row: ServerCartRow, products: Product[]): CartItem | null {
  const product = products.find((p) => p.slug === row.product_slug);
  if (!product) {

    console.warn('[cart] product not found: slug="%s"', row.product_slug);
    return null;
  }
  const firstImage = product.images?.[0];
  return {
    id: row.id,
    slug: row.product_slug,
    name: product.name,
    price: product.price,
    priceNum: row.unit_price_snapshot ?? parsePrice(product.price),
    qty: row.quantity,
    color: firstImage?.bg ?? product.color ?? '#ECEAE6',
    image: firstImage?.src ?? null,
    type: row.item_type,
    period: row.subscription_period,
    category: product.category,
    volume: row.product_volume,
  };
}
