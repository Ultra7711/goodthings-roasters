'use client';

/* ══════════════════════════════════════════
   AdminReviewsClient — 리뷰 모더레이션 목록 (S314 Step 5)
   status 탭 + 도메인(상품/메뉴) 필터 + 검색(본문/닉네임) + 페이지네이션 (URL state).
   행 펼침 → 전체 본문 + AI 결과 + 상태 전이(승인/차단/검토) + 영구삭제. owner-only.
   BizInquiriesClient 답습.
   ══════════════════════════════════════════ */

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { AdminReviewRow } from '@/lib/admin/reviewsServer';
import {
  REVIEW_STATUS_LABEL,
  REVIEW_ADMIN_PAGE_SIZE,
  type ReviewStatusTab,
  type ReviewDomainTab,
  type ReviewSearchParams,
} from '@/lib/admin/reviews';
import type { ReviewStatus } from '@/types/review';
import { AdminTabsNav } from '@/components/admin/AdminTabsNav';
import { AdminSearchInput } from '@/components/admin/AdminSearchInput';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { Button } from '@/components/admin/ui/button';
import { updateReviewStatus, deleteReviewPermanent } from './actions';

type Props = {
  rows: AdminReviewRow[];
  total: number;
  counts: Record<ReviewStatusTab, number>;
  filters: ReviewSearchParams;
};

const STATUS_TABS: { id: ReviewStatusTab; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'pending', label: '검토 대기' },
  { id: 'approved', label: '게재' },
  { id: 'blocked', label: '차단' },
  { id: 'deleted', label: '삭제' },
];

const DOMAIN_TABS: { id: ReviewDomainTab; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'product', label: '상품' },
  { id: 'menu', label: '메뉴' },
];

/* 어드민 상태 전이 (soft delete 'deleted' 는 작성자용 — 어드민은 영구삭제 사용) */
type ModStatus = 'pending' | 'approved' | 'blocked';
const MOD_STATUSES: ModStatus[] = ['approved', 'blocked', 'pending'];

const STATUS_BADGE: Record<ReviewStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  blocked: 'bg-red-100 text-red-800',
  deleted: 'bg-gray-200 text-gray-700',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function describeRange(page: number, total: number): string {
  if (total === 0) return '0건';
  const from = (page - 1) * REVIEW_ADMIN_PAGE_SIZE + 1;
  const to = Math.min(page * REVIEW_ADMIN_PAGE_SIZE, total);
  return `총 ${total.toLocaleString()}건 · ${from}–${to}번째`;
}

