'use client';

/* ══════════════════════════════════════════════════════════════════════════
   OrdersTableClient — /admin/orders 인터랙티브 본체 (S128 Group B)

   S228 PR-A — 5 inline 답습 폐기:
   - 페이지 헤더    → AdminPageHeader
   - STATUS_TABS    → AdminTabsNav (mode='url')
   - TH/TD inline   → AdminDataTable (Column<ListedOrder> + footer 슬롯)
   - colSpan 빈     → AdminEmptyState (variant='table-row')
   - PageNav etc.   → AdminPagination (mode='url')

   행 클릭 = router.push(/admin/orders/[orderNumber]) 추가 (S228 결정).
   checkbox / 주문번호 Link 셀은 stopPropagation 으로 행 클릭과 분리.

   유지 (마이그 비대상):
   - AdminTopbarActions / AdminSearchInput / DropdownFilter (1 caller hypothetical)
   - selection state + Badge (TONES) + describeRange

   carry-over (시안 export 후 진입):
   - CSV 내보내기 / 주문 생성 / 일괄 처리 / 송장 발급 (placeholder)
   ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { exportOrdersCsvAction } from './actions';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
import { AdminSearchInput } from '@/components/admin/AdminSearchInput';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminTabsNav } from '@/components/admin/AdminTabsNav';
import { AdminDataTable, type Column } from '@/components/admin/AdminDataTable';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { Button } from '@/components/admin/ui/button';
import { Badge as ShadcnBadge } from '@/components/admin/ui/badge';
import { Checkbox } from '@/components/admin/ui/checkbox';
import {
  PAGE_SIZE,
  PAYMENT_OPTIONS,
  PERIOD_OPTIONS,
  STATUS_TABS,
  describeStatus,
  formatKstDateTime,
  type AdminOrdersSearchParams,
  type ListedOrder,
  type PaymentFilterKey,
  type PeriodKey,
  type StatusTabKey,
  type StatusTone,
} from '@/lib/admin/orders';

type CountsShape = Record<StatusTabKey, number>;

type Props = {
  rows: ListedOrder[];
  total: number;
  counts: CountsShape;
  filters: AdminOrdersSearchParams;
  /** S232: owner (관리자) 만 CSV 내보내기 활성. staff (운영자) 는 disabled. */
  isOwner: boolean;
};

const TONES: Record<StatusTone, { bg: string; fg: string; dot: string }> = {
  neutral: { bg: 'var(--neutral-soft)', fg: 'var(--neutral-soft-fg)', dot: 'var(--foreground-muted)' },
  success: { bg: 'var(--success-soft)', fg: 'var(--success)', dot: 'var(--success)' },
  warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)', dot: 'var(--warning)' },
  info:    { bg: 'var(--info-soft)',    fg: 'var(--info)',    dot: 'var(--info)' },
  primary: { bg: 'var(--primary-soft)', fg: 'var(--primary-soft-fg)', dot: 'var(--primary)' },
};

