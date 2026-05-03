/* ══════════════════════════════════════════
   Accordion (V2 §6.3 통합 base)
   ──────────────────────────────────────────
   - 좌 라벨 / 우 +/− 아이콘
   - controlled (open prop) · uncontrolled (defaultOpen) 양쪽 지원
   - CSS namespace: pd-accordion-* (PDP 도입 시 클래스 재사용)
   - 사용처: PDP · 약관 · FAQ
   ══════════════════════════════════════════ */

'use client';

import { useId, useState, type ReactNode } from 'react';

type Props = {
  label: string;
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onToggle?: (next: boolean) => void;
  bodyClassName?: string;
};

function PlusMinusIcon() {
  return (
    <span className="pd-accordion-icon">
      <svg
        width={24}
        height={24}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path className="pd-icon-h" d="M5 12h14" />
        <path className="pd-icon-v" d="M12 5v14" />
      </svg>
    </span>
  );
}

export default function Accordion({
  label,
  children,
  open: controlledOpen,
  defaultOpen = false,
  onToggle,
  bodyClassName,
}: Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;
  const bodyId = useId();

  const handleClick = () => {
    const next = !isOpen;
    if (!isControlled) setUncontrolledOpen(next);
    onToggle?.(next);
  };

  return (
    <div className={`pd-accordion${isOpen ? ' open' : ''}`}>
      <button
        type="button"
        className="pd-accordion-hd"
        onClick={handleClick}
        aria-expanded={isOpen}
        aria-controls={bodyId}
      >
        <span className="pd-accordion-label">{label}</span>
        <PlusMinusIcon />
      </button>
      <div
        id={bodyId}
        className={`pd-accordion-body${bodyClassName ? ` ${bodyClassName}` : ''}`}
        role="region"
        aria-hidden={!isOpen}
      >
        {children}
      </div>
    </div>
  );
}
