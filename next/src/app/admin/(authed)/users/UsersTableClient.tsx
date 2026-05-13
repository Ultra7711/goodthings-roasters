'use client';

/* ══════════════════════════════════════════════════════════════════════════
   UsersTableClient — /admin/users 인터랙티브 본체 (S169 PR-1 Group C-1)

   책임:
   - admin 영역 표준 inline style (gooddays · cafe-events 답습 — shadcn X)
   - role 탭은 <Link href> (URL state)
   - 검색은 debounced router.replace
   - 행 클릭 → /admin/users/[id] (PR-2 도달)

   carry-over (별 sprint):
   - PR-2: 상세 (/[id])
   - PR-3: 역할 변경 다이얼로그 (admin_audit 카드 포함)
   ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AdminSearchInput } from '@/components/admin/AdminSearchInput';
import { Badge as ShadcnBadge } from '@/components/admin/ui/badge';
import {
  PAGE_SIZE,
  ROLE_TABS,
  describeRole,
  formatJoinedDate,
  resolveUserName,
  type AdminUsersSearchParams,
  type ListedUser,
  type RoleTabKey,
  type RoleTone,
} from '@/lib/admin/users';

type CountsShape = Record<RoleTabKey, number>;

type Props = {
  rows: ListedUser[];
  total: number;
  counts: CountsShape;
  filters: AdminUsersSearchParams;
};

const TONES: Record<RoleTone, { bg: string; fg: string; dot: string }> = {
  primary: { bg: 'var(--primary-soft)', fg: 'var(--primary-soft-fg)', dot: 'var(--primary)' },
  neutral: { bg: 'var(--neutral-soft)', fg: 'var(--neutral-soft-fg)', dot: '#888' },
};

/* S223 토큰 정합 — Orders 패턴 답습. */
const TH_STYLE: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--foreground-muted)',
};

const TD_STYLE: React.CSSProperties = {
  padding: '12px 16px',
  verticalAlign: 'middle',
};

export default function UsersTableClient({ rows, total, counts, filters }: Props) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(filters.q);

  /* filters.q 가 외부에서 바뀌면 input 도 동기화 */
  useEffect(() => {
    setSearchValue(filters.q);
  }, [filters.q]);

  /* URL builder — 현재 filters + override */
  function buildHref(override: Partial<AdminUsersSearchParams>): string {
    const merged = { ...filters, ...override };
    const params = new URLSearchParams();
    if (merged.role !== 'all') params.set('role', merged.role);
    if (merged.q.trim().length > 0) params.set('q', merged.q.trim());
    if (merged.page > 1) params.set('page', String(merged.page));
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
  const pageWindow = useMemo(
    () => buildPageWindow(filters.page, pageCount),
    [filters.page, pageCount],
  );

  return (
    <>
      {/* 헤더 — Orders 패턴 답습 */}
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <h2 className="m-0 text-2xl font-medium tracking-tight">고객 관리</h2>
          <div className="mt-1 text-sm text-muted-foreground">
            총 {counts.all.toLocaleString()}명
            {counts.admin > 0 ? ` · 운영자 ${counts.admin.toLocaleString()}명` : ''}
          </div>
        </div>
      </div>

      {/* role 탭 */}
      <div className="flex gap-1 border-b border-border mb-4">
        {ROLE_TABS.map((t) => {
          const active = t.id === filters.role;
          const cnt = counts[t.id] ?? 0;
          return (
            <Link
              key={t.id}
              href={buildHref({ role: t.id, page: 1 })}
              replace
              className={`px-3 py-2 bg-transparent cursor-pointer text-sm relative flex items-center gap-1.5 no-underline ${
                active
                  ? 'font-medium text-foreground'
                  : 'font-normal text-muted-foreground'
              }`}
            >
              {t.label}
              <span
                className={`text-xs tabular-nums rounded-sm ${
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

      {/* 필터 바 — 검색만 */}
      <div className="flex gap-2 mb-3 items-center">
        <AdminSearchInput
          value={searchValue}
          onChange={setSearchValue}
          placeholder="이메일, 이름으로 검색…"
        />
      </div>

      {/* 테이블 */}
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
              <th style={TH_STYLE}>이메일</th>
              <th style={TH_STYLE}>이름</th>
              <th style={TH_STYLE}>역할</th>
              <th style={TH_STYLE}>가입일</th>
              <th style={{ ...TH_STYLE, textAlign: 'right' }}>주문수</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  표시할 사용자가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((u, i) => {
                const role = describeRole(u.role);
                const name = resolveUserName(u);
                return (
                  <tr
                    key={u.id}
                    style={{
                      borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                    }}
                  >
                    <td style={TD_STYLE}>
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="text-xs text-[var(--primary)] font-medium no-underline"
                      >
                        {u.email}
                      </Link>
                    </td>
                    <td style={TD_STYLE} className="text-sm">
                      <div className="font-medium">{name}</div>
                      {u.fullName && u.displayName && u.displayName !== u.fullName && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {u.fullName}
                        </div>
                      )}
                    </td>
                    <td style={TD_STYLE}>
                      <Badge tone={role.tone} dot>
                        {role.label}
                      </Badge>
                    </td>
                    <td
                      style={TD_STYLE}
                      className="text-xs text-muted-foreground tabular-nums"
                    >
                      {formatJoinedDate(u.createdAtIso)}
                    </td>
                    <td
                      style={{ ...TD_STYLE, textAlign: 'right' }}
                      className="text-sm tabular-nums font-medium"
                    >
                      {u.orderCount.toLocaleString()}
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
            <PageNav href={buildHref({ page: 1 })} disabled={filters.page === 1}>
              ‹‹
            </PageNav>
            <PageNav
              href={buildHref({ page: Math.max(1, filters.page - 1) })}
              disabled={filters.page === 1}
            >
              ‹
            </PageNav>
            {pageWindow.map((p, idx) =>
              p === 'ellipsis' ? (
                <span key={`e-${idx}`} style={ELLIPSIS_STYLE}>
                  …
                </span>
              ) : (
                <PageNav key={p} href={buildHref({ page: p })} active={p === filters.page}>
                  {p}
                </PageNav>
              ),
            )}
            <PageNav
              href={buildHref({ page: Math.min(pageCount, filters.page + 1) })}
              disabled={filters.page === pageCount}
            >
              ›
            </PageNav>
            <PageNav href={buildHref({ page: pageCount })} disabled={filters.page === pageCount}>
              ››
            </PageNav>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── 공유 헬퍼 ──────────────────────────────────────────────────────── */

function describeRange(page: number, total: number): string {
  if (total === 0) return '0명';
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);
  return `${start.toLocaleString()} — ${end.toLocaleString()} / ${total.toLocaleString()}명`;
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

/* S222 PR-5: shadcn Badge variant=outline + tone soft style override (DEC-2). */
function Badge({
  tone,
  children,
  dot,
}: {
  tone: RoleTone;
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
      {dot && (
        <span
          aria-hidden
          style={{ width: 5, height: 5, borderRadius: 999, background: t.dot }}
        />
      )}
      {children}
    </ShadcnBadge>
  );
}

/* S223 Phase 2-c: SearchInput → @/components/admin/AdminSearchInput (admin 공통). */
