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
  type CartItemRow,
  type UpsertCartItemParams,
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
 * 게스트 카트 배열을 회원 카트에 순차 merge.
 *
 * - 중복 아이템(동일 키) 은 repo 의 upsertCartItem 이 quantity 합산 처리.
 * - 실패 아이템(product/volume not found 등) 은 스킵하고 남은 항목 진행.
 *   → 클라는 "N 개 중 M 개 담김" 형태로 표현 가능.
 *
 * @returns 성공 적재된 행 수
 */
export async function mergeGuestCart(
  userId: string,
  input: CartMergeInput,
): Promise<{ merged: number; skipped: number }> {
  let merged = 0;
  let skipped = 0;

  for (const item of input.items) {
    try {
      const params = buildUpsertParams(userId, item);
      await upsertCartItem(params);
      merged += 1;
    } catch (err) {
      /* 알려진 도메인 에러는 스킵. 그 외 DB 오류는 상위로 전파. */
      if (err instanceof OrderServiceError) {
        skipped += 1;
        continue;
      }
      throw err;
    }
  }

  return { merged, skipped };
}
