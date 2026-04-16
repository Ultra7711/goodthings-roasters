/* ══════════════════════════════════════════
   cartCalc
   장바구니 금액 계산 공통 유틸
   CartDrawer·CartPageView·orderService 에서 공유 (DRY)

   Pass 1 CODE/H-2: calcShippingFee 를 여기로 승격하여
   프런트·서버가 동일한 배송비 규칙을 import 해 사용하도록 한다.
   ══════════════════════════════════════════ */

import type { CartItem } from '@/types/cart';
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from './store';

export type CartTotals = {
  /** 상품 소계 (수량 포함) */
  subtotal: number;
  /** 배송비 (무료 배송 / 빈 카트 고려) */
  shipping: number;
  /** 결제예정금액 (subtotal + shipping) */
  total: number;
  /** 무료 배송 해당 여부 */
  isFreeShipping: boolean;
  /** 전체 수량 합계 */
  totalQty: number;
};

/**
 * 배송비 계산 — 프런트·서버 단일 소스.
 *
 * 정책 (프로토타입 기준):
 * - subtotal === 0       → 0원 (빈 카트)
 * - subtotal >= 30,000   → 0원 (무료 배송)
 * - 그 외                → 3,000원
 *
 * 정책 상수는 {@link FREE_SHIPPING_THRESHOLD}, {@link SHIPPING_FEE}.
 */
export function calcShippingFee(subtotal: number): number {
  if (subtotal === 0) return 0;
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
}

/** 카트 아이템 리스트로부터 총액 세트 계산. */
export function calcCartTotals(items: CartItem[]): CartTotals {
  const subtotal = items.reduce((sum, i) => sum + i.priceNum * i.qty, 0);
  const totalQty = items.reduce((sum, i) => sum + i.qty, 0);
  const isFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
  const shipping = calcShippingFee(subtotal);
  const total = subtotal + shipping;

  return { subtotal, shipping, total, isFreeShipping, totalQty };
}
