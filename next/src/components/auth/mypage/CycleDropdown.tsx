/* ══════════════════════════════════════════
   CycleDropdown — 정기배송 주기 선택 dropdown

   chp-field + chp-input + pd-dropdown-panel 구조 (RP-7 공통 dropdown 패턴).
   외부 클릭 닫기는 호출처가 useCaptureClickOutside + containerRef 로 처리.

   - currentCycle: editValue 가 null 일 때 표시될 baseline 사이클
   - editValue: 현재 선택된 값 (null = 미수정 상태)
   - isOpen: dropdown panel 노출 여부
   - onToggle: trigger 버튼 클릭 핸들러 (open/close 전환)
   - onSelect: option 선택 시 호출 (선택 후 close 까지 호출처 책임)
   - containerRef: 외부 클릭 닫기 useCaptureClickOutside 용 wrapper ref
   ══════════════════════════════════════════ */

'use client';

import type { Ref } from 'react';
import type { SubscriptionCycle } from '@/types/subscription';
import { SUBSCRIPTION_CYCLES } from '@/types/subscription';

interface CycleDropdownProps {
  currentCycle: SubscriptionCycle;
  editValue: SubscriptionCycle | null;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (c: SubscriptionCycle) => void;
  containerRef?: Ref<HTMLDivElement>;
}

export default function CycleDropdown({
  currentCycle,
  editValue,
  isOpen,
  onToggle,
  onSelect,
  containerRef,
}: CycleDropdownProps) {
  const displayCycle = editValue ?? currentCycle;
  return (
    <div
      className="chp-field has-value mp-cycle-dropdown-wrap"
      ref={containerRef}
    >
      <button
        className="chp-input mp-cycle-trigger"
        type="button"
        onClick={onToggle}
      >
        <span>{displayCycle}마다 배송</span>
        <svg
          className={`mp-cycle-chevron${isOpen ? ' open' : ''}`}
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6,10l6,6,6-6" />
        </svg>
      </button>
      <label className="chp-floating-label">배송 주기</label>
      <div className={`pd-dropdown-panel${isOpen ? ' open' : ''}`}>
        <div className="pd-dropdown-hint">배송 주기 선택</div>
        {SUBSCRIPTION_CYCLES.map((c) => (
          <div
            key={c}
            className={`pd-dropdown-option${c === editValue ? ' active' : ''}`}
            onClick={() => onSelect(c)}
          >
            {c}마다 배송
          </div>
        ))}
      </div>
    </div>
  );
}
