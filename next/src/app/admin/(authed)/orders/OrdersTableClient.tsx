'use client';

/* ══════════════════════════════════════════════════════════════════════════
   OrdersTableClient — /admin/orders 인터랙티브 본체 (S128 Group B)

   책임:
   - 시안 inline style 100% 이식 (S125 결정 — Tailwind/shadcn 폐기)
   - 탭·페이지네이션은 <Link href> (URL state)
   - 검색은 debounced router.replace
   - 기간·결제수단 드롭다운은 click-toggle 패턴 + 외부 클릭 close
   - 선택 행(selected) UI 만 — 일괄 처리/송장 발급 액션은 carry-over

   carry-over (시안 export 후 진입):
   - 행 클릭 → /admin/orders/[orderNumber] 상세 (B-2)
   - "발송 처리" 다이얼로그 + dispatchOrderAction (B-3)
   - CSV 내보내기 / 주문 생성 / 일괄 처리 / 송장 발급 (placeholder)
   ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
import { Button } from '@/components/admin/ui/button';
import { Input } from '@/components/admin/ui/input';
import { Badge as ShadcnBadge } from '@/components/admin/ui/badge';
import { Checkbox } from '@/components/admin/ui/checkbox';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/admin/ui/table';
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
};

const TONES: Record<StatusTone, { bg: string; fg: string; dot: string }> = {
  neutral: { bg: 'var(--neutral-soft)', fg: 'var(--neutral-soft-fg)', dot: '#888' },
  success: { bg: 'var(--success-soft)', fg: 'var(--success)', dot: 'var(--success)' },
  warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)', dot: 'var(--warning)' },
  info:    { bg: 'var(--info-soft)',    fg: 'var(--info)',    dot: 'var(--info)' },
  primary: { bg: 'var(--primary-soft)', fg: 'var(--primary-soft-fg)', dot: 'var(--primary)' },
};

/* S223 토큰 정합 — TH/TD inline 유지 (shadcn Table 도입은 carry-over).
   값 정합: fontSize 11/13 → 12/14, padding 12×16 (py-3 px-4 · shadcn 표준 답습). */
const TH_STYLE: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--foreground-muted)',
};

/* fontSize 는 inline 제거 — cell 별 className 으로 hierarchy 표현 (primary 14 / meta 12).
   inline fontSize 가 className 보다 specificity 우선이라 override 안 됨 (S223 회귀 fix). */
const TD_STYLE: React.CSSProperties = {
  padding: '12px 16px',
  verticalAlign: 'middle',
};

