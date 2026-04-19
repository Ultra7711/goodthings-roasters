/* ══════════════════════════════════════════
   PurchaseRow — RP-4c (박스형 리디자인)
   ──────────────────────────────────────────
   - 일반/정기 배송 탭 + 슬라이딩 인디케이터 (subscription 상품만)
   - 박스형 입력 카드 3종: 품목/용량 · 수량 · 배송 주기
   - data-layout 으로 그리드 템플릿 컬럼 전환 (vqc / vq / qc / q)
   - volIdx 는 상위에서 lift-up → #pd-price 와 동기
   - 라이브 총액 제거 (수량에 반응하지 않는 단가 표시)
   - 배송 주기 필드는 subscription 상품일 때 항상 DOM 유지 +
     visibility/pointer-events 토글로 레이아웃 시프트 없이 탭 전환
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef, useState } from 'react';
import type { Product } from '@/lib/products';
import { useAddCartItem } from '@/hooks/useCart';
import { useCartDrawer } from '@/contexts/CartDrawerContext';
import { useToast } from '@/hooks/useToast';
import { SUB_CYCLES } from '@/hooks/useProductPurchase';

type Props = {
  product: Product;
  volIdx: number;
  onVolChange: (i: number) => void;
};

export default function PurchaseRow({ product, volIdx, onVolChange }: Props) {
  const hasVolumes = product.volumes.length > 0;
  const addCart = useAddCartItem();
  const { open: openDrawer } = useCartDrawer();
  const { show: showToast } = useToast();

  const [qty, setQty] = useState(1);
  const [orderType, setOrderType] = useState<'normal' | 'subscription'>('normal');
  const [cycle, setCycle] = useState('2');
  const [volOpen, setVolOpen] = useState(false);
  const [cycleOpen, setCycleOpen] = useState(false);

  const volBoxRef = useRef<HTMLDivElement>(null);
  const cycleBoxRef = useRef<HTMLDivElement>(null);

  const tabsRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const tabNormalRef = useRef<HTMLButtonElement>(null);
  const tabSubRef = useRef<HTMLButtonElement>(null);

  /* 상품 변경 시 내부 상태 초기화 (volIdx 는 상위에서 리셋)
     product.slug 변경에 따른 내부 폼 state 일괄 리셋 의도의 setState-in-effect. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setQty(1);
    setOrderType('normal');
    setCycle('2');
    setVolOpen(false);
    setCycleOpen(false);
  }, [product.slug]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* 외부 클릭 시 드롭다운 닫기 */
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (volBoxRef.current && !volBoxRef.current.contains(t)) setVolOpen(false);
      if (cycleBoxRef.current && !cycleBoxRef.current.contains(t)) setCycleOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  /* 탭 인디케이터 위치 동기화 */
  useEffect(() => {
    if (!product.subscription) return;
    const ind = indicatorRef.current;
    const tabs = tabsRef.current;
    const activeTab = orderType === 'subscription' ? tabSubRef.current : tabNormalRef.current;
    if (!ind || !tabs || !activeTab) return;
    const tabsRect = tabs.getBoundingClientRect();
    const tabRect = activeTab.getBoundingClientRect();
    ind.style.left = `${tabRect.left - tabsRect.left}px`;
    ind.style.width = `${Math.round(tabRect.width)}px`;
  }, [orderType, product.subscription, product.slug]);

  /* 상품 / 구독 토글 진입 시 인디케이터는 transition 없이 즉시 배치 */
  useEffect(() => {
    const ind = indicatorRef.current;
    if (!ind) return;
    ind.style.transition = 'none';
    const id = requestAnimationFrame(() => {
      if (indicatorRef.current) indicatorRef.current.style.transition = '';
    });
    return () => cancelAnimationFrame(id);
  }, [product.slug, product.subscription]);

  /* 전체 품절 판정 — status 가 '품절' 이거나, 모든 볼륨이 soldOut 인 경우.
     ProductDetailPage 의 isSoldOut 과 동일한 규칙을 PurchaseRow 에도 적용하여
     "모든 옵션 품절이지만 status 는 null" 인 엣지 케이스에서도 CTA 를 차단한다. */
  const allSoldOut = hasVolumes && product.volumes.every((v) => v.soldOut);
  const disabled = product.status === '품절' || allSoldOut;
  const cartLabel = disabled ? (product.status ?? '품절') : '장바구니에 담기';

  /* 드립백은 라벨이 "품목" */
  const volLabelText = product.category === 'Drip Bag' ? '품목' : '용량';
  const volHintText = product.category === 'Drip Bag' ? '품목 선택' : '용량 선택';

  const showCycle = product.subscription && orderType === 'subscription';

  /* 그리드 레이아웃 키 — CSS data-layout 과 매칭.
     정기배송 가능 상품은 탭 상태에 따라 vqc ↔ vq 로 전환되어
     일반 모드에서도 용량·수량 박스가 가로 폭을 가득 채운다. */
  const layoutKey =
    (hasVolumes ? 'v' : '') + 'q' + (showCycle ? 'c' : '');

  function decQty() {
    if (qty > 1) setQty(qty - 1);
  }
  function incQty() {
    setQty(qty + 1);
  }

  function handleCart() {
    if (disabled) return;
    const vol = hasVolumes ? product.volumes[volIdx] : null;
    const priceNum = vol?.price ?? 0;
    const priceStr = `${priceNum.toLocaleString('ko-KR')}원`;
    const mainImg = product.images[0]?.src ?? null;
    addCart.mutate({
      slug: product.slug,
      name: product.name,
      price: priceStr,
      priceNum,
      qty,
      color: product.color ?? '#ECEAE6',
      image: mainImg,
      type: orderType === 'subscription' ? 'subscription' : 'normal',
      period: orderType === 'subscription' ? `${cycle}주` : null,
      category: product.category ?? '',
      volume: vol?.label ?? null,
    });
    showToast('장바구니에 담았습니다.');
    openDrawer();
  }

  const currentCycleLabel =
    SUB_CYCLES.find((c) => c.value === cycle)?.label ?? '2주마다 배송';
  const currentVolLabel = hasVolumes ? product.volumes[volIdx].label : '';

  return (
    <>
      {/* 일반 / 정기 배송 탭 — subscription 상품만 */}
      {product.subscription && (
        <div id="pd-order-type-wrap" className="visible">
          <div id="pd-order-tabs" ref={tabsRef}>
            <div id="pd-order-indicator" ref={indicatorRef} />
            <button
              type="button"
              className={`pd-order-tab${orderType === 'normal' ? ' active' : ''}`}
              ref={tabNormalRef}
              onClick={() => setOrderType('normal')}
            >
              일반 주문
            </button>
            <button
              type="button"
              className={`pd-order-tab${orderType === 'subscription' ? ' active' : ''}`}
              ref={tabSubRef}
              onClick={() => setOrderType('subscription')}
            >
              정기 배송
            </button>
          </div>
        </div>
      )}

      {/* 박스형 구매 옵션 행 */}
      <div id="pd-purchase-row" data-layout={layoutKey}>
        {/* 용량 / 품목 */}
        {hasVolumes && (
          <div className="pd-field" id="pd-volume-wrap">
            <div className="pd-field-label">{volLabelText}</div>
            <div
              className="pd-input-box"
              data-open={volOpen ? 'true' : 'false'}
              ref={volBoxRef}
            >
              <button
                id="pd-volume-btn"
                type="button"
                className="pd-input-box-trigger"
                onClick={(e) => {
                  e.stopPropagation();
                  setVolOpen((v) => !v);
                }}
              >
                <span id="pd-volume-text">{currentVolLabel}</span>
                <svg
                  className="pd-input-box-chevron"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6,10l6,6,6-6" />
                </svg>
              </button>
              <div
                id="pd-volume-dropdown"
                className={`pd-dropdown-panel${volOpen ? ' open' : ''}`}
              >
                <div className="pd-dropdown-hint">{volHintText}</div>
                {product.volumes.map((v, i) => (
                  <div
                    key={v.label}
                    className={
                      'pd-dropdown-option' +
                      (i === volIdx ? ' active' : '') +
                      (v.soldOut ? ' sold-out' : '')
                    }
                    onClick={() => {
                      if (v.soldOut) return;
                      onVolChange(i);
                      setVolOpen(false);
                    }}
                  >
                    <span>{v.label}</span>
                    {v.soldOut && (
                      <span className="pd-dropdown-option-soldout">품절</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 수량 */}
        <div className="pd-field" id="pd-qty-wrap">
          <div className="pd-field-label">수량</div>
          <div className="pd-input-box">
            <div className="pd-qty-stepper">
              <svg
                id="pd-qty-minus"
                className="pd-qty-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                role="button"
                aria-label="감소"
                onClick={decQty}
                style={{
                  opacity: qty <= 1 ? 0.25 : undefined,
                  pointerEvents: qty <= 1 ? 'none' : undefined,
                }}
              >
                <path d="M6.3,12h11.3" />
              </svg>
              <span id="pd-qty-num">{qty}</span>
              <svg
                id="pd-qty-plus"
                className="pd-qty-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                role="button"
                aria-label="증가"
                onClick={incQty}
              >
                <path d="M12,6.3v11.3" />
                <path d="M6.3,12h11.3" />
              </svg>
            </div>
          </div>
        </div>

        {/* 배송 주기 — showCycle 일 때만 렌더.
            비활성화 시에는 data-layout 이 vq/q 로 전환되어 용량·수량이 가로 폭을 채운다. */}
        {showCycle && (
          <div className="pd-field" id="pd-cycle-wrap">
            <div className="pd-field-label">배송 주기</div>
            <div
              className="pd-input-box"
              data-open={cycleOpen ? 'true' : 'false'}
              ref={cycleBoxRef}
            >
              <button
                id="pd-cycle-btn"
                type="button"
                className="pd-input-box-trigger"
                onClick={(e) => {
                  e.stopPropagation();
                  setCycleOpen((v) => !v);
                }}
              >
                <span id="pd-cycle-text">{currentCycleLabel}</span>
                <svg
                  className="pd-input-box-chevron"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6,10l6,6,6-6" />
                </svg>
              </button>
              <div
                id="pd-cycle-dropdown"
                className={`pd-dropdown-panel${cycleOpen ? ' open' : ''}`}
              >
                <div className="pd-dropdown-hint">배송 주기 선택</div>
                {SUB_CYCLES.map((c) => (
                  <div
                    key={c.value}
                    className={`pd-dropdown-option${c.value === cycle ? ' active' : ''}`}
                    onClick={() => {
                      setCycle(c.value);
                      setCycleOpen(false);
                    }}
                  >
                    {c.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 장바구니 버튼 */}
      <div
        id="pd-cart-btn"
        className={disabled ? 'disabled' : ''}
        role="button"
        tabIndex={0}
        onClick={handleCart}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCart();
          }
        }}
      >
        {cartLabel}
      </div>
    </>
  );
}
