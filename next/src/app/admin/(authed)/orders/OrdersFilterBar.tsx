'use client';

/* ══════════════════════════════════════════════════════════════════════════
   OrdersFilterBar.tsx — /admin/orders 필터 바 (S256-C)

   책임:
   - 검색 input (AdminSearchInput)
   - 기간 / 결제수단 DropdownFilter (2 개)
   - 선택 요약 영역 (N건 선택됨 + 일괄 처리 / 송장 발급 placeholder)

   분리 전 OrdersTableClient.tsx 안의 필터 바 영역 (lines 314-343) +
   DropdownFilter local 컴포넌트 (lines 435-542) + ChevronDown SVG.

   DropdownFilter 는 audit 결과 'hypothetical seam' 으로 추출 보류 결정
   — 도메인별 호출처 단일이지만 인터랙션 패턴은 동일. 본 sprint 는
   orders 도메인 안에서만 분리 (cross-domain 추출은 별 sprint carry).
   ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from 'react';
import { AdminSearchInput } from '@/components/admin/AdminSearchInput';
import { Button } from '@/components/admin/ui/button';
import type {
  AdminOrdersSearchParams,
  PaymentFilterKey,
  PeriodKey,
} from '@/lib/admin/orders';
import { PAYMENT_OPTIONS, PERIOD_OPTIONS } from '@/lib/admin/orders';

type Props = {
  filters: AdminOrdersSearchParams;
  searchValue: string;
  onSearchChange: (v: string) => void;
  onPeriodChange: (id: PeriodKey) => void;
  onPaymentChange: (id: PaymentFilterKey) => void;
  selectedCount: number;
};

export default function OrdersFilterBar({
  filters,
  searchValue,
  onSearchChange,
  onPeriodChange,
  onPaymentChange,
  selectedCount,
}: Props) {
  return (
    <div className="flex gap-2 mb-3 items-center">
      <AdminSearchInput
        value={searchValue}
        onChange={onSearchChange}
        placeholder="주문번호, 고객명, 이메일로 검색…"
      />
      <DropdownFilter
        label="기간"
        options={PERIOD_OPTIONS}
        activeId={filters.period}
        hasIcon
        onChange={(id) => onPeriodChange(id as PeriodKey)}
      />
      <DropdownFilter
        label="결제수단"
        options={PAYMENT_OPTIONS}
        activeId={filters.payment}
        onChange={(id) => onPaymentChange(id as PaymentFilterKey)}
      />
      <div className="flex-1" />
      {selectedCount > 0 && (
        <div className="flex items-center gap-2 px-2.5 h-7 rounded-md bg-[var(--primary-soft)] text-[var(--primary-soft-fg)] text-xs font-medium">
          <span>{selectedCount}건 선택됨</span>
          <span aria-hidden className="w-px h-3.5 bg-current opacity-20" />
          <span className="cursor-not-allowed opacity-60" title="구현 예정 (출시 후)">일괄 처리</span>
          <span className="cursor-not-allowed opacity-60" title="구현 예정 (출시 후)">송장 발급</span>
        </div>
      )}
    </div>
  );
}

/* ── DropdownFilter (orders 도메인 내부) ─────────────────────────────── */

function DropdownFilter({
  label,
  options,
  activeId,
  hasIcon,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ id: string; label: string }>;
  activeId: string;
  hasIcon?: boolean;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const activeOpt = options.find((o) => o.id === activeId) ?? options[0];
  const isDefault = activeId === options[0].id;

  return (
    <div ref={wrapperRef} className="relative inline-flex">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="!h-7 [&>svg:last-child]:-mr-1"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={
          isDefault
            ? undefined
            : {
                borderColor: 'var(--primary)',
                color: 'var(--primary-soft-fg)',
                background: 'var(--primary-soft)',
              }
        }
      >
        {hasIcon && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M7 12h10" />
            <path d="M10 18h4" />
          </svg>
        )}
        {isDefault ? label : `${label}: ${activeOpt.label}`}
        <ChevronDown />
      </Button>
      {open && (
        <ul
          role="listbox"
          className="admin-dropdown-menu"
        >
          {options.map((opt) => {
            const active = opt.id === activeId;
            return (
              <li key={opt.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setOpen(false);
                    onChange(opt.id);
                  }}
                  className={`admin-dropdown-item ${
                    active
                      ? 'bg-[var(--primary-soft)] text-[var(--primary-soft-fg)]'
                      : 'bg-transparent text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const ChevronDown = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ opacity: 0.6 }}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);
