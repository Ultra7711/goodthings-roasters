'use client';

/* ══════════════════════════════════════════════════════════════════════════
   ProductsTableClient — /admin/products 인터랙티브 본체 (S218 Phase 1)

   책임:
   - 카테고리 탭 (전체 / Coffee Bean / Drip Bag) — useState 필터
   - 검색 (slug · name) — useState 필터
   - 테이블 행: thumb / slug+name / category / status / 가격 /
                is_active 토글 / sort_order / updated_at
   - is_active 인라인 토글 → toggleProductActiveAction + sonner toast
   - 행 클릭 → /admin/products/[id]/edit (Step 5 에서 페이지 생성)

   패턴: app/admin/(authed)/orders/OrdersTableClient.tsx 답습 (inline style).
   ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
import { AdminSearchInput } from '@/components/admin/AdminSearchInput';
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

/* S223 토큰 정합 — Orders 패턴 답습 (TH 12 / TD className hierarchy). */
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

/* S222 PR-4: SM_PRIMARY 폐기 (shadcn Button asChild + Link). */

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

      {/* 헤더 — Orders 패턴 답습 */}
      <div className="mb-5">
        <h2 className="m-0 text-2xl font-medium tracking-tight">상품 관리</h2>
        <div className="mt-1 text-sm text-muted-foreground">
          원두·드립백 상품 목록 · 활성/비활성 토글 + 편집 진입
        </div>
      </div>

      {/* 카테고리 탭 + 검색 */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex gap-1 border-b border-border flex-1 min-w-0">
          {CATEGORY_TABS.map((t) => {
            const active = t.id === category;
            const n =
              t.id === 'all'
                ? counts.all
                : t.id === 'coffee_bean'
                  ? counts.coffee_bean
                  : counts.drip_bag;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setCategory(t.id)}
                className={`px-3 py-2 border-none bg-transparent cursor-pointer text-sm relative inline-flex items-center gap-1.5 ${
                  active
                    ? 'font-medium text-foreground'
                    : 'font-normal text-muted-foreground'
                }`}
              >
                {t.label}
                <span className="text-xs text-[var(--foreground-subtle)] tabular-nums">
                  {n}
                </span>
                {active && (
                  <span
                    aria-hidden
                    className="absolute left-0 right-0 h-0.5 bg-[var(--primary)]"
                    style={{ bottom: -1 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <AdminSearchInput
          value={searchValue}
          onChange={setSearchValue}
          placeholder="slug / 상품명 검색"
        />
      </div>

      {/* 테이블 */}
      <div className="bg-[var(--surface)] border border-border rounded-[var(--radius)] overflow-hidden">
        <table className="w-full border-collapse">
          <thead style={{ background: 'var(--surface-muted)' }}>
            <tr>
              <th style={{ ...TH_STYLE, width: 56 }}>이미지</th>
              <th style={TH_STYLE}>상품</th>
              <th style={{ ...TH_STYLE, width: 110 }}>카테고리</th>
              <th style={{ ...TH_STYLE, width: 96 }}>상태</th>
              <th style={{ ...TH_STYLE, width: 110, textAlign: 'right' }}>
                가격
              </th>
              <th style={{ ...TH_STYLE, width: 92, textAlign: 'center' }}>
                활성
              </th>
              <th style={{ ...TH_STYLE, width: 72, textAlign: 'right' }}>
                정렬
              </th>
              <th style={{ ...TH_STYLE, width: 132 }}>최근 수정</th>
              <th style={{ ...TH_STYLE, width: 32 }} aria-hidden />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  {rows.length === 0
                    ? '등록된 상품이 없습니다.'
                    : '필터 조건에 해당하는 상품이 없습니다.'}
                </td>
              </tr>
            ) : (
              filtered.map((row, i) => (
                <ProductRow
                  key={row.id}
                  row={row}
                  isFirst={i === 0}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-2.5 text-xs text-[var(--foreground-subtle)] tabular-nums">
        총 {filtered.length}건
        {filtered.length !== rows.length && ` (전체 ${rows.length}건)`}
      </div>
    </>
  );
}

/* ── 행 컴포넌트 ─────────────────────────────────────────────────────── */

function ProductRow({
  row,
  isFirst,
}: {
  row: AdminProductListItem;
  isFirst: boolean;
}) {
  const [pending, startTransition] = useTransition();
  /* optimistic — 토글 직후 즉시 반영, 실패 시 rollback */
  const [optimisticActive, setOptimisticActive] = useState(row.isActive);

  /* row.isActive 가 외부에서 갱신되면 (revalidatePath 후 새 데이터) sync.
     pending 중에는 optimistic 상태 유지. */
  useEffect(() => {
    if (!pending) setOptimisticActive(row.isActive);
  }, [row.isActive, pending]);

  const tone = row.status ? STATUS_TONE[row.status] : null;
  const editHref = `/admin/products/${row.slug}/edit`;

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
    <tr className={isFirst ? undefined : 'border-t border-border'}>
      <td style={TD_STYLE}>
        <Link
          href={editHref}
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
      </td>
      <td style={TD_STYLE} className="text-sm">
        <Link href={editHref} className="text-foreground no-underline">
          <div className="font-medium">{row.name}</div>
          <div className="gtr-mono text-xs text-[var(--foreground-subtle)] mt-0.5">
            {row.slug}
          </div>
        </Link>
      </td>
      <td style={TD_STYLE}>
        <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full border border-border whitespace-nowrap">
          {CATEGORY_LABEL[row.category]}
        </span>
      </td>
      <td style={TD_STYLE}>
        {tone && row.status ? (
          <ShadcnBadge
            variant="outline"
            className="border-transparent"
            style={{ background: TONES[tone].bg, color: TONES[tone].fg }}
          >
            {row.status}
          </ShadcnBadge>
        ) : (
          <span className="text-xs text-[var(--foreground-subtle)]">—</span>
        )}
      </td>
      <td
        style={{ ...TD_STYLE, textAlign: 'right' }}
        className="text-sm tabular-nums font-medium"
      >
        {row.displayPrice}
      </td>
      <td style={{ ...TD_STYLE, textAlign: 'center' }}>
        <Switch
          checked={optimisticActive}
          onCheckedChange={handleToggle}
          disabled={pending}
          aria-label={optimisticActive ? '판매중 — 클릭하면 비공개' : '비공개 — 클릭하면 판매중'}
          className="data-[state=unchecked]:bg-[var(--switch-off-bg)]"
        />
      </td>
      <td
        style={{ ...TD_STYLE, textAlign: 'right' }}
        className="text-sm tabular-nums text-muted-foreground"
      >
        {row.sortOrder}
      </td>
      <td
        style={TD_STYLE}
        className="text-xs text-muted-foreground tabular-nums"
      >
        {formatKstShort(row.updatedAt)}
      </td>
      <td style={{ ...TD_STYLE, textAlign: 'right' }}>
        <Link
          href={editHref}
          aria-label="편집"
          className="text-muted-foreground inline-flex p-1"
        >
          <ChevronRightIcon />
        </Link>
      </td>
    </tr>
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

function ChevronRightIcon() {
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
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
