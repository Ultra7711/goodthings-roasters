/* ══════════════════════════════════════════
   OrderItemsSection — /order-complete §3 (자문 D editorial confirmation)
   주문 상품 + 결제 금액.

   설계 결정 (S201):
   - 아이템 라인 = `<OrderItemRow variant="readonly">` 통합 컴포넌트 차용
     (cart drawer / cart page / order summary 와 시각 정합 목표).
   - 합계 표 (oc-totals*): 자문 D §3.3 spec 유지 (max-width 360 우측).
   ══════════════════════════════════════════ */

'use client';

import { formatPrice } from '@/lib/utils';
import OrderItemRow from '@/components/order/OrderItemRow';
import type { StoredOrderItem } from '@/types/order';
import './OrderItemsSection.css';

type OrderItemsSectionProps = {
  items: StoredOrderItem[];
  subtotalAmount: number;
  /** 양수일 때만 row 렌더 (undefined / 0 → hide) */
  discountAmount?: number;
  /** 라벨 (예: "정기배송 할인 (10%)"). 없으면 "정기배송 할인" fallback. */
  discountLabel?: string;
  shippingFee: number;
  totalAmount: number;
};

export default function OrderItemsSection({
  items,
  subtotalAmount,
  discountAmount,
  discountLabel,
  shippingFee,
  totalAmount,
}: OrderItemsSectionProps) {
  const showDiscount = typeof discountAmount === 'number' && discountAmount > 0;
  const shippingDisplay = shippingFee === 0 ? '무료' : formatPrice(shippingFee);

  return (
    <section className="oc-section">
      {/* 아이템 리스트 — 통합 OrderItemRow readonly variant */}
      <div className="oc-section__items">
        {items.map((item, idx) => (
          <OrderItemRow key={idx} item={item} variant="readonly" />
        ))}
      </div>

      {/* 합계 — 자문 D §3.3 spec 유지 (max-width 360 우측) */}
      <div className="oc-section__totals">
        <div className="oc-totals__row">
          <span>상품 금액</span>
          <span className="oc-totals__num oc-totals__num--subtotal">{formatPrice(subtotalAmount)}</span>
        </div>
        {showDiscount && (
          <div className="oc-totals__row oc-totals__row--discount">
            <span>{discountLabel ?? '정기배송 할인'}</span>
            <span className="oc-totals__num">−{formatPrice(discountAmount!)}</span>
          </div>
        )}
        <div className="oc-totals__row">
          <span>배송비</span>
          <span className={`oc-totals__num${shippingFee === 0 ? ' oc-totals__num--free' : ''}`}>
            {shippingDisplay}
          </span>
        </div>
        <div className="oc-totals__row oc-totals__row--grand">
          <span>결제 금액</span>
          <div className="oc-totals__grand-right">
            <span className="oc-totals__num">{formatPrice(totalAmount)}</span>
            <div className="oc-totals__tax">부가세 포함</div>
          </div>
        </div>
      </div>
    </section>
  );
}
