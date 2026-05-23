'use client';

/* ══════════════════════════════════════════════════════════════════════════
   OrdersTableClient — /admin/orders 인터랙티브 본체 (S128 / S256-C 분리)

   책임 (orchestrator):
   - state: selected (selection state) · searchValue · isExporting
   - URL builder + 검색 debounce + 페이지 변경 시 선택 초기화
   - handleExport (Excel xlsx) — exportOrdersCsvAction + clientDownload
   - layout 조립: AdminTopbarActions / AdminPageHeader / AdminTabsNav /
     OrdersFilterBar / AdminDataTable + footer

   S256-C 분리:
   - columns 정의 → ordersColumns.tsx (buildOrdersColumns)
   - 필터 바 + DropdownFilter → OrdersFilterBar.tsx
   - 본 파일은 orchestrator 책임에 집중.
   ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { exportOrdersCsvAction } from './actions';
import { buildOrdersColumns } from './ordersColumns';
import OrdersFilterBar from './OrdersFilterBar';
import { downloadXlsxFromBase64 } from '@/lib/admin/clientDownload';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminTabsNav } from '@/components/admin/AdminTabsNav';
import { AdminDataTable } from '@/components/admin/AdminDataTable';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { Button } from '@/components/admin/ui/button';
import {
  PAGE_SIZE,
  STATUS_TABS,
  type AdminOrdersSearchParams,
  type ListedOrder,
  type StatusTabKey,
} from '@/lib/admin/orders';

type CountsShape = Record<StatusTabKey, number>;

type Props = {
  rows: ListedOrder[];
  total: number;
  counts: CountsShape;
  filters: AdminOrdersSearchParams;
  /** S232: owner (관리자) 만 Excel 내보내기 활성. staff (운영자) 는 disabled. */
  isOwner: boolean;
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

  /* Excel 내보내기 — 현재 status/period/payment/q 필터 적용. truncated 시 안내. */
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
      downloadXlsxFromBase64(result.xlsxBase64, result.filename);
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

  const columns = useMemo(
    () => buildOrdersColumns({
      rows,
      selected,
      allSelected,
      indeterminate,
      toggleRow,
      toggleAll,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, selected, allSelected, indeterminate],
  );

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
              : '현재 필터 기준으로 Excel 내보내기'
          }
        >
          <Download />
          {isExporting ? '내보내는 중…' : 'Excel 내보내기'}
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

      <OrdersFilterBar
        filters={filters}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onPeriodChange={(id) => router.replace(buildHref({ period: id, page: 1 }))}
        onPaymentChange={(id) => router.replace(buildHref({ payment: id, page: 1 }))}
        selectedCount={selected.length}
      />

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
