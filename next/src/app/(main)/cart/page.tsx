/* ══════════════════════════════════════════
   Cart Route — /cart (Session 22 / 2026-04-18)
   프로토타입 #cart-page 풀페이지 이식 (BUG-003 옵션1).
   - CartDrawer 와 훅 공유 (useCartQuery / useUpdateCartQty / useRemoveCartItem)
   - 드로어 대비 확장 여지: 쿠폰·배송 정책·정기배송 편집 공간
   - (main) route group 의 SiteHeader·SiteFooter 재사용
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

export default function CartPage() {
  const { items, subtotal, totalPrice } = useCartQuery();
  const updateQty = useUpdateCartQty();
  const removeItem = useRemoveCartItem();
  const router = useRouter();
  const [clearOpen, setClearOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
    const el = rootRef.current;
    if (!el) return;
    el.classList.remove('cp-anim');
    void el.offsetHeight;
    el.classList.add('cp-anim');
  }, []);

  const isEmpty = items.length === 0;

  function handleClearAll() {
    items.forEach((item) => removeItem.mutate(item.id));
    setClearOpen(false);
  }
  const isFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
  const gaugePct = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);
  const remainForFree = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  function handleCheckout() {
    router.push('/checkout');
  }

  return (
    <>
    <div className="cp-root" ref={rootRef}>
      <div className="cp-page-header">
        <h1 className="cp-title-text">장바구니</h1>
        {!isEmpty && (
          <button
            type="button"
            className="cp-title-delete"
            aria-label="장바구니 전체 삭제"
            title="전체 삭제"
            onClick={() => setClearOpen(true)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10,11v6" />
              <path d="M14,11v6" />
              <path d="M19,6v14c0,1.1-.9,2-2,2H7c-1.1,0-2-.9-2-2V6" />
              <path d="M3,6h18" />
              <path d="M8,6v-2c0-1.1.9-2,2-2h4c1.1,0,2,.9,2,2v2" />
            </svg>
          </button>
        )}
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
            <button
              type="button"
              className="cp-th-delete"
              aria-label="장바구니 전체 삭제"
              title="전체 삭제"
              onClick={() => setClearOpen(true)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10,11v6" />
                <path d="M14,11v6" />
                <path d="M19,6v14c0,1.1-.9,2-2,2H7c-1.1,0-2-.9-2-2V6" />
                <path d="M3,6h18" />
                <path d="M8,6v-2c0-1.1.9-2,2-2h4c1.1,0,2,.9,2,2v2" />
              </svg>
            </button>
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
                        <span className="cp-item-meta-inline">
                          {` · ${[item.volume, subBadge, `${item.qty}개`].filter(Boolean).join(' · ')}`}
                        </span>
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
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16,8l-8,8" />
                      <path d="M8,8l8,8" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="cp-shipping-row">
            <div className="cp-shipping-main">
              <span className="cp-shipping-label">배송비</span>
              <span className="cp-shipping-notice">
                {isFreeShipping
                  ? '무료 배송이 적용됩니다.'
                  : `${remainForFree.toLocaleString('ko-KR')}원 더 구매하시면 무료 배송됩니다.`}
              </span>
              <span className={`cp-shipping-price${isFreeShipping ? ' free' : ''}`}>
                {isFreeShipping ? '무료' : formatWon(SHIPPING_FEE)}
              </span>
            </div>
            {!isFreeShipping && subtotal > 0 && (
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
              >
                주문하기
              </button>
            </div>
          </div>
        </>
      )}

    </div>
    {mounted && clearOpen && createPortal(
      <div
        className="mp-modal-overlay"
        style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
        onClick={() => setClearOpen(false)}
      >
        <div className="mp-modal mp-modal--calm" onClick={(e) => e.stopPropagation()}>
          <p className="mp-modal-title">장바구니를 비우시겠어요?</p>
          <p className="mp-modal-desc">
            담으신 모든 상품이 삭제됩니다.<br />
            이 작업은 되돌릴 수 없습니다.
          </p>
          <div className="mp-modal-actions">
            <button className="mp-modal-confirm" type="button" onClick={handleClearAll}>
              전체 삭제
            </button>
            <button className="mp-modal-cancel" type="button" onClick={() => setClearOpen(false)}>
              취소
            </button>
          </div>
        </div>
      </div>,
      document.body,
    )}
    </>
  );
}
