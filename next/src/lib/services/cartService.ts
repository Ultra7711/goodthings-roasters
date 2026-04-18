/* ══════════════════════════════════════════════════════════════════════════
   cartService.ts — 장바구니 비즈 로직 (Session 12)

   역할:
   - 클라 입력(slug + volume + qty + type + period)을 서버 권위로 재구성.
   - 단가 스냅샷(unit_price_snapshot) 을 PRODUCTS 카탈로그 기준으로 계산.
   - orderService 의 resolveProduct/resolveVolume 재사용 (동일 검증 규칙).

   에러:
   - OrderServiceError('product_not_found' | 'volume_not_found' | 'volume_sold_out' |
     'subscription_not_allowed') 를 그대로 전파. Route Handler 에서 매핑.
   ══════════════════════════════════════════════════════════════════════════ */

import {
  resolveProduct,
  resolveVolume,
  OrderServiceError,
} from '@/lib/services/orderService';
import type { CartItemInput, CartMergeInput } from '@/lib/schemas/cart';
import {
  upsertCartItem,
  bulkMergeCartItems,
  type CartItemRow,
  type UpsertCartItemParams,
  type BulkMergeItem,
} from '@/lib/repositories/cartRepo';

/* ── 입력 → repo 파라미터 ─────────────────────────────────────────────── */

/**
 * 카트 입력을 PRODUCTS 기준으로 검증·재구성.
 * 가격 계산은 orderService.buildRpcItem 과 동일 규칙 (현재 할인 없음).
 */
export function buildUpsertParams(
  userId: string,
  input: CartItemInput,
): UpsertCartItemParams {
  const product = resolveProduct(input.productSlug);

  if (input.itemType === 'subscription' && !product.subscription) {
    throw new OrderServiceError('subscription_not_allowed', product.slug);
  }

  const volume = resolveVolume(product, input.volume);

  return {
    userId,
    productSlug: product.slug,
    productVolume: volume.label,
    quantity: input.quantity,
    unitPriceSnapshot: volume.price,
    itemType: input.itemType,
    subscriptionPeriod: input.subscriptionPeriod ?? null,
  };
}

/* ══════════════════════════════════════════
   진입점 — addCartItem
   ══════════════════════════════════════════ */

export async function addCartItem(
  userId: string,
  input: CartItemInput,
): Promise<CartItemRow> {
  const params = buildUpsertParams(userId, input);
  return upsertCartItem(params);
}

/* ══════════════════════════════════════════
   진입점 — mergeGuestCart (로그인 직후 localStorage 흡수)
   ══════════════════════════════════════════ */

/**
 * 게스트 카트 배열을 회원 카트에 일괄 merge (C-M3: bulk RPC).
 *
 * 동작:
 * - 서비스 레이어에서 PRODUCTS 카탈로그 검증 수행 (buildUpsertParams).
 *   실패 아이템은 skipped 로 카운트하고 제외.
 * - 검증 통과 아이템 전체를 단일 RPC(merge_cart_items) 로 원자적 upsert.
 * - 중복 아이템(동일 키) 은 RPC 내부에서 quantity 합산 (상한 99).
 *
 * @returns { merged, skipped }
 */
export async function mergeGuestCart(
  userId: string,
  input: CartMergeInput,
): Promise<{ merged: number; skipped: number }> {
  let skipped = 0;
  const bulkItems: BulkMergeItem[] = [];

  for (const item of input.items) {
    try {
      const params = buildUpsertParams(userId, item);
      bulkItems.push({
        productSlug: params.productSlug,
        productVolume: params.productVolume,
        quantity: params.quantity,
        unitPriceSnapshot: params.unitPriceSnapshot,
        itemType: params.itemType,
        subscriptionPeriod: params.subscriptionPeriod,
      });
    } catch (err) {
      if (err instanceof OrderServiceError) {
        skipped += 1;
        continue;
      }
      throw err;
    }
  }

  const merged = await bulkMergeCartItems(userId, bulkItems);
  return { merged, skipped };
}
