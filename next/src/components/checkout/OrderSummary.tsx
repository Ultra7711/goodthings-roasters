/* ══════════════════════════════════════════
   OrderSummary — /checkout 우측 주문 요약
   items list + 상품금액 / 배송비 / 결제예정금액 + 정기배송 합계.

   S201 — items 라인을 통합 OrderItemRow (variant="readonly") 로 교체.
   chp-sum-item* 패턴 폐기 → cart drawer / cart page / order complete 와 시각 정합.
   ══════════════════════════════════════════ */

'use client';

import OrderItemRow from '@/components/order/OrderItemRow';
import type { CartItem } from '@/types/cart';
import { formatPrice } from '@/lib/utils';

type OrderSummaryProps = {
  items: CartItem[];
  totalQty: number;
  subtotal: number;
  shippingFee: number;
  totalPrice: number;
  hasSubscription: boolean;
};

export default function OrderSummary({
  items,
  totalQty,
  subtotal,
  shippingFee,
  totalPrice,
  hasSubscription,
}: OrderSummaryProps) {
  return (
    <div className="chp-right">
      <div className="chp-right-title">주문 요약</div>
      <div>
        {items.map((item) => (
          <OrderItemRow
            key={item.id}
            variant="readonly"
            item={{
              name: item.name,
              category: item.category,
              volume: item.volume,
              type: item.type,
              period: item.period,
              qty: item.qty,
              priceNum: item.priceNum,
              image: { src: item.image, bg: item.color },
            }}
          />
        ))}
      </div>

      <div className="chp-summary-totals">
        <div className="chp-sum-row">
          <span>상품 금액 · 총 {totalQty}개 상품</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="chp-sum-row">
          <span>배송비</span>
          <span>{shippingFee === 0 ? '무료' : formatPrice(shippingFee)}</span>
        </div>
        <div className="chp-sum-total-row">
          <span>결제예정금액</span>
          <span>{formatPrice(totalPrice)}</span>
        </div>
        <div className="chp-tax-note">부가세 포함</div>
        {hasSubscription && (
          <div className="chp-sum-sub-block">
            <span>정기배송 금액</span>
            <span>
              {formatPrice(items.filter((i) => i.type === 'subscription').reduce((s, i) => s + i.priceNum * i.qty, 0))}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
