/* ══════════════════════════════════════════
   CartClient — Stage E (S67 / 2026-04-24)
   /cart 페이지의 client island.
   - 기존 page.tsx 의 body 전체를 이동 (로직 무변경)
   - page.tsx 는 server component 로 전환되어 라우트 경계가 server 에 고정
   - BUG-006 Stage E: client boundary 를 page 전체 → CartClient 단일 island 로 축소
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useCartQuery,
  useUpdateCartQty,
  useRemoveCartItem,
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FEE,
} from '@/hooks/useCart';
import { splitName } from '@/lib/products';
import type { CartItem } from '@/types/cart';

function formatWon(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

function subBadgeLabel(item: CartItem): string | null {
  if (item.type !== 'subscription' || !item.period) return null;
  return item.period;
}

export default function CartClient() {
  const { items, subtotal, totalPrice } = useCartQuery();
  const updateQty = useUpdateCartQty();
  const removeItem = useRemoveCartItem();
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    el.classList.remove('cp-anim');
    void el.offsetHeight;
    el.classList.add('cp-anim');
  }, []);

  const isEmpty = items.length === 0;
  const isFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
  const gaugePct = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);
  const remainForFree = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  function handleCheckout() {
    router.push('/checkout');
  }

  return (
    <div className="cp-root" ref={rootRef}>
      <div className="cp-page-header">
        <h1 className="cp-title-text">장바구니</h1>
      </div>

      {isEmpty ? (
        <div className="cp-empty">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="cp-empty-icon"
            src="/images/icons/cart_big.svg"
            alt=""
            aria-hidden="true"
          />
          <p className="cp-empty-msg">장바구니가 비어 있습니다.</p>
          <Link href="/shop" className="cp-continue-link">
            쇼핑 계속하기
          </Link>
        </div>
      ) : (
        <>
          <div className="cp-table-hdr">
            <span className="cp-th-product">상품</span>
            <span className="cp-th-price">가격</span>
            <span className="cp-th-qty">수량</span>
            <span className="cp-th-total">합계</span>
            <span className="cp-th-delete">삭제</span>
          </div>

          <div className="cp-items-list">
            {items.map((item) => {
              const { kr: krName } = splitName(item.name);
              const subBadge = subBadgeLabel(item);
              const unitTotal = item.priceNum * item.qty;
              const minusDisabled = item.qty <= 1;
              return (
                <div key={item.id} className="cp-item">
                  <div className="cp-item-product">
                    <div className="cp-item-thumb">
                      <Link
                        href={`/shop/${item.slug}`}
                        className="cp-item-img"
                        aria-label={`${item.name} 상세 보기`}
                      >
                        {item.image ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={item.image}
                            alt={item.name}
                            style={{ background: item.color }}
                          />
                        ) : (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            className="cp-item-img-empty"
                            src="/images/icons/image_empty.svg"
                            alt=""
                            aria-hidden="true"
                          />
                        )}
                      </Link>
                    </div>
                    <div className="cp-item-info">
                      <div className="cp-item-category">{item.category}</div>
                      <div className="cp-item-name">
                        <span className="cp-item-name-kr">{krName}</span>
                        {[item.volume, subBadge].some(Boolean) && (
                          <span className="cp-item-meta-inline">
                            {` ${[item.volume, subBadge].filter(Boolean).join(' · ')}`}
                          </span>
                        )}
                      </div>
                      {(item.volume || subBadge) && (
                        <div className="cp-item-badges">
                          {item.volume && (
                            <span className="cp-item-badge">{item.volume}</span>
                          )}
                          {subBadge && (
                            <span className="cp-item-badge">{subBadge}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="cp-item-price">{item.price}</span>
                  <div className="cp-item-qty">
                    <div className="cp-qty">
                      <button
                        type="button"
                        className={`cp-qty-btn${minusDisabled ? ' disabled' : ''}`}
                        aria-label="수량 감소"
                        disabled={minusDisabled}
                        onClick={() =>
                          updateQty.mutate({ id: item.id, delta: -1 })
                        }
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6.3,12h11.3" />
                        </svg>
                      </button>
                      <span className="cp-qty-num">{item.qty}</span>
                      <button
                        type="button"
                        className="cp-qty-btn"
                        aria-label="수량 증가"
                        onClick={() =>
                          updateQty.mutate({ id: item.id, delta: 1 })
                        }
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12,6.3v11.3" />
                          <path d="M6.3,12h11.3" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <span className="cp-item-total">{formatWon(unitTotal)}</span>
                  <button
                    type="button"
                    className="cp-remove"
                    aria-label={`${item.name} 삭제`}
                    title="삭제"
                    onClick={() => removeItem.mutate(item.id)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10,11v6" />
                      <path d="M14,11v6" />
                      <path d="M19,6v14c0,1.1-.9,2-2,2H7c-1.1,0-2-.9-2-2V6" />
                      <path d="M3,6h18" />
                      <path d="M8,6v-2c0-1.1.9-2,2-2h4c1.1,0,2,.9,2,2v2" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="cp-shipping-row">
            <div className="cp-shipping-main">
              <span className="cp-shipping-label">배송비</span>
              <span className={`cp-shipping-notice${isFreeShipping ? ' free' : ''}`}>
                {isFreeShipping
                  ? '무료 배송이 적용됩니다.'
                  : `${remainForFree.toLocaleString('ko-KR')}원 더 구매하시면 무료 배송됩니다.`}
              </span>
              <span className={`cp-shipping-price${isFreeShipping ? ' free' : ''}`}>
                {isFreeShipping ? '무료' : formatWon(SHIPPING_FEE)}
              </span>
            </div>
            {subtotal > 0 && (
              <div className="shipping-gauge">
                <div
                  className="shipping-gauge-fill"
                  style={{ width: `${gaugePct}%` }}
                />
              </div>
            )}
          </div>

          <div className="cp-footer">
            <span className="cp-subtotal-label">결제예정금액</span>
            <span className="cp-subtotal-price">{formatWon(totalPrice)}</span>
            <div className="cp-tax-note">부가세 포함</div>
            <div className="cp-cta-area">
              <Link href="/shop" className="cp-continue-link">
                쇼핑 계속하기
              </Link>
              <button
                className="cp-order-btn"
                type="button"
                onClick={handleCheckout}
                data-gtr-tap
              >
                주문하기
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
