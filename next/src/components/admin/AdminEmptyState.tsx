import type { ReactNode } from 'react';

/* ══════════════════════════════════════════════════════════════════════════
   AdminEmptyState — 어드민 표준 빈 상태 (design.md §5-22)

   답습 source:
   - 테이블 colSpan 메시지: OrdersTableClient / UsersTableClient /
     SubscriptionsTableClient / ProductsTableClient
   - 카드 안 메시지: design.md §5-22 card variant

   variant 분리 사유:
   - 테이블 = <tr><td colSpan> 강제. <div> wrap 시 invalid HTML
   - 카드 = <div> + 패딩 60×40 + 선택적 action

   참조: ADR-009 · admin-design.md §5-22 · §13
   ══════════════════════════════════════════════════════════════════════════ */

type AdminEmptyStateProps =
  | { variant: 'table-row'; colSpan: number; message: string }
  | { variant: 'card'; message: string; action?: ReactNode };

export function AdminEmptyState(props: AdminEmptyStateProps) {
  if (props.variant === 'table-row') {
    return (
      <tr>
        <td
          colSpan={props.colSpan}
          className="px-4 py-12 text-center text-sm text-muted-foreground"
        >
          {props.message}
        </td>
      </tr>
    );
  }

  return (
    <div className="bg-[var(--surface)] border border-border rounded-[var(--radius)] py-[60px] px-10 text-center text-sm text-muted-foreground">
      <div>{props.message}</div>
      {props.action && <div className="mt-4">{props.action}</div>}
    </div>
  );
}