function describeTarget(r: AdminReviewRow): string {
  return r.productSlug ? `상품 · ${r.productSlug}` : `메뉴 · ${r.menuId ?? '—'}`;
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${STATUS_BADGE[status]}`}>
      {REVIEW_STATUS_LABEL[status]}
    </span>
  );
}

export default function AdminReviewsClient({ rows, total, counts, filters }: Props) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState(filters.q);

  useEffect(() => {
    setSearchValue(filters.q);
  }, [filters.q]);

  function buildHref(override: Partial<ReviewSearchParams>): string {
    const merged = { ...filters, ...override };
    const params = new URLSearchParams();
    if (merged.status !== 'all') params.set('status', merged.status);
    if (merged.domain !== 'all') params.set('domain', merged.domain);
    if (merged.q.trim().length > 0) params.set('q', merged.q.trim());
    if (merged.page > 1) params.set('page', String(merged.page));
    const qs = params.toString();
    return qs.length > 0 ? `?${qs}` : '?';
  }

  useEffect(() => {
    if (searchValue === filters.q) return;
    const t = setTimeout(() => {
      router.replace(buildHref({ q: searchValue, page: 1 }));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  function handleStatusChange(id: string, status: ModStatus) {
    setPendingId(id);
    startTransition(async () => {
      const res = await updateReviewStatus({ id, status });
      setPendingId(null);
      if (!res.ok) {
        toast.error('상태 변경 실패', {
          description: res.error === 'unauthorized' ? '권한이 없습니다.' : '잠시 후 다시 시도해 주세요.',
        });
        return;
      }
      toast.success(`상태를 '${REVIEW_STATUS_LABEL[status]}'(으)로 변경했습니다.`);
    });
  }

  function handleDelete(id: string) {
    if (!window.confirm('이 리뷰를 영구 삭제할까요? 되돌릴 수 없습니다.')) return;
    setPendingId(id);
    startTransition(async () => {
      const res = await deleteReviewPermanent(id);
      setPendingId(null);
      if (!res.ok) {
        toast.error('삭제 실패', {
          description: res.error === 'unauthorized' ? '권한이 없습니다.' : '잠시 후 다시 시도해 주세요.',
        });
        return;
      }
      toast.success('리뷰를 영구 삭제했습니다.');
      setExpandedId(null);
    });
  }

  const pageCount = Math.max(1, Math.ceil(total / REVIEW_ADMIN_PAGE_SIZE));

  return (
    <>
      <AdminTabsNav
        mode="url"
        tabs={STATUS_TABS.map((t) => ({ id: t.id, label: t.label, count: counts[t.id] ?? 0 }))}
        active={filters.status}
        buildHref={(id) => buildHref({ status: id as ReviewStatusTab, page: 1 })}
      />

      <div className="flex flex-wrap gap-2 mb-3 items-center">
        {/* 도메인 2차 필터 */}
        <div className="flex gap-1">
          {DOMAIN_TABS.map((d) => (
            <Button
              key={d.id}
              type="button"
              size="sm"
              className="!h-8"
              variant={filters.domain === d.id ? 'default' : 'outline'}
              onClick={() => router.replace(buildHref({ domain: d.id, page: 1 }))}
            >
              {d.label}
            </Button>
          ))}
        </div>
        <AdminSearchInput
          value={searchValue}
          onChange={setSearchValue}
          placeholder="본문·닉네임으로 검색…"
        />
      </div>

      <div className="border border-border rounded-md overflow-hidden bg-card">
        {rows.length === 0 ? (
          <p className="px-4 py-12 text-center text-muted-foreground text-sm">
            {filters.q.trim().length > 0 || filters.status !== 'all' || filters.domain !== 'all'
              ? '조건에 맞는 리뷰가 없습니다.'
              : '등록된 리뷰가 없습니다.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">대상</th>
                <th className="px-4 py-3 font-medium">별점</th>
                <th className="px-4 py-3 font-medium">작성자</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 font-medium">작성일</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isOpen = expandedId === r.id;
                const isRowPending = pending && pendingId === r.id;
                return (
                  <ReviewRow
                    key={r.id}
                    row={r}
                    isOpen={isOpen}
                    isRowPending={isRowPending}
                    onToggle={() => setExpandedId(isOpen ? null : r.id)}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDelete}
                  />
                );
              })}
            </tbody>
          </table>
        )}

        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border text-xs text-muted-foreground">
          <div>{describeRange(filters.page, total)}</div>
          <AdminPagination
            mode="url"
            page={filters.page}
            pageCount={pageCount}
            buildHref={(p) => buildHref({ page: p })}
          />
        </div>
      </div>
    </>
  );
}

function ReviewRow({
  row: r,
  isOpen,
  isRowPending,
  onToggle,
  onStatusChange,
  onDelete,
}: {
  row: AdminReviewRow;
  isOpen: boolean;
  isRowPending: boolean;
  onToggle: () => void;
  onStatusChange: (id: string, status: ModStatus) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <tr
        className="border-t border-border cursor-pointer hover:bg-muted/30"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <td className="px-4 py-3 text-muted-foreground">{describeTarget(r)}</td>
        <td className="px-4 py-3 tabular-nums">{'★'.repeat(r.rating)}</td>
        <td className="px-4 py-3 text-muted-foreground">{r.authorNickname}</td>
        <td className="px-4 py-3">
          <StatusBadge status={r.status} />
        </td>
        <td className="px-4 py-3 text-muted-foreground tabular-nums">{formatDate(r.createdAtIso)}</td>
      </tr>
      {isOpen && (
        <tr className="border-t border-border bg-muted/20">
          <td colSpan={5} className="px-4 py-4">
            <div className="flex flex-col gap-4">
              <p className="whitespace-pre-wrap break-words text-sm">{r.body}</p>
              <div className="text-xs text-muted-foreground">
                도움돼요 {r.helpfulCount} · 대상 {describeTarget(r)}
              </div>
              {r.moderationResult != null && (
                <pre className="text-xs bg-muted/40 rounded p-2 overflow-x-auto">
                  {JSON.stringify(r.moderationResult, null, 2)}
                </pre>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                <span className="text-muted-foreground text-xs">상태 변경</span>
                {MOD_STATUSES.map((s) => {
                  const isCurrent = s === r.status;
                  return (
                    <Button
                      key={s}
                      type="button"
                      size="sm"
                      className="!h-7 min-w-[72px]"
                      variant={isCurrent ? 'default' : 'outline'}
                      disabled={isRowPending || isCurrent}
                      onClick={(e) => {
                        e.stopPropagation();
                        onStatusChange(r.id, s);
                      }}
                    >
                      {REVIEW_STATUS_LABEL[s]}
                    </Button>
                  );
                })}
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="!h-7 ml-auto"
                  disabled={isRowPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(r.id);
                  }}
                >
                  영구 삭제
                </Button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
