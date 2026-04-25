/* ══════════════════════════════════════════
   CartDrawer (Session 19 / 2026-04-18)
   프로토타입 #cart-drawer + openCartDrawer/renderCartDrawer 이식.

   - 우측 슬라이드인 드로어 (664px, CafeNutritionSheet 패턴 준수)
   - useCartDrawer context 에서 isOpen/close 수신
   - useCartQuery/useUpdateCartQty/useRemoveCartItem 으로 DB/게스트 카트 연동
   - ESC/배경/닫기버튼 3종 지원 (useDrawer 훅)
   - backdrop-filter 는 inline style (Tailwind v4 + Lightning CSS drop 회피)
   ══════════════════════════════════════════ */

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useCartQuery,
  useUpdateCartQty,
  useRemoveCartItem,
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FEE,
} from '@/hooks/useCart';
import { useCartDrawer } from '@/contexts/CartDrawerContext';
import { useDrawer } from '@/hooks/useDrawer';
import { splitName } from '@/lib/products';
import type { CartItem } from '@/types/cart';

function formatWon(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

function subBadgeLabel(item: CartItem): string | null {
  if (item.type !== 'subscription' || !item.period) return null;
  return item.period;
}

export default function CartDrawer() {
  const { isOpen, close, closeForNavigation } = useCartDrawer();
  const { items, totalQty, subtotal, totalPrice } = useCartQuery();
  const updateQty = useUpdateCartQty();
  const removeItem = useRemoveCartItem();
  const router = useRouter();

  useDrawer({ open: isOpen, onClose: close });

  const isEmpty = items.length === 0;
  const isFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
  const gaugePct = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);
  const remainForFree = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  /* navigate 동반 close — history 조작 없이 state 만 false (router.push 와 충돌 방지) */
  function handleCheckout() {
    closeForNavigation();
    router.push('/checkout');
  }

  function handleViewCart() {
    closeForNavigation();
    router.push('/cart');
  }

  function handleContinueShopping() {
    closeForNavigation();
    router.push('/shop');
  }

  return (
    <div id="cart-drawer" className={isOpen ? 'open' : ''} aria-hidden={!isOpen}>
      <div
        id="cart-drawer-bg"
        onClick={close}
        style={{
          backdropFilter: 'var(--overlay-dim-blur)',
          WebkitBackdropFilter: 'var(--overlay-dim-blur)',
        }}
      />
      <div id="cart-drawer-panel" role="dialog" aria-modal="true" aria-label="장바구니">
        {/* 헤더 */}
        <div className={`cd-header${isEmpty ? ' cd-header--empty' : ''}`}>
          <div className="cd-title-wrap">
            <span className="cd-title">장바구니</span>
            <span className="cd-count">{totalQty}</span>
          </div>
          <button
            className="cd-close"
            type="button"
            aria-label="장바구니 닫기"
            onClick={close}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19,5l-14,14" />
              <path d="M5,5l14,14" />
            </svg>
          </button>
        </div>

        {/* 바디 */}
        <div className="cd-body">
          {isEmpty ? (
            <div className="cd-items">
              <div className="cd-empty">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="cd-empty-icon"
                  src="/images/icons/cart_big.svg"
                  alt=""
                  aria-hidden="true"
                />
                <p className="cd-empty-msg">장바구니가 비어 있습니다.</p>
                <button
                  className="cd-shop-btn"
                  type="button"
                  onClick={handleContinueShopping}
                >
                  쇼핑 계속하기
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="cd-items">
                {items.map((item) => {
                  const { kr: krName } = splitName(item.name);
                  const subBadge = subBadgeLabel(item);
                  const unitTotal = item.priceNum * item.qty;
                  const minusDisabled = item.qty <= 1;
                  return (
                    <div key={item.id} className="cd-item">
                      <div className="cd-item-thumb">
                        <Link
                          href={`/shop/${item.slug}`}
                          className="cd-item-img"
                          onClick={closeForNavigation}
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
                              className="cd-item-img-empty"
                              src="/images/icons/image_empty.svg"
                              alt=""
                              aria-hidden="true"
                            />
                          )}
                        </Link>
                      </div>
                      <div className="cd-item-category">{item.category}</div>
                      <div className="cd-item-name">
                        <span className="cd-item-name-kr">{krName}</span>
                        {[item.volume, subBadge].filter(Boolean).length > 0 && (
                          <span className="cd-item-meta-inline">
                            {` ${[item.volume, subBadge].filter(Boolean).join(' · ')}`}
                          </span>
                        )}
                      </div>
                      <div className="cd-item-bottom">
                        {item.volume && (
                          <span className="cd-item-sub-badge">{item.volume}</span>
                        )}
                        {subBadge && (
                          <span className="cd-item-sub-badge">{subBadge}</span>
                        )}
                        <span className="cd-item-unit-price">{item.price}</span>
                        <div className="cd-qty">
                          <button
                            type="button"
                            className={`cd-qty-btn${minusDisabled ? ' disabled' : ''}`}
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
                          <span className="cd-qty-num">{item.qty}</span>
                          <button
                            type="button"
                            className="cd-qty-btn"
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
                        <span className="cd-item-price">{formatWon(unitTotal)}</span>
                      </div>
                      <button
                        type="button"
                        className="cd-remove"
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

              {/* 배송비 + 무료 배송 게이지 */}
              <div className="cd-shipping-item">
                <div className="cd-si-main">
                  <span className="cd-si-label">배송비</span>
                  <span className={`cd-si-notice${isFreeShipping ? ' free' : ''}`}>
                    {isFreeShipping
                      ? '무료 배송이 적용됩니다.'
                      : `${remainForFree.toLocaleString('ko-KR')}원 더 구매하시면 무료 배송됩니다.`}
                  </span>
                  <span className={`cd-si-price${isFreeShipping ? ' free' : ''}`}>
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
            </>
          )}
        </div>
        {!isEmpty && (
          <div className="cd-footer">
            <div className="cd-total-row">
              <span className="cd-subtotal-label">결제예정금액</span>
              <span className="cd-subtotal-price">{formatWon(totalPrice)}</span>
            </div>
            <div className="cd-note">부가세 포함</div>
            <div className="cd-cta-row">
              <button
                className="cta-btn cta-btn-light-outline cd-cta-secondary"
                type="button"
                onClick={handleViewCart}
              >
                장바구니 보기
              </button>
              <button
                className="cta-btn cta-btn-light-filled cd-cta-primary"
                type="button"
                onClick={handleCheckout}
              >
                주문하기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
