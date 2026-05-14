'use client';

/* ══════════════════════════════════════════════════════════════════════════
   ProductsTableClient — /admin/products 인터랙티브 본체 (S218 Phase 1)

   S228 PR-A — Orders/Users/Subscriptions 답습 패턴 적용 (4 inline 답습 폐기):
   - 페이지 헤더    → AdminPageHeader
   - CATEGORY_TABS  → AdminTabsNav (mode='state' · local state 탭)
   - TH/TD inline   → AdminDataTable (Column<AdminProductListItem>)
   - colSpan 빈     → AdminEmptyState (variant='table-row')

   페이지네이션 ❌ — DEC (전체 표시 · 카탈로그 작음).
   행 클릭 = router.push(/admin/products/[slug]/edit) 추가 (S228 결정).
   chevron 컬럼 폐기 — 4 페이지 정합 (cursor-pointer + hover 가 시각 cue).
   Switch / 상품명 Link 셀 = stopPropagation 으로 행 클릭과 분리.
   활성 토글 셀 = ProductActiveSwitch 별 컴포넌트 (optimistic state hook).

   "총 N건" footer 라벨 — 페이지네이션 없으므로 단순 텍스트 (테이블 외부).

   자동 답습 (primitive 효과):
   - admin/ui/input + outline button 배경 white
   - AdminTabsNav active count badge = primary bg + !text-white
   - TableRow border-color = var(--border)
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
import type { AdminProductListItem } from '@/types/product';
import type { ProductStatus } from '@/lib/products';
import { toggleProductActiveAction } from './actions';

type Props = {
  rows: AdminProductListItem[];
};

type CategoryFilter = 'all' | 'coffee_bean' | 'drip_bag';

const CATEGORY_TABS: ReadonlyArray<{ id: CategoryFilter; label: string }> = [
  { id: 'all', label: '전체' },
  { id: 'coffee_bean', label: 'Coffee Bean' },
  { id: 'drip_bag', label: 'Drip Bag' },
];

const CATEGORY_LABEL: Record<AdminProductListItem['category'], string> = {
  coffee_bean: 'Coffee Bean',
  drip_bag: 'Drip Bag',
};

type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary';

const STATUS_TONE: Record<NonNullable<ProductStatus>, StatusTone> = {
  NEW: 'primary',
  '인기 NO.1': 'warning',
  '인기 NO.2': 'warning',
  '인기 NO.3': 'warning',
  '수량 한정': 'danger',
  품절: 'neutral',
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

export default function ProductsTableClient({ rows }: Props) {
  const router = useRouter();
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [searchValue, setSearchValue] = useState('');

  const filtered = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    return rows.filter((r) => {
      if (category !== 'all' && r.category !== category) return false;
      if (q.length > 0) {
        const hay = `${r.slug} ${r.name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, category, searchValue]);

  const counts = useMemo(() => {
    let cb = 0;
    let db = 0;
    for (const r of rows) {
      if (r.category === 'coffee_bean') cb += 1;
      else if (r.category === 'drip_bag') db += 1;
    }
    return { all: rows.length, coffee_bean: cb, drip_bag: db };
  }, [rows]);

  const columns: readonly Column<AdminProductListItem>[] = useMemo(() => [
    {
      key: 'thumb',
      header: '이미지',
      width: 'w-14',
      render: (row) => {
        const editHref = `/admin/products/${row.slug}/edit`;
        return (
          <Link
            href={editHref}
            onClick={(e) => e.stopPropagation()}
            className="block w-10 h-10 rounded-md border border-border overflow-hidden relative"
            style={{
              background:
                'repeating-linear-gradient(135deg, #EEEDEB 0 5px, #F5F4F2 5px 10px)',
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
      header: '상품',
      cellClassName: 'text-sm',
      render: (row) => (
        <Link
          href={`/admin/products/${row.slug}/edit`}
          onClick={(e) => e.stopPropagation()}
          className="text-foreground no-underline"
        >
          <div className="font-medium">{row.name}</div>
          <div className="gtr-mono text-xs text-[var(--foreground-subtle)] mt-0.5">
            {row.slug}
          </div>
        </Link>
      ),
    },
    {
      key: 'category',
      header: '카테고리',
      width: 'w-[110px]',
      render: (row) => (
        <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full border border-border whitespace-nowrap">
          {CATEGORY_LABEL[row.category]}
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
      key: 'price',
      header: '가격',
      width: 'w-[110px]',
      align: 'right',
      cellClassName: 'text-sm tabular-nums font-medium',
      render: (row) => row.displayPrice,
    },
    {
      key: 'active',
      header: '활성',
      width: 'w-24',
      align: 'center',
      render: (row) => <ProductActiveSwitch row={row} />,
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
          <Link href="/admin/products/new">
            <PlusIcon />
            신규 상품
          </Link>
        </Button>
      </AdminTopbarActions>

      <AdminPageHeader
        title="상품 관리"
        subtitle="상품 목록 · 활성/비활성 토글로 웹페이지 연동"
      />

      <AdminTabsNav
        mode="state"
        tabs={CATEGORY_TABS.map((t) => ({
          id: t.id,
          label: t.label,
          count:
            t.id === 'all'
              ? counts.all
              : t.id === 'coffee_bean'
                ? counts.coffee_bean
                : counts.drip_bag,
        }))}
        active={category}
        onChange={(id) => setCategory(id as CategoryFilter)}
      />

      {/* 검색 — 별 행 (Orders/Users/Subscriptions 답습) */}
      <div className="flex gap-2 mb-3 items-center">
        <AdminSearchInput
          value={searchValue}
          onChange={setSearchValue}
          placeholder="slug / 상품명 검색"
        />
      </div>

      <AdminDataTable
        columns={columns}
        data={filtered}
        rowKey={(row) => row.id}
        onRowClick={(row) => router.push(`/admin/products/${row.slug}/edit`)}
        empty={
          <AdminEmptyState
            variant="table-row"
            colSpan={columns.length}
            message={
              rows.length === 0
                ? '등록된 상품이 없습니다.'
                : '필터 조건에 해당하는 상품이 없습니다.'
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

/* ── 활성 토글 셀 — optimistic state hook 보유 별 컴포넌트 ─────────── */

function ProductActiveSwitch({ row }: { row: AdminProductListItem }) {
  const [pending, startTransition] = useTransition();
  /* optimistic — 토글 직후 즉시 반영, 실패 시 rollback */
  const [optimisticActive, setOptimisticActive] = useState(row.isActive);

  /* row.isActive 가 외부에서 갱신되면 (revalidatePath 후 새 데이터) sync.
     pending 중에는 optimistic 상태 유지. */
  useEffect(() => {
    if (!pending) setOptimisticActive(row.isActive);
  }, [row.isActive, pending]);

  function handleToggle() {
    const next = !optimisticActive;
    setOptimisticActive(next);
    startTransition(async () => {
      const result = await toggleProductActiveAction({
        id: row.id,
        isActive: next,
      });
      if (!result.ok) {
        setOptimisticActive(!next);
        const msg =
          result.error === 'unauthorized'
            ? '권한이 없습니다. 다시 로그인해주세요.'
            : result.error === 'not_found'
              ? '상품을 찾을 수 없습니다.'
              : result.error === 'validation_failed'
                ? '입력값이 올바르지 않습니다.'
                : '처리 중 오류가 발생했습니다.';
        toast.error(msg);
        return;
      }
      toast.success(next ? '판매중으로 전환했습니다' : '비공개로 전환했습니다');
    });
  }

  return (
    <span onClick={(e) => e.stopPropagation()}>
      <Switch
        checked={optimisticActive}
        onCheckedChange={handleToggle}
        disabled={pending}
        aria-label={optimisticActive ? '판매중 — 클릭하면 비공개' : '비공개 — 클릭하면 판매중'}
        className="data-[state=unchecked]:bg-[var(--switch-off-bg)]"
      />
    </span>
  );
}

/* ── 아이콘 ──────────────────────────────────────────────────────────── */

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
