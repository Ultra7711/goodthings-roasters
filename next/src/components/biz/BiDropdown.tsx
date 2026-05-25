/* ══════════════════════════════════════════
   BiDropdown — biz-inquiry 단일 선택 드롭다운 (S264-C 분리)

   원본: BizInquiryPage.tsx 의 인라인 BiDropdown.
   - role="combobox" + role="listbox" + role="option" 접근성
   - S243-B 키보드 네비 (ArrowUp/Down · Enter/Space · ESC/Tab · Home/End)
   - aria-activedescendant 로 active option 식별
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useState } from 'react';
import type { BizDropdownOption } from '@/lib/biz';

type BiDropdownProps = {
  id: string;
  label: string;
  options: BizDropdownOption[];
  value: string;
  open: boolean;
  warn?: boolean;
  placeholderTitle: string;
  onToggle: () => void;
  onSelect: (value: string) => void;
};

export function BiDropdown({
  id,
  label,
  options,
  value,
  open,
  warn,
  placeholderTitle,
  onToggle,
  onSelect,
}: BiDropdownProps) {
  const selectedLabel = options.find((o) => o.value === value)?.label ?? '';
  const hasValue = !!value;
  /* S243-B 키보드 접근성: ArrowUp/Down 으로 옵션 이동, Enter/Space 로 선택,
     ESC/Tab 으로 닫기. aria-activedescendant 로 active option 식별. */
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const listboxId = `${id}-listbox`;
  const optionId = (idx: number) => `${id}-option-${idx}`;

  useEffect(() => {
    // dropdown focus sync — open 변화 시 focus index 설정 (의도된 setState in effect)
    /* eslint-disable react-hooks/set-state-in-effect */
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      setFocusedIndex(idx >= 0 ? idx : 0);
    } else {
      setFocusedIndex(-1);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, options, value]);

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
        e.preventDefault();
        if (focusedIndex >= 0) onSelect(options[focusedIndex].value);
        break;
      case 'Tab':
        /* close 만 — browser default focus 이동 유지 */
        onToggle();
        break;
    }
  }

  return (
    <div
      id={`${id}-field`}
      className={`bi-field bi-dropdown-field${open ? ' open' : ''}${
        hasValue ? ' has-value' : ''
      }${warn ? ' bi-input-warn' : ''}`}
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
        <span className="bi-dropdown-value">{selectedLabel}</span>
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
      <div className="bi-dropdown-list" role="listbox" id={listboxId}>
        <div className="bi-dropdown-title">{placeholderTitle}</div>
        {options.map((opt, idx) => (
          <div
            key={opt.value}
            id={optionId(idx)}
            role="option"
            aria-selected={opt.value === value}
            data-focused={focusedIndex === idx ? 'true' : undefined}
            className={`bi-dropdown-option${opt.value === value ? ' active' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(opt.value)}
          >
            {opt.label}
          </div>
        ))}
      </div>
    </div>
  );
}