export default function OrdersTableClient({ rows, total, counts, filters, isOwner }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [searchValue, setSearchValue] = useState(filters.q);
  const [isExporting, startExport] = useTransition();

  /* filters.q 가 외부에서 바뀌면 (예: 탭 전환) input 도 동기화 */
  useEffect(() => {
    setSearchValue(filters.q);
  }, [filters.q]);

  /* CSV 내보내기 — 현재 status/period/payment/q 필터 적용. truncated 시 안내. */
  function handleExport() {
    startExport(async () => {
      const result = await exportOrdersCsvAction({
        status: filters.status,
        period: filters.period,
        payment: filters.payment,
        q: filters.q,
      });
      if (!result.ok) {
        const map: Record<string, string> = {
          unauthorized: '권한이 없습니다.',
          validation_failed: '입력값이 잘못되었습니다.',
          server_error: '내보내는 중 오류가 발생했습니다.',
        };
        toast.error(map[result.error] ?? '오류가 발생했습니다.');
        return;
      }
      if (result.rowCount === 0) {
        toast.info('내보낼 주문이 없습니다.');
        return;
      }
      const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (result.truncated) {
        toast.warning(
          `${result.rowCount.toLocaleString()}건 내보냈습니다. 상한(10,000건) 초과 — 필터를 좁혀 다시 내보내주세요.`,
        );
      } else {
        toast.success(`${result.rowCount.toLocaleString()}건을 내보냈습니다.`);
      }
    });
  }

  /* URL builder — 현재 filters + override */
  function buildHref(override: Partial<AdminOrdersSearchParams>): string {
    const merged = { ...filters, ...override };
    const params = new URLSearchParams();
    if (merged.status !== 'all')   params.set('status', merged.status);
    if (merged.period !== 'all')   params.set('period', merged.period);
    if (merged.payment !== 'all')  params.set('payment', merged.payment);
    if (merged.q.trim().length > 0) params.set('q', merged.q.trim());
    if (merged.page > 1)           params.set('page', String(merged.page));
    const qs = params.toString();
    return qs.length > 0 ? `?${qs}` : '?';
  }

  /* 검색 — 300ms debounced router.replace (history pollution 방지) */
  useEffect(() => {
    if (searchValue === filters.q) return;
    const t = setTimeout(() => {
      router.replace(buildHref({ q: searchValue, page: 1 }));
    }, 300);
    return () => clearTimeout(t);
    /* buildHref 는 filters · searchValue 의존 — 의존 배열에 두면 무한 루프.
       닫힘 시점 값 캡처로 충분. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /* 선택 행 헬퍼 — 표시 행만 대상 */
  const allSelected = rows.length > 0 && selected.length === rows.length;
  const indeterminate = selected.length > 0 && !allSelected;

  function toggleRow(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  function toggleAll() {
    setSelected(allSelected ? [] : rows.map((r) => r.id));
  }

  /* 페이지 변경 시 선택 초기화 (다른 행으로 컨텍스트 전환) */
  useEffect(() => {
    setSelected([]);
  }, [filters.page, filters.status, filters.period, filters.payment, filters.q]);

  const columns: readonly Column<ListedOrder>[] = useMemo(() => [
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [rows, selected, allSelected, indeterminate]);

  return (
    <>
      <AdminTopbarActions>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="!h-7"
          onClick={handleExport}
          disabled={!isOwner || isExporting || total === 0}
          title={
            !isOwner
              ? '관리자 권한 필요'
              : '현재 필터 기준으로 CSV 내보내기'
          }
        >
          <Download />
          {isExporting ? '내보내는 중…' : 'CSV 내보내기'}
        </Button>
      </AdminTopbarActions>

      <AdminPageHeader
        title="주문 관리"
        subtitle={
          <>
            총 {counts.all.toLocaleString()}건의 주문
            {counts.new > 0 ? ` · ${counts.new.toLocaleString()}건 처리 대기` : ''}
          </>
        }
      />

      <AdminTabsNav
        mode="url"
        tabs={STATUS_TABS.map((t) => ({
          id: t.id,
          label: t.label,
          count: counts[t.id] ?? 0,
        }))}
        active={filters.status}
        buildHref={(id) => buildHref({ status: id as StatusTabKey, page: 1 })}
      />

      {/* 필터 바 */}
      <div className="flex gap-2 mb-3 items-center">
        <AdminSearchInput
          value={searchValue}
          onChange={setSearchValue}
          placeholder="주문번호, 고객명, 이메일로 검색…"
        />
        <DropdownFilter
          label="기간"
          options={PERIOD_OPTIONS}
          activeId={filters.period}
          hasIcon
          onChange={(id) => router.replace(buildHref({ period: id as PeriodKey, page: 1 }))}
        />
        <DropdownFilter
          label="결제수단"
          options={PAYMENT_OPTIONS}
          activeId={filters.payment}
          onChange={(id) => router.replace(buildHref({ payment: id as PaymentFilterKey, page: 1 }))}
        />
        <div className="flex-1" />
        {selected.length > 0 && (
          <div className="flex items-center gap-2 px-2.5 h-7 rounded-md bg-[var(--primary-soft)] text-[var(--primary-soft-fg)] text-xs font-medium">
            <span>{selected.length}건 선택됨</span>
            <span aria-hidden className="w-px h-3.5 bg-current opacity-20" />
            <span className="cursor-not-allowed opacity-60" title="구현 예정 (출시 후)">일괄 처리</span>
            <span className="cursor-not-allowed opacity-60" title="구현 예정 (출시 후)">송장 발급</span>
          </div>
        )}
      </div>

      <AdminDataTable
        columns={columns}
        data={rows}
        rowKey={(o) => o.id}
        onRowClick={(o) => router.push(`/admin/orders/${o.orderNumber}`)}
        isRowSelected={(o) => selected.includes(o.id)}
        empty={
          <AdminEmptyState
            variant="table-row"
            colSpan={columns.length}
            message="표시할 주문이 없습니다."
          />
        }
        footer={
          <>
            <div>{describeRange(filters.page, total)}</div>
            <AdminPagination
              mode="url"
              page={filters.page}
              pageCount={pageCount}
              buildHref={(p) => buildHref({ page: p })}
            />
          </>
        }
      />
    </>
  );
}

/* ── 공유 헬퍼 ──────────────────────────────────────────────────────── */

function describeRange(page: number, total: number): string {
  if (total === 0) return '0건';
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);
  return `총 ${total.toLocaleString()}건 · ${start.toLocaleString()}~${end.toLocaleString()}번째`;
}

/* ── 로컬 컴포넌트 ─────────────────────────────────────────────────── */

/* S222 PR-3: shadcn Checkbox 채택. indeterminate 상태는 Radix 의 'indeterminate' value 전달.
   ON = bg-primary / border-primary · OFF = border-input. CheckIcon size-3.5 자동.
   S223: translate-y-[2px] — shadcn Table 표준 답습 (TH/TD baseline 정렬). */
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

/* S222 PR-3: shadcn Badge variant=outline + tone soft 매트릭스 style override (DEC-2). */
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

/* ── 인라인 SVG ─────────────────────────────────── */

const Download = () => (
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
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 10l5 5 5-5" />
    <path d="M12 15V3" />
  </svg>
);

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
