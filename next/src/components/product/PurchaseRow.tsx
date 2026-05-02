/* ══════════════════════════════════════════
   PurchaseRow — V2 §5.2 / §6.11 적용 (S132 Phase 1)
   ──────────────────────────────────────────
   - 용량/품목: dropdown → OptionChipGroup chip 그룹
   - 수량: stepper (변경 없음)
   - 정기배송: 탭 → 체크박스 격하 ("정기 배송으로 받기" + 체크 시 주기 select reveal)
   - 라벨 할인율(−5%) 미표시 (D-15 carry-over: 할인 계산 흐름 통합 후 동적화)
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef, useState } from 'react';
import type { Product } from '@/lib/products';
import { useAddCartItem } from '@/hooks/useCart';
import { useCartDrawer } from '@/contexts/CartDrawerContext';
import { useToast } from '@/hooks/useToast';
import { SUB_CYCLES } from '@/hooks/useProductPurchase';
import OptionChipGroup, { type OptionChipItem } from './OptionChipGroup';

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
  const [isSubscription, setIsSubscription] = useState(false);
  const [cycle, setCycle] = useState('2');
  const [cycleOpen, setCycleOpen] = useState(false);

  const cycleBoxRef = useRef<HTMLDivElement>(null);
  const qtyBoxRef = useRef<HTMLDivElement>(null);

  function flashBox(ref: React.RefObject<HTMLDivElement | null>) {
    const el = ref.current;
    if (!el) return;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }

  /* 상품 변경 시 내부 상태 초기화 (volIdx 는 상위에서 리셋) */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setQty(1);
    setIsSubscription(false);
    setCycle('2');
    setCycleOpen(false);
  }, [product.slug]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* 외부 클릭 시 주기 dropdown 닫기 */
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (cycleBoxRef.current && !cycleBoxRef.current.contains(t)) setCycleOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  /* 전체 품절 판정 */
  const allSoldOut = hasVolumes && product.volumes.every((v) => v.soldOut);
  const disabled = product.status === '품절' || allSoldOut;
  const cartLabel = disabled ? (product.status ?? '품절') : '장바구니에 담기';

  /* 드립백은 라벨이 "품목" */
  const volLabelText = product.category === 'Drip Bag' ? '품목' : '용량';

  /* 정기배송이 활성화 가능한지 — product.subscription === true 일 때만 체크박스 표시 */
  const canSubscribe = product.subscription;

  function decQty() {
    if (qty > 1) {
      setQty(qty - 1);
      flashBox(qtyBoxRef);
    }
  }
  function incQty() {
    setQty(qty + 1);
    flashBox(qtyBoxRef);
  }

  function handleCart() {
    if (disabled) return;
    const vol = hasVolumes ? product.volumes[volIdx] : null;
    if (hasVolumes && !vol) return;
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
      type: isSubscription ? 'subscription' : 'normal',
      period: isSubscription ? `${cycle}주` : null,
      category: product.category ?? '',
      volume: vol?.label ?? null,
    });
    showToast('장바구니에 담았습니다.');
    openDrawer();
  }

  const currentCycleLabel =
    SUB_CYCLES.find((c) => c.value === cycle)?.label ?? '2주마다 배송';

  /* 용량 chip 옵션 변환 */
  const volumeOptions: ReadonlyArray<OptionChipItem<string>> = product.volumes.map((v) => ({
    label: v.label,
    sublabel: `${v.price.toLocaleString('ko-KR')}원`,
    value: v.label,
    disabled: v.soldOut,
    badge: v.soldOut ? '품절' : undefined,
  }));

  const currentVolValue = hasVolumes ? product.volumes[volIdx].label : '';

  function handleVolumeChange(value: string) {
    const i = product.volumes.findIndex((v) => v.label === value);
    if (i >= 0) onVolChange(i);
  }

  return (
    <>
      {/* 용량 / 품목 chip 그룹 */}
      {hasVolumes && (
        <div id="pd-volume-block">
          <OptionChipGroup
            label={volLabelText}
            options={volumeOptions}
            value={currentVolValue}
            onChange={handleVolumeChange}
            groupId="pd-volume"
          />
        </div>
      )}

      {/* 수량 */}
      <div id="pd-qty-block">
        <div className="pd-field">
          <div className="pd-field-label">수량</div>
          <div className="pd-input-box pd-qty-box" ref={qtyBoxRef}>
            <div className="pd-qty-stepper">
              <svg
                id="pd-qty-minus"
                className="pd-qty-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
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
                strokeWidth="1.5"
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
      </div>

      {/* 정기배송 박스 — 체크박스 + 주기 트리거가 한 컨테이너에 묶여 부모-자식 관계 명확 */}
      {canSubscribe && (
        <div id="pd-subscription-block">
          <div
            className={
              'pd-sub-box' +
              (isSubscription ? ' pd-sub-box--checked' : '') +
              (isSubscription && cycleOpen ? ' pd-sub-box--open' : '')
            }
            data-open={isSubscription && cycleOpen ? 'true' : 'false'}
            ref={cycleBoxRef}
          >
            <label className="pd-sub-toggle">
              <input
                type="checkbox"
                checked={isSubscription}
                onChange={(e) => setIsSubscription(e.target.checked)}
              />
              <span className="pd-sub-checkbox-box" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 8 L7 12 L13 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="pd-sub-toggle-label">정기 배송으로 받기</span>
            </label>

            {isSubscription ? (
              <button
                type="button"
                className="pd-sub-cycle-trigger"
                onClick={(e) => {
                  e.stopPropagation();
                  setCycleOpen((v) => !v);
                }}
                aria-haspopup="listbox"
                aria-expanded={cycleOpen}
              >
                <span>{currentCycleLabel}</span>
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
            ) : (
              <span className="pd-sub-cycle-preview" aria-hidden="true">
                2주 / 4주 / 6주
              </span>
            )}

            {isSubscription && (
              <div
                id="pd-cycle-dropdown"
                className={`pd-dropdown-panel pd-sub-cycle-panel${cycleOpen ? ' open' : ''}`}
                role="listbox"
              >
                <div className="pd-dropdown-hint">배송 주기 선택</div>
                {SUB_CYCLES.map((c) => (
                  <div
                    key={c.value}
                    className={`pd-dropdown-option${c.value === cycle ? ' active' : ''}`}
                    role="option"
                    aria-selected={c.value === cycle}
                    onClick={() => {
                      setCycle(c.value);
                      setCycleOpen(false);
                      flashBox(cycleBoxRef);
                    }}
                  >
                    {c.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 장바구니 버튼 */}
      <div
        id="pd-cart-btn"
        className={disabled ? 'disabled' : ''}
        role="button"
        tabIndex={0}
        onClick={handleCart}
        data-gtr-tap
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
