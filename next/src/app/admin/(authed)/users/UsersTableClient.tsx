'use client';

/* ══════════════════════════════════════════════════════════════════════════
   UsersTableClient — /admin/users 인터랙티브 본체 (S169 PR-1 Group C-1)

   S228 PR-A — Orders 답습 패턴 적용 (5 inline 답습 폐기):
   - 페이지 헤더    → AdminPageHeader
   - ROLE_TABS      → AdminTabsNav (mode='url')
   - TH/TD inline   → AdminDataTable (Column<ListedUser> + footer 슬롯)
   - colSpan 빈     → AdminEmptyState (variant='table-row')
   - PageNav etc.   → AdminPagination (mode='url')

   행 클릭 = router.push(/admin/users/[id]) 추가 (S228 결정).
   이메일 Link 셀은 stopPropagation 으로 행 클릭과 분리.
   describeRange 패턴 = `총 N명 · M~K번째` (S228 잠금).

   carry-over (별 sprint):
   - PR-3: 역할 변경 다이얼로그 (admin_audit 카드 포함)
   ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AdminSearchInput } from '@/components/admin/AdminSearchInput';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminTabsNav } from '@/components/admin/AdminTabsNav';
import { AdminDataTable, type Column } from '@/components/admin/AdminDataTable';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import { AdminPagination } from '@/components/admin/AdminPagination';
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
  neutral: { bg: 'var(--neutral-soft)', fg: 'var(--neutral-soft-fg)', dot: 'var(--foreground-muted)' },
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

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: readonly Column<ListedUser>[] = useMemo(() => [
    {
      key: 'email',
      header: '이메일',
      render: (u) => (
        <Link
          href={`/admin/users/${u.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-[var(--primary)] font-medium no-underline"
        >
          {u.email}
        </Link>
      ),
    },
    {
      key: 'name',
      header: '이름',
      cellClassName: 'text-sm',
      render: (u) => {
        const name = resolveUserName(u);
        return (
          <>
            <div className="font-medium">{name}</div>
            {u.fullName && u.displayName && u.displayName !== u.fullName && (
              <div className="text-xs text-muted-foreground mt-0.5">
                {u.fullName}
              </div>
            )}
          </>
        );
      },
    },
    {
      key: 'role',
      header: '역할',
      render: (u) => {
        const role = describeRole(u.role);
        return (
          <Badge tone={role.tone} dot>
            {role.label}
          </Badge>
        );
      },
    },
    {
      key: 'joinedAt',
      header: '가입일',
      cellClassName: 'text-xs text-muted-foreground tabular-nums',
      render: (u) => formatJoinedDate(u.createdAtIso),
    },
    {
      key: 'orderCount',
      header: '주문수',
      align: 'right',
      cellClassName: 'text-sm tabular-nums font-medium',
      render: (u) => u.orderCount.toLocaleString(),
    },
  ], []);

  return (
    <>
      <AdminPageHeader
        title="고객 관리"
        subtitle={
          <>
            총 {counts.all.toLocaleString()}명
            {counts.admin > 0 ? ` · 운영자 ${counts.admin.toLocaleString()}명` : ''}
          </>
        }
      />

      <AdminTabsNav
        mode="url"
        tabs={ROLE_TABS.map((t) => ({
          id: t.id,
          label: t.label,
          count: counts[t.id] ?? 0,
        }))}
        active={filters.role}
        buildHref={(id) => buildHref({ role: id as RoleTabKey, page: 1 })}
      />

      {/* 필터 바 — 검색만 */}
      <div className="flex gap-2 mb-3 items-center">
        <AdminSearchInput
          value={searchValue}
          onChange={setSearchValue}
          placeholder="이메일, 이름으로 검색…"
        />
      </div>

      <AdminDataTable
        columns={columns}
        data={rows}
        rowKey={(u) => u.id}
        onRowClick={(u) => router.push(`/admin/users/${u.id}`)}
        empty={
          <AdminEmptyState
            variant="table-row"
            colSpan={columns.length}
            message="표시할 사용자가 없습니다."
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
  if (total === 0) return '0명';
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);
  return `총 ${total.toLocaleString()}명 · ${start.toLocaleString()}~${end.toLocaleString()}번째`;
}

/* ── 로컬 컴포넌트 ─────────────────────────────────────────────────── */

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
