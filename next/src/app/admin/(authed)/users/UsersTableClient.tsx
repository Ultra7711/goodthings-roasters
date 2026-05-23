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

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { exportUsersCsvAction } from './actions';
import { downloadXlsxFromBase64 } from '@/lib/admin/clientDownload';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
import { AdminSearchInput } from '@/components/admin/AdminSearchInput';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminTabsNav } from '@/components/admin/AdminTabsNav';
import { AdminDataTable, type Column } from '@/components/admin/AdminDataTable';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { Badge as ShadcnBadge } from '@/components/admin/ui/badge';
import { Button } from '@/components/admin/ui/button';
import {
  PAGE_SIZE,
  PROVIDER_OPTIONS,
  ROLE_TABS,
  describeProvider,
  describeRole,
  formatJoinedDate,
  resolveUserName,
  type AdminUsersSearchParams,
  type ListedUser,
  type ProviderFilterKey,
  type RoleTabKey,
  type RoleTone,
} from '@/lib/admin/users';

type CountsShape = Record<RoleTabKey, number>;

type Props = {
  rows: ListedUser[];
  total: number;
  counts: CountsShape;
  filters: AdminUsersSearchParams;
  /** S255-B: owner (관리자) 만 CSV 내보내기 활성. staff (운영자) 는 disabled. */
  isOwner: boolean;
};

const TONES: Record<RoleTone, { bg: string; fg: string; dot: string }> = {
  primary: { bg: 'var(--primary-soft)', fg: 'var(--primary-soft-fg)', dot: 'var(--primary)' },
  neutral: { bg: 'var(--neutral-soft)', fg: 'var(--neutral-soft-fg)', dot: 'var(--foreground-muted)' },
};

export default function UsersTableClient({ rows, total, counts, filters, isOwner }: Props) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(filters.q);
  const [isExporting, startExport] = useTransition();

  /* filters.q 가 외부에서 바뀌면 input 도 동기화 */
  useEffect(() => {
    setSearchValue(filters.q);
  }, [filters.q]);

  /* CSV 내보내기 — 현재 role/provider/q 필터 적용. truncated 시 안내.
     S255-B: orders/subscriptions handleExport 답습. */
  function handleExport() {
    startExport(async () => {
      const result = await exportUsersCsvAction({
        role: filters.role,
        provider: filters.provider,
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
        toast.info('내보낼 고객이 없습니다.');
        return;
      }
      downloadXlsxFromBase64(result.xlsxBase64, result.filename);
      if (result.truncated) {
        toast.warning(
          `${result.rowCount.toLocaleString()}명 내보냈습니다. 상한(10,000건) 초과 — 필터를 좁혀 다시 내보내주세요.`,
        );
      } else {
        toast.success(`${result.rowCount.toLocaleString()}명을 내보냈습니다.`);
      }
    });
  }

  /* URL builder — 현재 filters + override */
  function buildHref(override: Partial<AdminUsersSearchParams>): string {
    const merged = { ...filters, ...override };
    const params = new URLSearchParams();
    if (merged.role !== 'all') params.set('role', merged.role);
    if (merged.provider !== 'all') params.set('provider', merged.provider);
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
        const role = describeRole(u.role, u.adminLevel);
        return (
          <Badge tone={role.tone} dot>
            {role.label}
          </Badge>
        );
      },
    },
    {
      key: 'signupProvider',
      header: '가입 채널',
      cellClassName: 'text-xs text-muted-foreground',
      render: (u) => describeProvider(u.signupProvider),
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

      {/* 필터 바 — 검색 + 가입 채널 */}
      <div className="flex gap-2 mb-3 items-center">
        <AdminSearchInput
          value={searchValue}
          onChange={setSearchValue}
          placeholder="이메일, 이름으로 검색…"
        />
        <DropdownFilter
          label="가입 채널"
          options={PROVIDER_OPTIONS}
          activeId={filters.provider}
          onChange={(id) => router.replace(buildHref({ provider: id as ProviderFilterKey, page: 1 }))}
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

/* S232: 가입 채널 DropdownFilter. Orders 답습 (1 caller hypothetical seam — S227 audit
   결과 보류 결정 답습 · 별 추출 안 함). */
function DropdownFilter({
  label,
  options,
  activeId,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ id: string; label: string }>;
  activeId: string;
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
        {isDefault ? label : `${label}: ${activeOpt.label}`}
        <ChevronDown />
      </Button>
      {open && (
        <ul role="listbox" className="admin-dropdown-menu">
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
