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
import { extractKrName } from '@/lib/utils';
import { InfoCircleIcon } from '@/components/ui/Icons';
import type { Subscription, SubscriptionCycle } from '@/types/subscription';
import {
  useMyPageSubCycleEdit,
  useMyPageCycleDropdownOpen,
  setSubCycleEdit,
  setCycleDropdownOpen,
  toggleCycleDropdownOpen,
} from '@/lib/myPageUiStore';
import { useCaptureClickOutside } from '@/hooks/useCaptureClickOutside';
import CycleDropdown from './CycleDropdown';

interface SubscriptionItemProps {
  sub: Subscription;
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
          {isEditing && (
            <button
              className="mp-cancel-link mp-sub-cancel-inline"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCancelRequest();
              }}
              data-gtr-tap
            >
              구독 해지
            </button>
          )}
          <span
            className={`mp-icon-btn mp-sub-edit-btn${isEditing ? ' open' : ''}`}
            aria-hidden="true"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path className="mp-sub-toggle-chevron" d="M9 6l6 6-6 6" />
              <path className="mp-sub-toggle-close" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </span>
        </div>
      </div>

      <div className={`mp-form-reveal mp-form-reveal--sub${isEditing ? ' open' : ''}`}>
        <div className="mp-form-reveal-inner">
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
              {hasCycleChange && (
                <button
                  className="mp-sub-apply-link"
                  type="button"
                  onClick={onCycleSave}
                  data-gtr-tap
                >
                  변경 적용
                </button>
              )}
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

          <div className="mp-form-reveal-actions mp-form-reveal-actions--sub">
            <button
              className="mp-cancel-btn"
              type="button"
              disabled={sub.status === 'paused'}
              onClick={onSkipRequest}
              data-gtr-tap
            >
              배송 건너뛰기
            </button>
            {sub.status === 'paused' ? (
              <button
                className="mp-save-btn"
                type="button"
                onClick={onResume}
                data-gtr-tap
              >
                배송 재개하기
              </button>
            ) : (
              <button
                className="mp-cancel-btn"
                type="button"
                onClick={onPauseRequest}
                data-gtr-tap
              >
                배송 일시정지
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
