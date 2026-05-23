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
import { describeError } from '@/lib/admin/errorDescribe';
import { reorderCafeMenusAction, toggleCafeMenuActiveAction } from './actions';

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

type ReorderableCat = 'brewing' | 'tea' | 'non-coffee' | 'dessert';

function isReorderableCat(t: TabFilter): t is ReorderableCat {
  return (
    t === 'brewing' || t === 'tea' || t === 'non-coffee' || t === 'dessert'
  );
}

export default function MenuTableClient({ rows }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabFilter>('all');
  const [searchValue, setSearchValue] = useState('');
  /* 옵션 C — 미리보기 + 저장 버튼 패턴 (DEC-R-1~3).
     products 답습 (S250-6-#1+). */
  const [rowsState, setRowsState] = useState(rows);
  const [originalSnapshot, setOriginalSnapshot] = useState(rows);
  const [savePending, startSaveTransition] = useTransition();

  /* rows props 갱신 시 sync. dirty 가 있으면 sortOrder 보존. */
  useEffect(() => {
    setOriginalSnapshot(rows);
    setRowsState((prev) => {
      const prevSortMap = new Map(prev.map((r) => [r.id, r.sortOrder]));
      const wasDirty = rows.some((r) => {
        const ps = prevSortMap.get(r.id);
        return ps !== undefined && ps !== r.sortOrder;
      });
      if (!wasDirty) return rows;
      return rows.map((r) => ({
        ...r,
        sortOrder: prevSortMap.has(r.id)
          ? (prevSortMap.get(r.id) as number)
          : r.sortOrder,
      }));
    });
  }, [rows]);

  const isOrderDirty = useMemo(() => {
    /* ordered id 배열 비교 — sortOrder 값이 아니라 cat 내 순서 자체가
       original 과 다른지 감지. swap 후 swap-back 시 false 정합. */
    const cats: AdminCafeMenuListItem['cat'][] = [
      'brewing',
      'tea',
      'non-coffee',
      'dessert',
    ];
    for (const cat of cats) {
      const origIds = originalSnapshot
        .filter((r) => r.cat === cat)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((r) => r.id)
        .join(',');
      const currIds = rowsState
        .filter((r) => r.cat === cat)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((r) => r.id)
        .join(',');
      if (origIds !== currIds) return true;
    }
    return false;
  }, [rowsState, originalSnapshot]);

  const isReorderActive =
    isReorderableCat(tab) && searchValue.trim() === '';

  const orderedSameCategoryIds = useMemo(() => {
    if (!isReorderableCat(tab)) return [] as string[];
    return rowsState
      .filter((r) => r.cat === tab)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((r) => r.id);
  }, [rowsState, tab]);

  /* 탭 변경 — dirty 시 자동 폐기 + info toast (DEC-R-2 = a). */
  function handleTabChange(next: TabFilter) {
    if (isOrderDirty) {
      setRowsState(originalSnapshot);
      toast.info('저장하지 않은 순서 변경이 폐기되었습니다');
    }
    setTab(next);
  }

  /* ↑/↓/★ 클릭 = 미리보기 swap (server 호출 없음). */
  function previewReorder(orderedMenuIds: string[]) {
    if (!isReorderableCat(tab)) return;
    const idMap = new Map(orderedMenuIds.map((id, idx) => [id, idx]));
    setRowsState((prev) =>
      prev.map((r) =>
        idMap.has(r.id) ? { ...r, sortOrder: idMap.get(r.id) as number } : r,
      ),
    );
  }

  function handleMoveUp(menuId: string) {
    const idx = orderedSameCategoryIds.indexOf(menuId);
    if (idx <= 0) return;
    const next = [...orderedSameCategoryIds];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    previewReorder(next);
  }

  function handleMoveDown(menuId: string) {
    const idx = orderedSameCategoryIds.indexOf(menuId);
    if (idx < 0 || idx >= orderedSameCategoryIds.length - 1) return;
    const next = [...orderedSameCategoryIds];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    previewReorder(next);
  }

  function handleMoveToFront(menuId: string) {
    const idx = orderedSameCategoryIds.indexOf(menuId);
    if (idx <= 0) return;
    const next = [...orderedSameCategoryIds];
    const [id] = next.splice(idx, 1);
    next.unshift(id);
    previewReorder(next);
  }

  /* "순서 저장" — 현재 cat ordered ids 를 server 호출. */
  function handleSaveOrder() {
    if (!isOrderDirty || !isReorderableCat(tab)) return;
    const orderedMenuIds = rowsState
      .filter((r) => r.cat === tab)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((r) => r.id);

    startSaveTransition(async () => {
      const result = await reorderCafeMenusAction({
        cat: tab,
        orderedMenuIds,
      });
      if (!result.ok) {
        toast.error(describeError(result.error, result.detail));
        return;
      }
      toast.success('메뉴 순서를 저장했습니다');
    });
  }

  /* "변경 취소" — 즉시 rowsState ← originalSnapshot (DEC-R-3 = a). */
  function handleCancelOrder() {
    setRowsState(originalSnapshot);
  }

  const filtered = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    const result = rowsState.filter((r) => {
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
    /* cat 탭에서는 sortOrder asc 로 화면 정렬 — 미리보기 swap 즉시 반영.
       'all' / 'signature' 는 server 정렬 그대로. */
    if (!isReorderableCat(tab)) return result;
    return [...result].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [rowsState, tab, searchValue]);

  const counts = useMemo(() => {
    let sig = 0;
    let b = 0;
    let t = 0;
    let n = 0;
    let d = 0;
    for (const r of rowsState) {
      if (r.status === '시그니처') sig += 1;
      if (r.cat === 'brewing') b += 1;
      else if (r.cat === 'tea') t += 1;
      else if (r.cat === 'non-coffee') n += 1;
      else if (r.cat === 'dessert') d += 1;
    }
    return {
      all: rowsState.length,
      signature: sig,
      brewing: b,
      tea: t,
      'non-coffee': n,
      dessert: d,
    };
  }, [rowsState]);

  const columns: readonly Column<AdminCafeMenuListItem>[] = useMemo(() => {
    const cols: Column<AdminCafeMenuListItem>[] = [];

    /* tab 이 cat 4탭일 때만 순서 변경 컬럼 표시.
       'all' / 'signature' 에서는 cat 무관 → hide. */
    if (isReorderableCat(tab)) {
      const reorderTooltip = !isReorderActive
        ? searchValue.trim() !== ''
          ? '검색 해제 후 순서 변경 가능'
          : undefined
        : undefined;
      cols.push({
        key: 'reorder',
        header: '순서 변경',
        width: 'w-[120px]',
        align: 'center',
        render: (row) => {
          const idx = orderedSameCategoryIds.indexOf(row.id);
          const isFirst = idx === 0;
          const isLast = idx === orderedSameCategoryIds.length - 1;
          return (
            <ReorderButtons
              isFirst={isFirst}
              isLast={isLast}
              pending={savePending}
              tooltip={reorderTooltip}
              onMoveUp={() => handleMoveUp(row.id)}
              onMoveDown={() => handleMoveDown(row.id)}
              onMoveToFront={() => handleMoveToFront(row.id)}
            />
          );
        },
      });
    }

    cols.push(
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
    );

    return cols;
  }, [
    tab,
    orderedSameCategoryIds,
    savePending,
    isReorderActive,
    searchValue,
  ]);

  return (
    <>
      <AdminTopbarActions>
        {isOrderDirty ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="!h-7"
              onClick={handleCancelOrder}
              disabled={savePending}
            >
              변경 취소
            </Button>
            <Button
              type="button"
              size="sm"
              className="!h-7"
              onClick={handleSaveOrder}
              disabled={savePending}
            >
              {savePending ? '저장 중…' : '변경사항 저장'}
            </Button>
          </>
        ) : (
          <Button asChild size="sm" className="!h-7">
            <Link href="/admin/menu/new">
              <PlusIcon />
              신규 메뉴
            </Link>
          </Button>
        )}
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
        onChange={(id) => handleTabChange(id as TabFilter)}
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
        toast.error(describeError(result.error, result.detail));
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

/* ── 순서 변경 버튼 셀 — ProductsTableClient 답습 (S250-6-#1+) ──── */

function ReorderButtons({
  isFirst,
  isLast,
  pending,
  tooltip,
  onMoveUp,
  onMoveDown,
  onMoveToFront,
}: {
  isFirst: boolean;
  isLast: boolean;
  pending: boolean;
  tooltip: string | undefined;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveToFront: () => void;
}) {
  const disabled = pending || tooltip !== undefined;
  return (
    <span
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center justify-center gap-1"
    >
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="!size-7"
        onClick={onMoveUp}
        disabled={disabled || isFirst}
        aria-label="앞으로 이동"
        title={tooltip ?? '앞으로 이동'}
      >
        <ChevronUpIcon />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="!size-7"
        onClick={onMoveDown}
        disabled={disabled || isLast}
        aria-label="뒤로 이동"
        title={tooltip ?? '뒤로 이동'}
      >
        <ChevronDownIcon />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="!size-7"
        onClick={onMoveToFront}
        disabled={disabled || isFirst}
        aria-label="맨 앞으로"
        title={tooltip ?? '맨 앞으로'}
      >
        <ChevronsUpIcon />
      </Button>
    </span>
  );
}

function ChevronUpIcon() {
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
      <path d="m6 15 6-6 6 6" />
    </svg>
  );
}

function ChevronDownIcon() {
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
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ChevronsUpIcon() {
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
      <path d="m7 11 5-5 5 5" />
      <path d="m7 17 5-5 5 5" />
    </svg>
  );
}
