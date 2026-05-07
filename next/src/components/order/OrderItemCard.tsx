/* ══════════════════════════════════════════
   OrderItemCard — 주문 아이템 카드 (공유)
   사용처:
   - components/checkout/OrderCompletePage.tsx (variant="compact")
   - components/auth/mypage/OrderHistory.tsx (variant="detailed")

   S181 — globals.css .ocp-item* (line 7445-7492) +
   .mp-order-items .ocp-item-* (8294-8299, 8466-8530) 이관 + .order-item* 으로 rename.

   variant 차이:
   | 항목       | compact (OrderComplete)         | detailed (OrderHistory) |
   |-----------|--------------------------------|------------------------|
   | Image     | width/height=100, contain       | fill + sizes="80px", cover, position:relative |
   | onClick   | 없음                            | onImageClick(slug) (image stopPropagation) |
   | name      | extractKrName(name)             | <-name-kr>extractKrName + <-meta-inline>volume</></> |
   | qty join  | volume · 정기 · 수량N개         | 정기 · 수량N개 (volume 은 name 안) |
   | price     | priceNum × qty (라인 합계)      | priceNum (호출처가 라인 합계 전달) |
   ══════════════════════════════════════════ */

'use client';

import Image from 'next/image';
import type { MouseEvent } from 'react';
import { extractKrName, formatPrice } from '@/lib/utils';
import './OrderItemCard.css';

export type OrderItemCardVariant = 'compact' | 'detailed';

export type OrderItemCardData = {
  name: string;
  /** 상품 slug — detailed variant 의 image click navigation 에서 사용 */
  slug?: string;
  category: string;
  /** 용량 (예: "200g"). compact 는 qty 행에 join, detailed 는 name 안 inline */
  volume?: string | null;
  qty: number;
  /** 단가 — compact 는 내부에서 ×qty 적용, detailed 는 호출처가 라인 합계로 전달 */
  priceNum: number;
  image?: { src: string; bg: string };
  type?: string;
  period?: string | null;
};

interface OrderItemCardProps {
  item: OrderItemCardData;
  variant: OrderItemCardVariant;
  /** detailed variant 에서 image 클릭 시 호출. slug 가 없으면 무시. */
  onImageClick?: (slug: string) => void;
}

export default function OrderItemCard({
  item,
  variant,
  onImageClick,
}: OrderItemCardProps) {
  const isDetailed = variant === 'detailed';

  const displayPrice = isDetailed ? item.priceNum : item.priceNum * item.qty;

  const periodToken =
    item.type === 'subscription' && item.period ? `정기배송 ${item.period}` : null;
  const qtyParts = isDetailed
    ? [periodToken, `수량 ${item.qty}개`]
    : [item.volume, periodToken, `수량 ${item.qty}개`];
  const qtyText = qtyParts.filter(Boolean).join(' · ');

  const canImageClick = isDetailed && onImageClick && item.slug;
  const handleImageClick = canImageClick
    ? (e: MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        onImageClick!(item.slug!);
      }
    : undefined;

  return (
    <div className="order-item-card" data-variant={variant}>
      <div
        className="order-item-img"
        style={{ background: item.image?.bg ?? 'transparent' }}
        onClick={handleImageClick}
      >
        {item.image?.src &&
          (isDetailed ? (
            <Image
              src={item.image.src}
              alt={item.name}
              fill
              style={{ objectFit: 'cover' }}
              sizes="80px"
            />
          ) : (
            <Image
              src={item.image.src}
              alt={item.name}
              width={100}
              height={100}
              style={{ objectFit: 'contain' }}
            />
          ))}
      </div>
      <div className="order-item-info">
        <div className="order-item-category">{item.category}</div>
        <div className="order-item-name">
          {isDetailed ? (
            <span className="order-item-name-kr">
              {extractKrName(item.name)}
              {item.volume && (
                <span className="order-item-meta-inline"> · {item.volume}</span>
              )}
            </span>
          ) : (
            extractKrName(item.name)
          )}
        </div>
        <div className="order-item-badges">
          <span className="order-item-qty">{qtyText}</span>
          <span className="order-item-price">{formatPrice(displayPrice)}</span>
        </div>
      </div>
    </div>
  );
}
