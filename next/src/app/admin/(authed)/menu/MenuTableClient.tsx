'use client';

/* ══════════════════════════════════════════════════════════════════════════
   MenuTableClient — /admin/menu 인터랙티브 본체 (S244)

   ProductsTableClient 1:1 답습 + cafe-menu 특화:
   - 6탭 (전체 / 시그니처 / 브루잉 / 티 / 논커피 / 디저트)
     시그니처는 cat 무관 status='시그니처' 필터
   - 칼럼: 이미지 / 이름+ID / 카테고리 / 온도 / 가격 / 공개 / 정렬 / 최근수정
   - 행 클릭 → /admin/menu/[id]/edit
   - 활성 토글 (optimistic) — toggleCafeMenuActiveAction
   - 페이지네이션 ❌ (카탈로그 ~35종 작음 · products 답습)
   ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
import { AdminSearchInput } from '@/components/admin/AdminSearchInput';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminTabsNav } from '@/components/admin/AdminTabsNav';
import { AdminDataTable, type Column } from '@/components/admin/AdminDataTable';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import { Button } from '@/components/admin/ui/button';
import { Badge as ShadcnBadge } from '@/components/admin/ui/badge';
import { Switch } from '@/components/admin/ui/switch';
import type { AdminCafeMenuListItem } from '@/types/cafeMenu';
import { toggleCafeMenuActiveAction } from './actions';

type Props = {
  rows: AdminCafeMenuListItem[];
};

type TabFilter = 'all' | 'signature' | 'brewing' | 'tea' | 'non-coffee' | 'dessert';

const TABS: ReadonlyArray<{ id: TabFilter; label: string }> = [
  { id: 'all', label: '전체' },
  { id: 'signature', label: '시그니처' },
  { id: 'brewing', label: '브루잉' },
  { id: 'tea', label: '티' },
  { id: 'non-coffee', label: '논커피' },
  { id: 'dessert', label: '디저트' },
];

const CAT_LABEL: Record<AdminCafeMenuListItem['cat'], string> = {
  brewing: 'Brewing',
  tea: 'Tea',
  'non-coffee': 'Non-Coffee',
  dessert: 'Dessert',
};

const TEMP_LABEL: Record<NonNullable<AdminCafeMenuListItem['temp']>, string> = {
  'ice-only': 'ICE',
  'hot-only': 'HOT',
  warm: 'WARM',
  both: 'ICE/HOT',
};

type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary';

const STATUS_TONE: Record<string, StatusTone> = {
  '시그니처': 'primary',
  NEW: 'success',
  '인기': 'warning',
  '시즌': 'info',
  '시즌 한정': 'info',
  '품절': 'neutral',
};

const TONES: Record<StatusTone, { bg: string; fg: string }> = {
  neutral: { bg: 'var(--neutral-soft)', fg: 'var(--neutral-soft-fg)' },
  success: { bg: 'var(--success-soft)', fg: 'var(--success)' },
  warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)' },
  danger: { bg: 'var(--danger-soft)', fg: 'var(--danger)' },
  info: { bg: 'var(--info-soft)', fg: 'var(--info)' },
  primary: { bg: 'var(--primary-soft)', fg: 'var(--primary-soft-fg)' },
};

const KST_DATE = new Intl.DateTimeFormat('ko-KR', {
  year: '2-digit',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatKstShort(iso: string): string {
  try {
    return KST_DATE.format(new Date(iso));
  } catch {
    return '—';
  }
}

export default function MenuTableClient({ rows }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabFilter>('all');
  const [searchValue, setSearchValue] = useState('');

  const filtered = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab === 'signature') {
        if (r.status !== '시그니처') return false;
      } else if (tab !== 'all') {
        if (r.cat !== tab) return false;
      }
      if (q.length > 0) {
        const hay = `${r.id} ${r.name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, tab, searchValue]);

  const counts = useMemo(() => {
    let sig = 0;
    let b = 0;
    let t = 0;
    let n = 0;
    let d = 0;
    for (const r of rows) {
      if (r.status === '시그니처') sig += 1;
      if (r.cat === 'brewing') b += 1;
      else if (r.cat === 'tea') t += 1;
      else if (r.cat === 'non-coffee') n += 1;
      else if (r.cat === 'dessert') d += 1;
    }
    return {
      all: rows.length,
      signature: sig,
      brewing: b,
      tea: t,
      'non-coffee': n,
      dessert: d,
    };
  }, [rows]);

  const columns: readonly Column<AdminCafeMenuListItem>[] = useMemo(() => [
    {
      key: 'thumb',
      header: '이미지',
      width: 'w-14',
      render: (row) => {
        const editHref = `/admin/menu/${row.id}/edit`;
        return (
          <Link
            href={editHref}
            onClick={(e) => e.stopPropagation()}
            className="block w-10 h-10 rounded-md border border-border overflow-hidden relative"
            style={{
              background:
                'repeating-linear-gradient(135deg, var(--placeholder-pattern-1) 0 5px, var(--placeholder-pattern-2) 5px 10px)',
            }}
          >
            {row.thumbSrc && (
              <Image
                src={row.thumbSrc}
                alt=""
                fill
                sizes="40px"
                style={{ objectFit: 'cover' }}
                placeholder={row.thumbBlurDataUrl ? 'blur' : 'empty'}
                blurDataURL={row.thumbBlurDataUrl ?? undefined}
              />
            )}
          </Link>
        );
      },
    },
    {
      key: 'name',
      header: '메뉴',
      cellClassName: 'text-sm',
      render: (row) => (
        <Link
          href={`/admin/menu/${row.id}/edit`}
          onClick={(e) => e.stopPropagation()}
          className="text-foreground no-underline"
        >
          <div className="font-medium">{row.name}</div>
          <div className="gtr-mono text-xs text-[var(--foreground-subtle)] mt-0.5">
            {row.id}
          </div>
        </Link>
      ),
    },
    {
      key: 'cat',
      header: '카테고리',
      width: 'w-[110px]',
      render: (row) => (
        <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full border border-border whitespace-nowrap">
          {CAT_LABEL[row.cat]}
        </span>
      ),
    },
    {
      key: 'status',
      header: '상태',
      width: 'w-24',
      render: (row) => {
        const tone = row.status ? STATUS_TONE[row.status] : null;
        if (!tone || !row.status) {
          return <span className="text-xs text-[var(--foreground-subtle)]">—</span>;
        }
        return (
          <ShadcnBadge
            variant="outline"
            className="border-transparent"
            style={{ background: TONES[tone].bg, color: TONES[tone].fg }}
          >
            {row.status}
          </ShadcnBadge>
        );
      },
    },
    {
      key: 'temp',
      header: '온도',
      width: 'w-[88px]',
      render: (row) => {
        if (!row.temp) {
          return <span className="text-xs text-[var(--foreground-subtle)]">—</span>;
        }
        return (
          <span className="text-xs text-muted-foreground gtr-mono">
            {TEMP_LABEL[row.temp as NonNullable<AdminCafeMenuListItem['temp']>] ?? row.temp}
          </span>
        );
      },
    },
    {
      key: 'price',
      header: '가격',
      width: 'w-[110px]',
      align: 'right',
      cellClassName: 'text-sm tabular-nums font-medium',
      render: (row) => row.displayPrice,
    },
    {
      key: 'active',
      header: '공개',
      width: 'w-24',
      align: 'center',
      render: (row) => <MenuActiveSwitch row={row} />,
    },
    {
      key: 'sortOrder',
      header: '정렬',
      width: 'w-[72px]',
      align: 'right',
      cellClassName: 'text-sm tabular-nums text-muted-foreground',
      render: (row) => row.sortOrder,
    },
    {
      key: 'updatedAt',
      header: '최근 수정',
      width: 'w-[132px]',
      cellClassName: 'text-xs text-muted-foreground tabular-nums',
      render: (row) => formatKstShort(row.updatedAt),
    },
  ], []);

  return (
    <>
      <AdminTopbarActions>
        <Button asChild size="sm" className="!h-7">
          <Link href="/admin/menu/new">
            <PlusIcon />
            신규 메뉴
          </Link>
        </Button>
      </AdminTopbarActions>

      <AdminPageHeader
        title="카페 메뉴 관리"
        subtitle="메뉴 카탈로그 · 공개/비공개 토글로 웹페이지 연동"
      />

      <AdminTabsNav
        mode="state"
        tabs={TABS.map((t) => ({
          id: t.id,
          label: t.label,
          count: counts[t.id],
        }))}
        active={tab}
        onChange={(id) => setTab(id as TabFilter)}
      />

      <div className="flex gap-2 mb-3 items-center">
        <AdminSearchInput
          value={searchValue}
          onChange={setSearchValue}
          placeholder="ID / 메뉴명 검색"
        />
      </div>

      <AdminDataTable
        columns={columns}
        data={filtered}
        rowKey={(row) => row.id}
        onRowClick={(row) => router.push(`/admin/menu/${row.id}/edit`)}
        empty={
          <AdminEmptyState
            variant="table-row"
            colSpan={columns.length}
            message={
              rows.length === 0
                ? '등록된 메뉴가 없습니다.'
                : '필터 조건에 해당하는 메뉴가 없습니다.'
            }
          />
        }
        footer={
          <div className="tabular-nums">
            총 {filtered.length.toLocaleString()}건
            {filtered.length !== rows.length && ` (전체 ${rows.length.toLocaleString()}건)`}
          </div>
        }
      />
    </>
  );
}

/* ── 활성 토글 셀 — optimistic state hook (products 답습) ──────────── */

