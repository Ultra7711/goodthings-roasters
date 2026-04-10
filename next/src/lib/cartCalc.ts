/* ══════════════════════════════════════════
   cartCalc
   장바구니 금액 계산 공통 유틸
   CartDrawer·CartPageView에서 공유 (DRY)
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

/** 카트 아이템 리스트로부터 총액 세트 계산. */
export function calcCartTotals(items: CartItem[]): CartTotals {
  const subtotal = items.reduce((sum, i) => sum + i.priceNum * i.qty, 0);
  const totalQty = items.reduce((sum, i) => sum + i.qty, 0);
  const isFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
  const shipping = subtotal === 0 ? 0 : isFreeShipping ? 0 : SHIPPING_FEE;
  const total = subtotal + shipping;

  return { subtotal, shipping, total, isFreeShipping, totalQty };
}
