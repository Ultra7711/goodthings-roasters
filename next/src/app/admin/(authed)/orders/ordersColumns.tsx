'use client';

/* ══════════════════════════════════════════════════════════════════════════
   ordersColumns.tsx — /admin/orders 테이블 컬럼 정의 (S256-C)

   책임:
   - buildOrdersColumns: Column<ListedOrder>[] 반환 (selection state 주입 받음)
   - CheckBox / Badge 로컬 컴포넌트 + TONES 상수
   - shadcn 의존성 + ListedOrder 도메인 매핑만 책임.

   분리 전 OrdersTableClient.tsx 안의 useMemo columns (lines 161-270 ≈ 110)
   + Badge/CheckBox/TONES 헬퍼 (lines 383-433 ≈ 50). orchestrator 코드와
   섞여 가독성 낮음.

   selection state (selected / allSelected / indeterminate / toggleRow /
   toggleAll) 은 OrdersTableClient 의 useState 가 owner. 본 모듈은 함수형
   builder 로 상태를 props 로 주입받음 — pure render 책임.
   ══════════════════════════════════════════════════════════════════════════ */

import Link from 'next/link';
import type { Column } from '@/components/admin/AdminDataTable';
import { Badge as ShadcnBadge } from '@/components/admin/ui/badge';
import { Checkbox } from '@/components/admin/ui/checkbox';
import {
  describeStatus,
  formatKstDateTime,
  type ListedOrder,
  type StatusTone,
} from '@/lib/admin/orders';

const TONES: Record<StatusTone, { bg: string; fg: string; dot: string }> = {
  neutral: { bg: 'var(--neutral-soft)', fg: 'var(--neutral-soft-fg)', dot: 'var(--foreground-muted)' },
  success: { bg: 'var(--success-soft)', fg: 'var(--success)', dot: 'var(--success)' },
  warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)', dot: 'var(--warning)' },
  info:    { bg: 'var(--info-soft)',    fg: 'var(--info)',    dot: 'var(--info)' },
  primary: { bg: 'var(--primary-soft)', fg: 'var(--primary-soft-fg)', dot: 'var(--primary)' },
};

export type OrdersColumnsOptions = {
  rows: ListedOrder[];
  selected: string[];
  allSelected: boolean;
  indeterminate: boolean;
  toggleRow: (id: string) => void;
  toggleAll: () => void;
};

/**
 * 주문 목록 테이블의 컬럼 정의 빌더.
 *
 * selection 관련 state 는 parent 의 useState 가 owner — 본 함수는 props 주입.
 * useMemo 안에서 호출 권장 (parent 가 deps 관리).
 */
export function buildOrdersColumns(
  opts: OrdersColumnsOptions,
): readonly Column<ListedOrder>[] {
  const { rows, selected, allSelected, indeterminate, toggleRow, toggleAll } = opts;

  return [
    {
      key: 'select',
      width: 'w-9',
      header: (
        <span onClick={(e) => e.stopPropagation()}>
          <CheckBox
            checked={allSelected}
            indeterminate={indeterminate}
            onChange={toggleAll}
            ariaLabel={allSelected ? '전체 선택 해제' : '전체 선택'}
            disabled={rows.length === 0}
          />
        </span>
      ),
      render: (o) => (
        <span onClick={(e) => e.stopPropagation()}>
          <CheckBox
            checked={selected.includes(o.id)}
            onChange={() => toggleRow(o.id)}
            ariaLabel={selected.includes(o.id) ? `${o.orderNumber} 선택 해제` : `${o.orderNumber} 선택`}
          />
        </span>
      ),
    },
    {
      key: 'orderNumber',
      header: '주문번호',
      render: (o) => (
        <Link
          href={`/admin/orders/${o.orderNumber}`}
          onClick={(e) => e.stopPropagation()}
          className="gtr-mono text-xs text-[var(--primary)] font-medium no-underline"
        >
          {o.orderNumber}
        </Link>
      ),
    },
    {
      key: 'createdAt',
      header: '주문일시',
      cellClassName: 'text-xs text-muted-foreground tabular-nums',
      render: (o) => formatKstDateTime(o.createdAtIso),
    },
    {
      key: 'customer',
      header: '고객',
      cellClassName: 'text-sm',
      render: (o) => (
        <>
          <div className="font-medium">{o.customerName}</div>
          <div className="text-xs text-[var(--foreground-subtle)] mt-0.5">{o.contactEmail}</div>
        </>
      ),
    },
    {
      key: 'items',
      header: '상품',
      cellClassName: 'text-sm max-w-[240px]',
      render: (o) => {
        if (o.itemsStructured.length === 0) {
          return <span className="opacity-50">—</span>;
        }
        const first = o.itemsStructured[0];
        const rest = o.itemsStructured.length - 1;
        const detail = [
          first.detail,
          rest > 0 ? `+${rest}건` : '',
        ].filter(Boolean).join(' · ');
        return (
          <div title={o.itemsLabel}>
            <div className="font-medium">{first.name}</div>
            {detail && (
              <div className="text-xs text-muted-foreground mt-0.5">
                {detail}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'amount',
      header: '금액',
      align: 'right',
      cellClassName: 'text-sm tabular-nums font-medium',
      render: (o) => `${o.totalAmount.toLocaleString()}원`,
    },
    {
      key: 'payment',
      header: '결제',
      align: 'right',
      cellClassName: 'text-xs text-muted-foreground',
      render: (o) => o.paymentLabel,
    },
    {
      key: 'status',
      header: '상태',
      align: 'right',
      render: (o) => {
        const status = describeStatus(o.status);
        return (
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
        );
      },
    },
  ];
}

/* ── 로컬 컴포넌트 ─────────────────────────────────────────────────── */

/**
 * S222 PR-3: shadcn Checkbox 채택. indeterminate 상태는 Radix 의
 * 'indeterminate' value 전달. ON = bg-primary / border-primary · OFF =
 * border-input. CheckIcon size-3.5 자동. S223: translate-y-[2px] —
 * shadcn Table 표준 답습 (TH/TD baseline 정렬).
 */
function CheckBox({
  checked,
  indeterminate,
  onChange,
  ariaLabel,
  disabled,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange?: () => void;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  return (
    <Checkbox
      checked={indeterminate ? 'indeterminate' : checked}
      onCheckedChange={() => onChange?.()}
      aria-label={ariaLabel}
      disabled={disabled}
      className="translate-y-[2px]"
    />
  );
}

/**
 * S222 PR-3: shadcn Badge variant=outline + tone soft 매트릭스 style
 * override (DEC-2).
 */
function Badge({
  tone,
  children,
  dot,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  dot?: boolean;
}) {
  const t = TONES[tone];
  return (
    <ShadcnBadge
      variant="outline"
      className="border-transparent gap-1.5"
      style={{ background: t.bg, color: t.fg }}
    >
      {dot && <span aria-hidden style={{ width: 5, height: 5, borderRadius: 999, background: t.dot }} />}
      {children}
    </ShadcnBadge>
  );
}
