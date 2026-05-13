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
  fontSize: 13,
};

const SM_PRIMARY: React.CSSProperties = {
  padding: '5px 10px',
  fontSize: 12,
  height: 28,
  borderRadius: 6,
  fontWeight: 500,
  background: 'var(--primary)',
  color: '#fff',
  border: '1px solid var(--primary)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  cursor: 'pointer',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
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
        <Link href="/admin/products/new" style={SM_PRIMARY}>
          <PlusIcon />
          신규 상품
        </Link>
      </AdminTopbarActions>

      {/* 헤더 */}
      <div style={{ marginBottom: 22 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 500,
            letterSpacing: '-0.02em',
          }}
        >
          상품 관리
        </h2>
        <div
          style={{
            marginTop: 4,
            fontSize: 13,
            color: 'var(--foreground-muted)',
          }}
        >
          원두·드립백 상품 목록 · 활성/비활성 토글 + 편집 진입
        </div>
      </div>

      {/* 카테고리 탭 + 검색 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 4,
            borderBottom: '1px solid var(--border)',
            flex: 1,
            minWidth: 0,
          }}
        >
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
                style={{
                  padding: '8px 14px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: active ? 500 : 400,
                  color: active
                    ? 'var(--foreground)'
                    : 'var(--foreground-muted)',
                  position: 'relative',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {t.label}
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--foreground-subtle)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {n}
                </span>
                {active && (
                  <span
                    aria-hidden
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
              </button>
            );
          })}
        </div>

        <input
          type="search"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="slug / 상품명 검색"
          style={{
            height: 32,
            padding: '0 10px',
            fontSize: 13,
            border: '1px solid var(--input)',
            borderRadius: 6,
            background: 'var(--surface)',
            color: 'var(--foreground)',
            outline: 'none',
            minWidth: 220,
          }}
        />
      </div>

      {/* 테이블 */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#FAFAF9' }}>
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
                <td
                  colSpan={9}
                  style={{
                    padding: '48px 14px',
                    textAlign: 'center',
                    fontSize: 13,
                    color: 'var(--foreground-muted)',
                  }}
                >
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

      <div
        style={{
          marginTop: 10,
          fontSize: 11.5,
          color: 'var(--foreground-subtle)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
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
  const editHref = `/admin/products/${row.id}/edit`;

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
    <tr
      style={{
        borderTop: isFirst ? 'none' : '1px solid var(--border)',
      }}
    >
      <td style={TD_STYLE}>
        <Link
          href={editHref}
          style={{
            display: 'block',
            width: 40,
            height: 40,
            borderRadius: 6,
            border: '1px solid var(--border)',
            overflow: 'hidden',
            position: 'relative',
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
      <td style={TD_STYLE}>
        <Link
          href={editHref}
          style={{ color: 'var(--foreground)', textDecoration: 'none' }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 500 }}>{row.name}</div>
          <div
            className="gtr-mono"
            style={{
              fontSize: 11.5,
              color: 'var(--foreground-subtle)',
              marginTop: 2,
            }}
          >
            {row.slug}
          </div>
        </Link>
      </td>
      <td style={TD_STYLE}>
        <span
          style={{
            fontSize: 11.5,
            color: 'var(--foreground-muted)',
            padding: '2px 8px',
            borderRadius: 999,
            border: '1px solid var(--border)',
            whiteSpace: 'nowrap',
          }}
        >
          {CATEGORY_LABEL[row.category]}
        </span>
      </td>
      <td style={TD_STYLE}>
        {tone && row.status ? (
          <span
            style={{
              display: 'inline-flex',
              padding: '2px 8px',
              borderRadius: 999,
              background: TONES[tone].bg,
              color: TONES[tone].fg,
              fontSize: 11.5,
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
          >
            {row.status}
          </span>
        ) : (
          <span style={{ color: 'var(--foreground-subtle)', fontSize: 11.5 }}>
            —
          </span>
        )}
      </td>
      <td
        style={{
          ...TD_STYLE,
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 500,
        }}
      >
        {row.displayPrice}
      </td>
      <td style={{ ...TD_STYLE, textAlign: 'center' }}>
        <button
          type="button"
          onClick={handleToggle}
          disabled={pending}
          aria-pressed={optimisticActive}
          aria-label={optimisticActive ? '판매중 — 클릭하면 비공개' : '비공개 — 클릭하면 판매중'}
          style={{
            position: 'relative',
            width: 36,
            height: 20,
            borderRadius: 999,
            border: 'none',
            background: optimisticActive ? 'var(--primary)' : 'var(--switch-off-bg)',
            cursor: pending ? 'wait' : 'pointer',
            transition: 'background 0.15s ease',
            padding: 0,
            opacity: pending ? 0.6 : 1,
          }}
        >
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: 2,
              left: optimisticActive ? 18 : 2,
              width: 16,
              height: 16,
              borderRadius: 999,
              background: '#fff',
              boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
              transition: 'left 0.15s ease',
            }}
          />
        </button>
      </td>
      <td
        style={{
          ...TD_STYLE,
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--foreground-muted)',
        }}
      >
        {row.sortOrder}
      </td>
      <td
        style={{
          ...TD_STYLE,
          fontSize: 11.5,
          color: 'var(--foreground-muted)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatKstShort(row.updatedAt)}
      </td>
      <td style={{ ...TD_STYLE, textAlign: 'right' }}>
        <Link
          href={editHref}
          aria-label="편집"
          style={{
            color: 'var(--foreground-muted)',
            display: 'inline-flex',
            padding: 4,
          }}
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
