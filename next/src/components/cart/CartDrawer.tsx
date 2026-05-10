/* ══════════════════════════════════════════
   CartDrawer (Session 19 / 2026-04-18)
   프로토타입 #cart-drawer + openCartDrawer/renderCartDrawer 이식.

   - 우측 슬라이드인 드로어 (--drawer-width 토큰 540, 다른 드로어와 통일)
   - useCartDrawer context 에서 isOpen/close 수신
   - useCartQuery/useUpdateCartQty/useRemoveCartItem 으로 DB/게스트 카트 연동
   - ESC/배경/닫기버튼 3종 지원 (useDrawer 훅)
   - backdrop-filter 는 inline style (Tailwind v4 + Lightning CSS drop 회피)
   ══════════════════════════════════════════ */

'use client';

import './CartDrawer.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  useCartQuery,
  useUpdateCartQty,
  useRemoveCartItem,
  SHIPPING_FEE,
} from '@/hooks/useCart';
import { useCartDrawer } from '@/contexts/CartDrawerContext';
import { useDrawer } from '@/hooks/useDrawer';
import { useNavigation } from '@/hooks/useNavigation';
import { formatPrice } from '@/lib/utils';
import OrderItemRow from '@/components/order/OrderItemRow';
import { CloseIcon } from '@/components/ui/Icons';
import { useEffect, useRef, useCallback } from 'react';

export default function CartDrawer() {
  const { isOpen, close, closeForNavigation } = useCartDrawer();
  const { items, totalQty, subtotal, totalPrice, isFreeShipping, gaugePct, remainForFree } = useCartQuery();
  const updateQty = useUpdateCartQty();
  const removeItem = useRemoveCartItem();
  const pathname = usePathname();
  const { navigate, navigatingTo } = useNavigation();
  const drawerPendingRef = useRef(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      drawerPendingRef.current = false;
    };
  }, []);

  /* transition:none → fn() → rAF×2 복원. 슬라이드 아웃 전면 제거용 공통 헬퍼.
     닫힘 이후 패널이 translateX(100%) 상태에서 복원되므로 다음 슬라이드인 정상 재생. */
  const closeWithoutAnimation = useCallback((fn: () => void) => {
    const panel = document.getElementById('cart-drawer-panel');
    const bg = document.getElementById('cart-drawer-bg');
    panel?.style.setProperty('transition', 'none');
    bg?.style.setProperty('transition', 'none');
    fn();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!mountedRef.current) return;
        panel?.style.removeProperty('transition');
        bg?.style.removeProperty('transition');
      });
    });
  }, []);

  useDrawer({ open: isOpen, onClose: () => closeWithoutAnimation(close) });

  /* pathname 변경(새 페이지 렌더 완료) 시 드로어 즉시 닫기 (BUG-149). */
  useEffect(() => {
    if (!drawerPendingRef.current) return;
    drawerPendingRef.current = false;
    closeWithoutAnimation(closeForNavigation);
  }, [pathname, closeForNavigation, closeWithoutAnimation]);

  const isEmpty = items.length === 0;

  function handleCheckout() {
    if (navigatingTo !== null) return;
    if (pathname === '/checkout') { closeWithoutAnimation(close); return; }
    drawerPendingRef.current = true;
    navigate('/checkout');
  }

  function handleViewCart() {
    if (navigatingTo !== null) return;
    if (pathname === '/cart') { closeWithoutAnimation(close); return; }
    drawerPendingRef.current = true;
    navigate('/cart');
  }

  function handleContinueShopping() {
    if (navigatingTo !== null) return;
    if (pathname === '/shop') { closeWithoutAnimation(close); return; }
    drawerPendingRef.current = true;
    navigate('/shop');
  }

  return (
    <div id="cart-drawer" className={isOpen ? 'open' : ''} aria-hidden={!isOpen}>
      <div
        id="cart-drawer-bg"
        onClick={() => closeWithoutAnimation(close)}
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
            onClick={() => closeWithoutAnimation(close)}
          >
            <CloseIcon size={24} />
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
                  disabled={navigatingTo === '/shop'}
                  aria-busy={navigatingTo === '/shop'}
                  data-gtr-tap
                >
                  {navigatingTo === '/shop' ? '이동 중…' : '쇼핑 계속하기'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="cd-items">
                {items.map((item) => (
                  <OrderItemRow
                    key={item.id}
                    variant="editable"
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
                    thumbHref={`/shop/${item.slug}`}
                    onThumbClick={closeForNavigation}
                    onIncrement={() => updateQty.mutate({ id: item.id, delta: 1 })}
                    onDecrement={() => updateQty.mutate({ id: item.id, delta: -1 })}
                    onRemove={() => removeItem.mutate(item.id)}
                  />
                ))}
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
                    {isFreeShipping ? '무료' : formatPrice(SHIPPING_FEE)}
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
              <span className="cd-subtotal-price">{formatPrice(totalPrice)}</span>
            </div>
            <div className="cd-note">부가세 포함</div>
            <div className="cd-cta-row">
              <button
                className="cta-btn cta-btn-light-outline cd-cta-secondary"
                type="button"
                onClick={handleViewCart}
                disabled={navigatingTo !== null}
                aria-busy={navigatingTo === '/cart'}
                data-gtr-tap
              >
                {navigatingTo === '/cart' ? '이동 중…' : '장바구니 보기'}
              </button>
              <button
                className="cta-btn cta-btn-light-filled cd-cta-primary"
                type="button"
                onClick={handleCheckout}
                disabled={navigatingTo !== null}
                aria-busy={navigatingTo === '/checkout'}
                data-gtr-tap
              >
                {navigatingTo === '/checkout' ? '이동 중…' : '주문하기'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
