'use client';

import Link from 'next/link';
import { useMemo, type CSSProperties, type ReactNode } from 'react';

/* ══════════════════════════════════════════════════════════════════════════
   AdminPagination — 어드민 26×26 페이지네이션 표준 (S227 DEC-9)

   답습 source (3 페이지 inline 답습 폐기):
   - OrdersTableClient.tsx:443-491 PAGE_BUTTON_BASE + PageNav + buildPageWindow
   - UsersTableClient.tsx · SubscriptionsTableClient.tsx 동일 구조

   기준 (admin-design.md §5-14):
   - 26×26 매우 특수 사이즈 (shadcn Button size 매트릭스 외)
   - inline style 유지가 명료 — Tailwind arbitrary 로 풀어도 가독성 손실
   - 윈도우 = 7 이하 전부 / 그 외 `1 ... current-1 current current+1 ... last`
   - 양 끝 점프 (‹‹ / ››)

   discriminated union 으로 URL state / local state 양 모드:
   - mode 'url'   = buildHref(page) → Link href
   - mode 'state' = onPageChange(page) → button onClick

   범위 텍스트 ("1 — 10 / 30건") 는 caller 책임 — sibling 으로 작성.
   AdminPagination 자체는 페이지 버튼 그리드만.

   참조: ADR-009 · admin-design.md §5-14 · §13
   ══════════════════════════════════════════════════════════════════════════ */

const PAGE_BUTTON_BASE: CSSProperties = {
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

const ELLIPSIS_STYLE: CSSProperties = {
  ...PAGE_BUTTON_BASE,
  color: 'var(--foreground-subtle)',
  cursor: 'default',
};

type AdminPaginationProps = {
  /** 1-base 현재 페이지 */
  page: number;
  /** 1-base 총 페이지 수 (>= 1) */
  pageCount: number;
  /** 윈도우 사이즈 (기본 7) — 이하 = 전부 표시 */
  windowSize?: number;
} & (
  | { mode: 'url'; buildHref: (next: number) => string }
  | { mode: 'state'; onPageChange: (next: number) => void }
);

export function AdminPagination(props: AdminPaginationProps) {
  const { page, pageCount, windowSize = 7 } = props;
  const safePageCount = Math.max(1, pageCount);
  const window = useMemo(
    () => buildPageWindow(page, safePageCount, windowSize),
    [page, safePageCount, windowSize],
  );

  return (
    <div className="flex gap-1 items-center">
      <NavItem {...props} target={1} disabled={page === 1}>
        ‹‹
      </NavItem>
      <NavItem {...props} target={Math.max(1, page - 1)} disabled={page === 1}>
        ‹
      </NavItem>
      {window.map((p, idx) =>
        p === 'ellipsis' ? (
          <span key={`e-${idx}`} style={ELLIPSIS_STYLE} aria-hidden="true">
            …
          </span>
        ) : (
          <NavItem key={p} {...props} target={p} active={p === page}>
            {p}
          </NavItem>
        ),
      )}
      <NavItem
        {...props}
        target={Math.min(safePageCount, page + 1)}
        disabled={page === safePageCount}
      >
        ›
      </NavItem>
      <NavItem {...props} target={safePageCount} disabled={page === safePageCount}>
        ››
      </NavItem>
    </div>
  );
}

type NavItemProps = AdminPaginationProps & {
  target: number;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
};

function NavItem(props: NavItemProps) {
  const { target, active, disabled, children } = props;
  const style: CSSProperties = {
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

  if (props.mode === 'url') {
    return (
      <Link
        href={props.buildHref(target)}
        replace
        style={style}
        aria-current={active ? 'page' : undefined}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => props.onPageChange(target)}
      style={style}
      aria-current={active ? 'page' : undefined}
    >
      {children}
    </button>
  );
}

/** 페이지 번호 윈도우 — windowSize 이하면 전부, 그 외엔 1 ... current-1 current current+1 ... last */
function buildPageWindow(
  current: number,
  total: number,
  windowSize: number,
): Array<number | 'ellipsis'> {
  if (total <= windowSize) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: Array<number | 'ellipsis'> = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('ellipsis');
    out.push(sorted[i]);
  }
  return out;
}
