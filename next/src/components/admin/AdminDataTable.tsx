'use client';

import type { ReactNode } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/admin/ui/table';
import { cn } from '@/lib/utils';

/* ══════════════════════════════════════════════════════════════════════════
   AdminDataTable — 어드민 표준 테이블 (S227 DEC-10)

   답습 source (4 페이지 TH_STYLE/TD_STYLE inline 답습 폐기):
   - OrdersTableClient.tsx:70-85 (TH/TD inline + cell color hierarchy)
   - UsersTableClient.tsx · SubscriptionsTableClient.tsx · ProductsTableClient.tsx

   shadcn `Table` 위 합성 (wrapper 아님 — ADR-007 정합).

   기준 (admin-design.md §5-3):
   - TH 12px 16px / TD 12px 16px (table-cell + table-head 의 padding override)
   - TH font-medium uppercase letter-spacing 0.04em color foreground-muted
   - TH background surface-muted (thead row bg)
   - TD vertical-align middle
   - cell color hierarchy = column.render 책임 (S225 잠금 답습)
     · 주 이름 = text-sm font-medium
     · 보조 = text-xs text-muted-foreground
     · 링크 = text-xs text-[var(--primary)] gtr-mono

   tbody first-tr top border 제거 (thead 와 인접) — shadcn TableBody 기본
   `[&_tr:last-child]:border-0` 만 처리, 첫 tr 은 thead 의 bottom border 활용.

   Selection / sort 는 column.render 책임 (header 에 Checkbox / sort indicator
   직접 렌더). 별 sort hook 도입은 caller 가 진짜 필요할 때.

   참조: ADR-007 (shadcn 채택) · ADR-009 · admin-design.md §5-3 · §13
   ══════════════════════════════════════════════════════════════════════════ */

export type Column<T> = {
  key: string;
  header: ReactNode;
  /** 셀 정렬 (TH 와 TD 동시 적용) */
  align?: 'left' | 'right' | 'center';
  /** width 클래스 (예: 'w-[60px]') — caller 의 의도적 고정 width */
  width?: string;
  /** TH 추가 className */
  headClassName?: string;
  /** TD 추가 className (행 데이터 받지 않음 — 정렬/색상 등 정적인 것만) */
  cellClassName?: string;
  /** 행 데이터로부터 셀 내용 생성 — cell color hierarchy 책임 */
  render: (row: T) => ReactNode;
};

type AdminDataTableProps<T> = {
  columns: readonly Column<T>[];
  data: readonly T[];
  /** 각 행의 unique key 추출 (React key + selection key) */
  rowKey: (row: T) => string;
  /** 행 클릭 = 상세 페이지 진입 등 */
  onRowClick?: (row: T) => void;
  /** 행 강조 (primary-soft 배경) */
  isRowSelected?: (row: T) => boolean;
  /** 빈 상태 노드 (AdminEmptyState variant='table-row' 권장) */
  empty?: ReactNode;
  /** 테이블 외부 wrapper className (border / radius 등) */
  className?: string;
};

const TH_PADDING = 'px-4 py-3';
const TD_PADDING = 'px-4 py-3';
const TH_TYPOGRAPHY =
  'text-xs font-medium uppercase tracking-[0.04em] text-[var(--foreground-muted)]';

export function AdminDataTable<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  isRowSelected,
  empty,
  className,
}: AdminDataTableProps<T>) {
  return (
    <div
      className={cn(
        'bg-[var(--surface)] border border-border rounded-[var(--radius)] overflow-hidden',
        className,
      )}
    >
      <Table>
        <TableHeader>
          <TableRow
            className="hover:bg-transparent"
            style={{ background: 'var(--surface-muted)' }}
          >
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  TH_PADDING,
                  TH_TYPOGRAPHY,
                  'h-auto whitespace-nowrap',
                  col.align === 'right' && 'text-right',
                  col.align === 'center' && 'text-center',
                  col.width,
                  col.headClassName,
                )}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 && empty
            ? empty
            : data.map((row) => {
                const selected = isRowSelected?.(row) ?? false;
                return (
                  <TableRow
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      onRowClick && 'cursor-pointer',
                      selected && '!bg-[var(--primary-soft)]',
                    )}
                  >
                    {columns.map((col) => (
                      <TableCell
                        key={col.key}
                        className={cn(
                          TD_PADDING,
                          'align-middle',
                          col.align === 'right' && 'text-right',
                          col.align === 'center' && 'text-center',
                          col.cellClassName,
                        )}
                      >
                        {col.render(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
        </TableBody>
      </Table>
    </div>
  );
}