function MenuActiveSwitch({ row }: { row: AdminCafeMenuListItem }) {
  const [pending, startTransition] = useTransition();
  const [optimisticActive, setOptimisticActive] = useState(row.isActive);

  useEffect(() => {
    if (!pending) setOptimisticActive(row.isActive);
  }, [row.isActive, pending]);

  function handleToggle() {
    const next = !optimisticActive;
    setOptimisticActive(next);
    startTransition(async () => {
      const result = await toggleCafeMenuActiveAction({
        id: row.id,
        isActive: next,
      });
      if (!result.ok) {
        setOptimisticActive(!next);
        const msg =
          result.error === 'unauthorized'
            ? '권한이 없습니다. 다시 로그인해 주세요.'
            : result.error === 'not_found'
              ? '메뉴를 찾을 수 없습니다.'
              : result.error === 'validation_failed'
                ? '입력값이 올바르지 않습니다.'
                : '처리 중 오류가 발생했습니다.';
        toast.error(msg);
        return;
      }
      toast.success(
        next ? '메뉴를 공개했습니다' : '메뉴를 비공개로 전환했습니다',
      );
    });
  }

  return (
    <span onClick={(e) => e.stopPropagation()}>
      <Switch
        checked={optimisticActive}
        onCheckedChange={handleToggle}
        disabled={pending}
        aria-label={
          optimisticActive
            ? '메뉴 공개 — 클릭하면 비공개'
            : '메뉴 비공개 — 클릭하면 공개'
        }
        className="data-[state=unchecked]:bg-[var(--switch-off-bg)]"
      />
    </span>
  );
}

function PlusIcon() {
  return (
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
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}
