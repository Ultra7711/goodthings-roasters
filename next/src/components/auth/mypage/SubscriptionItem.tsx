/* ══════════════════════════════════════════
   SubscriptionItem — 정기배송 한 아이템 (top + form-reveal)

   SubscriptionEditor 의 list 렌더 sub-tree 추출. 도메인 컴포넌트라
   myPageUiStore 의 cycle dropdown / cycle edit 상태에 직접 binding.

   - 외부에서 받는 것: sub 데이터 + isEditing + 7 callbacks
   - 내부 store binding: useMyPageSubCycleEdit / useMyPageCycleDropdownOpen
   - dropdown 외부 클릭 닫기: useCaptureClickOutside (자체 ref)
   ══════════════════════════════════════════ */

'use client';

import { useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { extractKrName } from '@/lib/utils';
import { InfoCircleIcon } from '@/components/ui/Icons';
import type { Subscription, SubscriptionCycle } from '@/types/subscription';
import type { Product } from '@/lib/products';
import {
  useMyPageSubCycleEdit,
  useMyPageCycleDropdownOpen,
  setSubCycleEdit,
  setCycleDropdownOpen,
  toggleCycleDropdownOpen,
} from '@/lib/myPageUiStore';
import { useCaptureClickOutside } from '@/hooks/useCaptureClickOutside';
import OrderItemCard, {
  type OrderItemCardData,
} from '@/components/order/OrderItemCard';
import CycleDropdown from './CycleDropdown';
import ToggleIcon from './ToggleIcon';

interface SubscriptionItemProps {
  sub: Subscription;
  /** S267: SubscriptionItem 아코디언 카드 표시용 — 현재 product 정보 매핑.
     undefined 면 카드 미표시 (data fetch 실패 또는 product 삭제). */
  product?: Product;
  isEditing: boolean;
  onToggleAccordion: () => void;
  onCycleSave: () => void;
  onSkipRequest: () => void;
  onCancelRequest: () => void;
  onPauseRequest: () => void;
  onResume: () => void;
  previewNextDate: (
    nextDate: string,
    oldCycle: SubscriptionCycle,
    newCycle: SubscriptionCycle,
  ) => string;
}

export default function SubscriptionItem({
  sub,
  product,
  isEditing,
  onToggleAccordion,
  onCycleSave,
  onSkipRequest,
  onCancelRequest,
  onPauseRequest,
  onResume,
  previewNextDate,
}: SubscriptionItemProps) {
  const subCycleEdit = useMyPageSubCycleEdit();
  const isCycleDropdownOpen = useMyPageCycleDropdownOpen();
  const router = useRouter();

  const dropdownRef = useRef<HTMLDivElement>(null);

  /* dropdown 은 이 아이템이 편집 중 + store 가 open 일 때만 open */
  const isDropdownOpenHere = isEditing && isCycleDropdownOpen;
  const closeDropdown = useCallback(() => setCycleDropdownOpen(false), []);
  useCaptureClickOutside(dropdownRef, isDropdownOpenHere, closeDropdown);

  const handleCycleSelect = useCallback((c: SubscriptionCycle) => {
    setSubCycleEdit(c);
    setCycleDropdownOpen(false);
  }, []);

  const hasCycleChange =
    isEditing && subCycleEdit !== null && subCycleEdit !== sub.cycle;

  /* S267 — OrderItemCard 데이터 매핑 (variant="detailed" · 주문내역 답습).
     volume label 매칭으로 현재 단가 표시 (다음 결제 단가). 이미지/카테고리/bg 도 product 에서.
     product undefined 또는 volume 미매칭 시 카드 미표시 (graceful degradation). */
  const matchedVolume = sub.volume
    ? product?.volumes.find((v) => v.label === sub.volume)
    : product?.volumes[0];
  const heroImage = product?.images[0];
  const cardItem: OrderItemCardData | null = product
    ? {
        name: sub.name,
        slug: sub.slug,
        category: product.category,
        volume: sub.volume,
        qty: 1,
        priceNum: matchedVolume?.price ?? 0,
        image: heroImage ? { src: heroImage.src, bg: heroImage.bg } : undefined,
        type: 'subscription',
        period: sub.cycle,
      }
    : null;

  return (
    <div className="mp-sub-item">
      <div
        className="mp-sub-item-top"
        role="button"
        tabIndex={0}
        aria-label={isEditing ? '닫기' : '편집'}
        onClick={onToggleAccordion}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleAccordion();
          }
        }}
      >
        <div className="mp-sub-item-info">
          <span className="mp-sub-item-name">
            {extractKrName(sub.name)}
            {/* NBSP 로 좌측 공백 보존 — inline-block leading 공백 collapse 차단.
                주문내역 ("산뜻한 오후 · 200g") 와 표기 정합. */}
            <span className="mp-sub-item-vol">{' · '}{sub.volume}</span>
            <span className="mp-sub-item-vol">{' · '}정기배송 {sub.cycle}</span>
          </span>
          {sub.status === 'paused' ? (
            <span className="mp-sub-item-status mp-sub-item-status--paused">
              <InfoCircleIcon size={18} />
              일시정지 중
            </span>
          ) : (
            <span className="mp-sub-item-status">다음 배송 {sub.nextDate}</span>
          )}
        </div>
        <div className="mp-sub-controls">
          {/* S283: 공통 ToggleIcon (chevron ↔ X) — 마이페이지 아코디언 4 컴포넌트 통일. */}
          <span className="mp-icon-btn mp-sub-edit-btn" aria-hidden="true">
            <ToggleIcon open={isEditing} />
          </span>
        </div>
      </div>

      <div className={`mp-form-reveal mp-form-reveal--sub${isEditing ? ' open' : ''}`}>
        <div className="mp-form-reveal-inner">
          {/* S267 — 아코디언 카드 (주문내역 detailed variant 답습 · Top ↔ 배송주기 사이).
             image 클릭 시 PDP 이동. product undefined 시 미표시.
             좌상단 absolute 휴지통 버튼 = 구독 해지 (이전 헤더 텍스트 링크 폐기). */}
          {cardItem && (
            <div className="mp-sub-card-wrap">
              <OrderItemCard
                item={cardItem}
                variant="detailed"
                onImageClick={(slug) => router.push(`/shop/${slug}`)}
              />
              <button
                type="button"
                className="mp-sub-cancel-icon-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancelRequest();
                }}
                aria-label="구독 해지"
                title="구독 해지"
                data-gtr-tap
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          )}
          <CycleDropdown
            currentCycle={sub.cycle}
            editValue={subCycleEdit}
            isOpen={isDropdownOpenHere}
            onToggle={toggleCycleDropdownOpen}
            onSelect={handleCycleSelect}
            containerRef={isEditing ? dropdownRef : undefined}
          />

          <div className="mp-info-row" style={{ borderBottom: 'none' }}>
            <span className="mp-info-label">
              다음 배송일
              {hasCycleChange && (
                <span className="mp-sub-cycle-change">
                  <span className="mp-sub-cycle-divider">|</span>
                  {sub.cycle} →{' '}
                  <span className="mp-sub-accent">{subCycleEdit}</span>
                </span>
              )}
            </span>
            <span className="mp-sub-next-right">
              <span
                className={`mp-info-value${hasCycleChange ? ' mp-sub-accent' : ''}`}
              >
                {hasCycleChange && subCycleEdit
                  ? previewNextDate(sub.nextDate, sub.cycle, subCycleEdit)
                  : sub.nextDate}
              </span>
            </span>
          </div>

          {sub.status === 'paused' && (
            <div className="mp-sub-paused-notice">
              <InfoCircleIcon size={18} />
              {hasCycleChange
                ? '배송이 일시정지 중입니다. 재개 후 변경된 주기가 적용됩니다.'
                : '배송이 일시정지 중입니다.'}
            </div>
          )}

          {/* dirty: secondary "취소" + primary "주기변경 적용" 2종 / clean: secondary 2종 (건너뛰기 + 일시정지/재개).
             dirty 의 "취소" = subCycleEdit null 원복 (아코디언 유지 → clean 상태로 다른 액션 가능).
             X 아이콘 = dirty 시 자동 폐기 + 닫기 (현재 동작 유지). Layout 일정 (양쪽 모두 2열 grid). */}
          {hasCycleChange ? (
            <div className="mp-form-reveal-actions mp-form-reveal-actions--sub">
              <button
                className="mp-cancel-btn"
                type="button"
                onClick={() => setSubCycleEdit(null)}
                data-gtr-tap
              >
                취소
              </button>
              <button
                className="mp-save-btn"
                type="button"
                onClick={onCycleSave}
                data-gtr-tap
              >
                주기변경 적용
              </button>
            </div>
          ) : (
            <div className="mp-form-reveal-actions mp-form-reveal-actions--sub">
              <button
                className="mp-cancel-btn"
                type="button"
                disabled={sub.status === 'paused'}
                onClick={onSkipRequest}
                data-gtr-tap
              >
                건너뛰기
              </button>
              {sub.status === 'paused' ? (
                <button
                  className="mp-save-btn"
                  type="button"
                  onClick={onResume}
                  data-gtr-tap
                >
                  재개하기
                </button>
              ) : (
                <button
                  className="mp-cancel-btn"
                  type="button"
                  onClick={onPauseRequest}
                  data-gtr-tap
                >
                  일시정지
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
