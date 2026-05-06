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

const TH_STYLE: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 14px',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--foreground-muted)',
};

const TD_STYLE: React.CSSProperties = {
  padding: '11px 14px',
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
      {/* 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 18,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 500,
              letterSpacing: '-0.02em',
            }}
          >
            고객 관리
          </h2>
          <div style={{ marginTop: 4, fontSize: 13, color: 'var(--foreground-muted)' }}>
            총 {counts.all.toLocaleString()}명
            {counts.admin > 0 ? ` · 운영자 ${counts.admin.toLocaleString()}명` : ''}
          </div>
        </div>
      </div>

      {/* role 탭 */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: '1px solid var(--border)',
          marginBottom: 16,
        }}
      >
        {ROLE_TABS.map((t) => {
          const active = t.id === filters.role;
          const cnt = counts[t.id] ?? 0;
          return (
            <Link
              key={t.id}
              href={buildHref({ role: t.id, page: 1 })}
              replace
              style={{
                padding: '8px 14px',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                color: active ? 'var(--foreground)' : 'var(--foreground-muted)',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                textDecoration: 'none',
              }}
            >
              {t.label}
              <span
                style={{
                  fontSize: 11,
                  fontVariantNumeric: 'tabular-nums',
                  color: active ? 'var(--foreground-muted)' : 'var(--foreground-subtle)',
                  background: active ? 'var(--surface-muted)' : 'transparent',
                  padding: '1px 6px',
                  borderRadius: 4,
                }}
              >
                {cnt.toLocaleString()}
              </span>
              {active && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: -1,
                    height: 2,
                    background: 'var(--primary)',
                  }}
                />
              )}
            </Link>
          );
        })}
      </div>

      {/* 필터 바 — 검색만 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <SearchInput
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
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
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
                <td
                  colSpan={5}
                  style={{
                    padding: '48px 16px',
                    textAlign: 'center',
                    color: 'var(--foreground-muted)',
                  }}
                >
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
                        style={{
                          fontSize: 12.5,
                          color: 'var(--primary)',
                          fontWeight: 500,
                          textDecoration: 'none',
                        }}
                      >
                        {u.email}
                      </Link>
                    </td>
                    <td style={TD_STYLE}>
                      <div style={{ fontWeight: 500 }}>{name}</div>
                      {u.fullName && u.displayName && u.displayName !== u.fullName && (
                        <div style={{ fontSize: 11.5, color: 'var(--foreground-subtle)' }}>
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
                      style={{
                        ...TD_STYLE,
                        color: 'var(--foreground-muted)',
                        fontSize: 12,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatJoinedDate(u.createdAtIso)}
                    </td>
                    <td
                      style={{
                        ...TD_STYLE,
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 500,
                      }}
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
        <div
          style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12.5,
            color: 'var(--foreground-muted)',
          }}
        >
          <div>{describeRange(filters.page, total)}</div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
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
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        borderRadius: 999,
        background: t.bg,
        color: t.fg,
        fontSize: 11.5,
        fontWeight: 500,
        letterSpacing: '-0.005em',
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
      }}
    >
      {dot && (
        <span
          aria-hidden
          style={{ width: 5, height: 5, borderRadius: 999, background: t.dot }}
        />
      )}
      {children}
    </span>
  );
}

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
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 10px',
        height: 34,
        background: 'var(--surface)',
        border: '1px solid var(--input)',
        borderRadius: 6,
        flex: 1,
        maxWidth: 360,
      }}
    >
      <span style={{ color: 'var(--foreground-subtle)', display: 'flex' }}>
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
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 13,
          color: 'var(--foreground)',
          padding: 0,
          height: '100%',
        }}
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="검색어 지우기"
          title="지우기"
          style={{
            all: 'unset',
            cursor: 'pointer',
            color: 'var(--foreground-subtle)',
            display: 'flex',
            padding: 2,
            borderRadius: 4,
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
