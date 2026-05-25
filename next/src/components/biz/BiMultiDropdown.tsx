/* ══════════════════════════════════════════
   BiMultiDropdown — biz-inquiry 복수 선택 드롭다운 (S264-C 분리)

   원본: BizInquiryPage.tsx 의 인라인 BiMultiDropdown.
   - role="combobox" + role="listbox" aria-multiselectable + role="option"
   - Enter/Space = toggle (close 안 함 · multi 특성). ESC/Tab 만 close.
   - useEffect functional setter 로 toggle 후 focusedIndex 보존 (S243-B fix).
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useState } from 'react';
import type { BizDropdownOption } from '@/lib/biz';

type BiMultiDropdownProps = {
  id: string;
  label: string;
  options: BizDropdownOption[];
  values: string[];
  open: boolean;
  placeholderTitle: string;
  onToggle: () => void;
  onSelect: (value: string) => void;
};

export function BiMultiDropdown({
  id,
  label,
  options,
  values,
  open,
  placeholderTitle,
  onToggle,
  onSelect,
}: BiMultiDropdownProps) {
  const selectedLabels = options
    .filter((o) => values.includes(o.value))
    .map((o) => o.label)
    .join(', ');
  const hasValue = values.length > 0;
  /* S243-B 키보드 접근성: single 과 동일하나 Enter/Space 는 toggle 후 close 하지 않음
     (multi-select 특성). ESC/Tab 만 close. */
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const listboxId = `${id}-listbox`;
  const optionId = (idx: number) => `${id}-option-${idx}`;

  /* multi 는 Enter 후에도 열린 상태 유지 — values 변경 시 focusedIndex 가 reset 되지
     않도록 functional setter 로 valid 한 prev 보존 (S243-B fix). */
  useEffect(() => {
    // dropdown focus sync — open 변화 시 focus index 설정 (의도된 setState in effect)
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!open) {
      setFocusedIndex(-1);
      return;
    }
    setFocusedIndex((prev) => {
      if (prev >= 0 && prev < options.length) return prev;
      const firstChecked = options.findIndex((o) => values.includes(o.value));
      return firstChecked >= 0 ? firstChecked : 0;
    });
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, options, values]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onToggle();
      }
      return;
    }
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        onToggle();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((i) => (i < 0 ? 0 : (i + 1) % options.length));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((i) => (i <= 0 ? options.length - 1 : i - 1));
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setFocusedIndex(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        /* multi: toggle 만, close 안 함. focusedIndex 위치 유지 (useEffect functional setter). */
        e.preventDefault();
        if (focusedIndex >= 0) onSelect(options[focusedIndex].value);
        break;
      case 'Tab':
        onToggle();
        break;
    }
  }

  return (
    <div
      id={`${id}-field`}
      className={`bi-field bi-dropdown-field bi-multi-dropdown${open ? ' open' : ''}${
        hasValue ? ' has-value' : ''
      }`}
    >
      <button
        className="bi-dropdown-trigger"
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-activedescendant={
          open && focusedIndex >= 0 ? optionId(focusedIndex) : undefined
        }
        onClick={onToggle}
        onKeyDown={handleKeyDown}
      >
        <span className="bi-dropdown-value">{selectedLabels}</span>
        <svg
          className="bi-dropdown-arrow"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6,9l6,6,6-6" />
        </svg>
      </button>
      <label className="bi-floating-label">{label}</label>
      <div
        className="bi-dropdown-list"
        role="listbox"
        id={listboxId}
        aria-multiselectable="true"
      >
        <div className="bi-dropdown-title">{placeholderTitle}</div>
        {options.map((opt, idx) => {
          const checked = values.includes(opt.value);
          return (
            <div
              key={opt.value}
              id={optionId(idx)}
              role="option"
              aria-selected={checked}
              data-focused={focusedIndex === idx ? 'true' : undefined}
              className={`bi-dropdown-option${checked ? ' active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(opt.value)}
            >
              <span className="bi-check-box">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5,12l5,5,9-9" />
                </svg>
              </span>
              {opt.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
