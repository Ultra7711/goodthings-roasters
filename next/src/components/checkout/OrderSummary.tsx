/* ══════════════════════════════════════════
   OrderSummary — /checkout 우측 주문 요약
   items list + 상품금액 / 배송비 / 결제예정금액 + 정기배송 합계.
   ══════════════════════════════════════════ */

'use client';

import Image from 'next/image';
import type { CartItem } from '@/types/cart';
import { extractKrName, formatPrice } from '@/lib/utils';

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
          <div key={item.id} className="chp-sum-item">
            <div className="chp-sum-item-img-wrap">
              <div className="chp-sum-item-img" style={{ background: item.color }}>
                {item.image && (
                  <Image src={item.image} alt={item.name} width={56} height={56} style={{ objectFit: 'contain' }} />
                )}
              </div>
            </div>
            <div className="chp-sum-item-info">
              <div className="chp-sum-item-name">{extractKrName(item.name)}</div>
              <span className="chp-sum-item-meta">
                {[item.volume, item.type === 'subscription' && item.period ? `정기배송 ${item.period}` : null, `${item.qty}개`].filter(Boolean).join(' · ')}
              </span>
            </div>
            <div className="chp-sum-item-price">{formatPrice(item.priceNum * item.qty)}</div>
          </div>
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
