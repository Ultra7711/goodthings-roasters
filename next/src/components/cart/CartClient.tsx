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
  SHIPPING_FEE,
} from '@/hooks/useCart';
import type { CartItem } from '@/types/cart';
import CartSkeleton from './CartSkeleton';
import OrderItemRow from '@/components/order/OrderItemRow';
import OverscrollTop from '@/components/ui/OverscrollTop';
import { formatPrice } from '@/lib/utils';

type CartClientProps = {
  /** S199 — server prefetch (인증 카트 page.tsx) 시 TanStack initialData 로 전달.
     게스트는 undefined → 기존 client store 흐름. */
  initialItems?: CartItem[];
};

export default function CartClient({ initialItems }: CartClientProps = {}) {
  const {
    items, subtotal, totalPrice,
    isFreeShipping, gaugePct, remainForFree,
    isLoading,
  } = useCartQuery(initialItems);
  const updateQty = useUpdateCartQty();
  const removeItem = useRemoveCartItem();
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);

  /* 진입 연출 재트리거 — remove → 강제 reflow (offsetHeight) → add 로
     hydration 시 className 이 이미 박혀있어도 CSS 애니메이션 재생 보장.
     (Shop/Story/CafeMenu 등 14 파일 동일 패턴 — 추출 후보지만 위치 다양해 보류) */
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    el.classList.remove('cp-anim');
    void el.offsetHeight;
    el.classList.add('cp-anim');
    return () => { el.classList.remove('cp-anim'); };
  }, []);

  if (isLoading) return <CartSkeleton />;

  const isEmpty = items.length === 0;

  function handleCheckout() {
    router.push('/checkout');
  }

  return (
    <>
    {/* S-PND-1 후속: /cart 는 FOOTER_HIDDEN (FooterRoute.tsx) — default
        bottom=#4A4845 stone footer 색이 부적합. page bg sand (#FBF8F3) 정합. */}
    <OverscrollTop top="#1E1B16" bottom="#FBF8F3" />
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
          <Link href="/shop" className="cta-btn cta-btn-light-outline" data-gtr-tap>
            쇼핑 계속하기
          </Link>
        </div>
      ) : (
        <>
          <div className="cp-items-list">
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
                onIncrement={() => updateQty.mutate({ id: item.id, delta: 1 })}
                onDecrement={() => updateQty.mutate({ id: item.id, delta: -1 })}
                onRemove={() => removeItem.mutate(item.id)}
              />
            ))}
          </div>

          <div className="cp-shipping-row">
            <div className="cp-shipping-main">
              <span className="cp-shipping-label">배송비</span>
              <span className={`cp-shipping-notice${isFreeShipping ? ' free' : ''}`}>
                {isFreeShipping
                  ? '무료 배송이 적용됩니다.'
                  : `${remainForFree.toLocaleString('ko-KR')}원 더 구매하면 무료 배송`}
              </span>
              <span className={`cp-shipping-price${isFreeShipping ? ' free' : ''}`}>
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

          <div className="cp-footer">
            <span className="cp-subtotal-label">결제예정금액</span>
            <span className="cp-subtotal-price">{formatPrice(totalPrice)}</span>
            <div className="cp-tax-note">부가세 포함</div>
            <div className="cp-cta-area">
              <Link href="/shop" className="cta-btn cta-btn-light-outline cp-continue-cta" data-gtr-tap>
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
    </>
  );
}