export default function OrdersTableClient({ rows, total, counts, filters }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [searchValue, setSearchValue] = useState(filters.q);

  /* filters.q 가 외부에서 바뀌면 (예: 탭 전환) input 도 동기화 */
  useEffect(() => {
    setSearchValue(filters.q);
  }, [filters.q]);

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

  /* 페이지 윈도우 (... 포함 표시) */
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageWindow = useMemo(() => buildPageWindow(filters.page, pageCount), [filters.page, pageCount]);

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

  return (
    <>
      <AdminTopbarActions>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="!h-7"
          disabled
          title="시안 단계 — carry-over"
        >
          <Download />
          CSV 내보내기
        </Button>
        <Button
          type="button"
          size="sm"
          className="!h-7"
          disabled
          title="시안 단계 — carry-over"
        >
          <Plus />
          주문 생성
        </Button>
      </AdminTopbarActions>

      {/* 헤더 */}
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <h2 className="m-0 text-2xl font-medium tracking-tight">주문 관리</h2>
          <div className="mt-1 text-sm text-muted-foreground">
            총 {counts.all.toLocaleString()}건의 주문
            {counts.new > 0 ? ` · ${counts.new.toLocaleString()}건 처리 대기` : ''}
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 border-b border-border mb-4">
        {STATUS_TABS.map((t) => {
          const active = t.id === filters.status;
          const cnt = counts[t.id] ?? 0;
          return (
            <Link
              key={t.id}
              href={buildHref({ status: t.id, page: 1 })}
              replace
              className={`px-3 py-2 bg-transparent cursor-pointer text-sm relative flex items-center gap-1.5 no-underline ${
                active
                  ? 'font-medium text-foreground'
                  : 'font-normal text-muted-foreground'
              }`}
            >
              {t.label}
              <span
                className={`text-xs tabular-nums px-1.5 rounded-sm ${
                  active
                    ? 'text-muted-foreground bg-muted'
                    : 'text-[var(--foreground-subtle)] bg-transparent'
                }`}
                style={{ padding: '1px 6px' }}
              >
                {cnt.toLocaleString()}
              </span>
              {active && (
                <div
                  className="absolute left-0 right-0 h-0.5 bg-[var(--primary)]"
                  style={{ bottom: -1 }}
                />
              )}
            </Link>
          );
        })}
      </div>

      {/* 필터 바 */}
      <div className="flex gap-2 mb-3 items-center">
        <SearchInput
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
            <span className="cursor-not-allowed opacity-60" title="시안 단계 — carry-over">일괄 처리</span>
            <span className="cursor-not-allowed opacity-60" title="시안 단계 — carry-over">송장 발급</span>
          </div>
        )}
      </div>

      {/* 테이블 — TH/TD inline 토큰 정합 (shadcn Table 마이그 carry-over) */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: 0,
          overflow: 'hidden',
        }}
      >
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr style={{ background: 'var(--surface-muted)', color: 'var(--foreground-muted)' }}>
              <th style={{ ...TH_STYLE, width: 36 }}>
                <CheckBox
                  checked={allSelected}
                  indeterminate={indeterminate}
                  onChange={toggleAll}
                  ariaLabel={allSelected ? '전체 선택 해제' : '전체 선택'}
                  disabled={rows.length === 0}
                />
              </th>
              <th style={TH_STYLE}>주문번호</th>
              <th style={TH_STYLE}>주문일시</th>
              <th style={TH_STYLE}>고객</th>
              <th style={TH_STYLE}>상품</th>
              <th style={{ ...TH_STYLE, textAlign: 'right' }}>금액</th>
              <th style={{ ...TH_STYLE, textAlign: 'right' }}>결제</th>
              <th style={{ ...TH_STYLE, textAlign: 'right' }}>상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  표시할 주문이 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((o, i) => {
                const sel = selected.includes(o.id);
                const status = describeStatus(o.status);
                return (
                  <tr
                    key={o.id}
                    style={{
                      borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                      background: sel ? 'var(--primary-soft)' : 'transparent',
                    }}
                  >
                    <td style={TD_STYLE}>
                      <CheckBox
                        checked={sel}
                        onChange={() => toggleRow(o.id)}
                        ariaLabel={sel ? `${o.orderNumber} 선택 해제` : `${o.orderNumber} 선택`}
                      />
                    </td>
                    <td style={TD_STYLE}>
                      <Link
                        href={`/admin/orders/${o.orderNumber}`}
                        className="gtr-mono text-xs text-[var(--primary)] font-medium no-underline"
                      >
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td
                      style={TD_STYLE}
                      className="text-xs text-muted-foreground tabular-nums"
                    >
                      {formatKstDateTime(o.createdAtIso)}
                    </td>
                    <td style={TD_STYLE} className="text-sm">
                      <div className="font-medium">{o.customerName}</div>
                      <div className="text-xs text-[var(--foreground-subtle)]">{o.contactEmail}</div>
                    </td>
                    <td style={{ ...TD_STYLE, maxWidth: 240 }} className="text-sm" title={o.itemsLabel}>
                      {o.itemsStructured.length === 0 ? (
                        <span className="opacity-50">—</span>
                      ) : (() => {
                        const first = o.itemsStructured[0];
                        const rest = o.itemsStructured.length - 1;
                        const detail = [
                          first.detail,
                          rest > 0 ? `+${rest}건` : '',
                        ].filter(Boolean).join(' · ');
                        return (
                          <div>
                            <div className="font-medium">{first.name}</div>
                            {detail && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {detail}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td
                      style={TD_STYLE}
                      className="text-sm text-right tabular-nums font-medium"
                    >
                      {o.totalAmount.toLocaleString()}원
                    </td>
                    <td style={{ ...TD_STYLE, textAlign: 'right' }} className="text-xs text-muted-foreground">
                      {o.paymentLabel}
                    </td>
                    <td style={{ ...TD_STYLE, textAlign: 'right' }}>
                      <Badge tone={status.tone} dot>
                        {status.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* 페이지네이션 */}
        <div className="px-5 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <div>{describeRange(filters.page, total)}</div>
          <div className="flex gap-1 items-center">
            <PageNav href={buildHref({ page: 1 })} disabled={filters.page === 1}>‹‹</PageNav>
            <PageNav href={buildHref({ page: Math.max(1, filters.page - 1) })} disabled={filters.page === 1}>‹</PageNav>
            {pageWindow.map((p, idx) =>
              p === 'ellipsis' ? (
                <span key={`e-${idx}`} style={ELLIPSIS_STYLE}>…</span>
              ) : (
                <PageNav key={p} href={buildHref({ page: p })} active={p === filters.page}>
                  {p}
                </PageNav>
              ),
            )}
            <PageNav href={buildHref({ page: Math.min(pageCount, filters.page + 1) })} disabled={filters.page === pageCount}>›</PageNav>
            <PageNav href={buildHref({ page: pageCount })} disabled={filters.page === pageCount}>››</PageNav>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── 공유 헬퍼 ──────────────────────────────────────────────────────── */

function describeRange(page: number, total: number): string {
  if (total === 0) return '0건';
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);
  return `${start.toLocaleString()} — ${end.toLocaleString()} / ${total.toLocaleString()}건`;
}

/** 페이지 번호 윈도우 — 7 페이지 이하면 전부 노출, 그 외엔 1 ... current-1 current current+1 ... last */
function buildPageWindow(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const window = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...window].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: Array<number | 'ellipsis'> = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('ellipsis');
    out.push(sorted[i]);
  }
  return out;
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

/* S222 PR-3: PageNav inline style 유지 (페이지네이션 버튼은 26×26 매우 특수 사이즈 ·
   shadcn Button size 변종에 없음 · `!h-... !w-...` override 다수 발생 → inline 더 명료). */
const PAGE_BUTTON_BASE: React.CSSProperties = {
  minWidth: 26,
  height: 26,
  padding: '0 6px',
  borderRadius: 5,
  fontSize: 12,
  fontVariantNumeric: 'tabular-nums',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
};

const ELLIPSIS_STYLE: React.CSSProperties = {
  ...PAGE_BUTTON_BASE,
  color: 'var(--foreground-subtle)',
  cursor: 'default',
};

function PageNav({
  href,
  children,
  active,
  disabled,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  const style: React.CSSProperties = {
    ...PAGE_BUTTON_BASE,
    border: '1px solid ' + (active ? 'var(--primary)' : 'var(--border)'),
    background: active ? 'var(--primary)' : 'var(--surface)',
    color: active ? '#fff' : disabled ? 'var(--foreground-subtle)' : 'var(--foreground)',
    fontWeight: active ? 500 : 400,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    pointerEvents: disabled ? 'none' : 'auto',
  };
  if (disabled) {
    return <span style={style}>{children}</span>;
  }
  return (
    <Link href={href} replace style={style} aria-current={active ? 'page' : undefined}>
      {children}
    </Link>
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

/* S222 PR-3: shadcn Input + 검색 아이콘 prefix + clear 버튼 wrapper.
   shadcn Input 의 기본 h-9 (36) 를 사용 — admin SearchInput 의 h34 와 2px 차이 (허용). */
function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative flex flex-1 max-w-[360px] items-center">
      <span
        aria-hidden
        className="pointer-events-none absolute left-2.5 flex text-[var(--foreground-subtle)]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </span>
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-8 pr-7"
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="검색어 지우기"
          title="지우기"
          className="absolute right-2 flex cursor-pointer rounded text-[var(--foreground-subtle)] hover:text-[var(--foreground)]"
          style={{ padding: 2 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      )}
    </div>
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
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="!h-7"
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
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            minWidth: 160,
            padding: 4,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            listStyle: 'none',
            zIndex: 10,
          }}
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
                  className={`w-full text-left px-2.5 py-1.5 border-none rounded text-sm cursor-pointer ${
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

const Plus = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </svg>
);

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

/* S222 PR-3: SM_BASE / SM_SECONDARY / SM_PRIMARY 폐기 (shadcn Button 으로 대체).
   S223 Phase 2-c: MoreIcon 폐기 (⋯ actions 컬럼 mock + disabled 였음 · 제거). */
