'use client';

/* ══════════════════════════════════════════
   BizInquiriesClient — 비즈 문의 목록 + 확장 상세 + 상태 변경 (S250-3 · S304)
   - 상태 필터(세그먼트) + 검색(회사/담당자/이메일) + 페이지네이션 (URL state · S304)
   - 행 클릭 시 상세 패널 펼침. 상태 버튼(신규/연락중/종결) → updateBizInquiryStatus.
   NewsletterClient URL-state 패턴 답습.
   ══════════════════════════════════════════ */

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { BizInquiryRow, BizInquiryStatus } from '@/lib/admin/bizInquiriesServer';
import {
  describeBizType,
  describeBizVolume,
  describeBizCycle,
  describeBizProducts,
  BIZ_STATUS_LABEL,
  BIZ_STATUS_ORDER,
  BIZ_PAGE_SIZE,
  type BizStatusTab,
  type BizSearchParams,
} from '@/lib/admin/bizInquiries';
import { AdminTabsNav } from '@/components/admin/AdminTabsNav';
import { AdminSearchInput } from '@/components/admin/AdminSearchInput';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { Button } from '@/components/admin/ui/button';
import { updateBizInquiryStatus } from './actions';

type Props = {
  rows: BizInquiryRow[];
  total: number;
  counts: Record<BizStatusTab, number>;
  filters: BizSearchParams;
};

const STATUS_TABS: { id: BizStatusTab; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'pending', label: '신규' },
  { id: 'contacted', label: '연락중' },
  { id: 'closed', label: '종결' },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function describeRange(page: number, total: number): string {
  if (total === 0) return '0건';
  const from = (page - 1) * BIZ_PAGE_SIZE + 1;
  const to = Math.min(page * BIZ_PAGE_SIZE, total);
  return `총 ${total.toLocaleString()}건 · ${from}–${to}번째`;
}

const STATUS_BADGE: Record<BizInquiryStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  contacted: 'bg-blue-100 text-blue-800',
  closed: 'bg-gray-200 text-gray-700',
};

function StatusBadge({ status }: { status: BizInquiryStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${STATUS_BADGE[status]}`}>
      {BIZ_STATUS_LABEL[status]}
    </span>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className="flex-1 whitespace-pre-wrap break-words">{value}</span>
    </div>
  );
}

export default function BizInquiriesClient({ rows, total, counts, filters }: Props) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState(filters.q);

  useEffect(() => {
    setSearchValue(filters.q);
  }, [filters.q]);

  /* URL builder — 현재 filters + override */
  function buildHref(override: Partial<BizSearchParams>): string {
    const merged = { ...filters, ...override };
    const params = new URLSearchParams();
    if (merged.status !== 'all') params.set('status', merged.status);
    if (merged.q.trim().length > 0) params.set('q', merged.q.trim());
    if (merged.page > 1) params.set('page', String(merged.page));
    const qs = params.toString();
    return qs.length > 0 ? `?${qs}` : '?';
  }

  /* 검색 — 300ms debounced router.replace */
  useEffect(() => {
    if (searchValue === filters.q) return;
    const t = setTimeout(() => {
      router.replace(buildHref({ q: searchValue, page: 1 }));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  function handleStatusChange(id: string, status: BizInquiryStatus) {
    setPendingId(id);
    startTransition(async () => {
      const res = await updateBizInquiryStatus({ id, status });
      setPendingId(null);
      if (!res.ok) {
        toast.error('상태 변경 실패', {
          description: res.error === 'unauthorized' ? '권한이 없습니다.' : '잠시 후 다시 시도해 주세요.',
        });
        return;
      }
      toast.success(`상태를 '${BIZ_STATUS_LABEL[status]}'(으)로 변경했습니다.`);
    });
  }

  const pageCount = Math.max(1, Math.ceil(total / BIZ_PAGE_SIZE));

  return (
    <>
      {/* 상태 필터 — 언더라인 탭 (1차 목록 필터 · Orders/Users/Subscriptions 정합) */}
      <AdminTabsNav
        mode="url"
        tabs={STATUS_TABS.map((t) => ({ id: t.id, label: t.label, count: counts[t.id] ?? 0 }))}
        active={filters.status}
        buildHref={(id) => buildHref({ status: id as BizStatusTab, page: 1 })}
      />

      <div className="flex gap-2 mb-3 items-center">
        <AdminSearchInput
          value={searchValue}
          onChange={setSearchValue}
          placeholder="회사·담당자·이메일로 검색…"
        />
      </div>

      <div className="border border-border rounded-md overflow-hidden bg-card">
        {rows.length === 0 ? (
          <p className="px-4 py-12 text-center text-muted-foreground text-sm">
            {filters.q.trim().length > 0 || filters.status !== 'all'
              ? '조건에 맞는 문의가 없습니다.'
              : '접수된 비즈 문의가 없습니다.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">회사</th>
                <th className="px-4 py-3 font-medium">담당자</th>
                <th className="px-4 py-3 font-medium">업종</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 font-medium">문의일</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isOpen = expandedId === r.id;
                const isRowPending = pending && pendingId === r.id;
                return (
                  <FragmentRow
                    key={r.id}
                    row={r}
                    isOpen={isOpen}
                    isRowPending={isRowPending}
                    onToggle={() => setExpandedId(isOpen ? null : r.id)}
                    onStatusChange={handleStatusChange}
                    formatDate={formatDate}
                  />
                );
              })}
            </tbody>
          </table>
        )}

        {/* 페이지네이션 footer */}
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

function FragmentRow({
  row: r,
  isOpen,
  isRowPending,
  onToggle,
  onStatusChange,
  formatDate,
}: {
  row: BizInquiryRow;
  isOpen: boolean;
  isRowPending: boolean;
  onToggle: () => void;
  onStatusChange: (id: string, status: BizInquiryStatus) => void;
  formatDate: (iso: string) => string;
}) {
  return (
    <>
      <tr
        className="border-t border-border cursor-pointer hover:bg-muted/30"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <td className="px-4 py-3 font-medium">{r.company}</td>
        <td className="px-4 py-3 text-muted-foreground">{r.name}</td>
        <td className="px-4 py-3 text-muted-foreground">{describeBizType(r.bizType)}</td>
        <td className="px-4 py-3">
          <StatusBadge status={r.status} />
        </td>
        <td className="px-4 py-3 text-muted-foreground tabular-nums">{formatDate(r.createdAtIso)}</td>
      </tr>
      {isOpen && (
        <tr className="border-t border-border bg-muted/20">
          <td colSpan={5} className="px-4 py-4">
            <div className="flex flex-col gap-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <DetailField label="담당자" value={r.name} />
                <DetailField label="이메일" value={r.email} />
                <DetailField label="연락처" value={r.phone} />
                <DetailField label="회원여부" value={r.userId ? '회원' : '비회원'} />
                <DetailField label="업종" value={describeBizType(r.bizType)} />
                <DetailField label="사업자번호" value={r.regNum ?? '—'} />
                <DetailField label="주소" value={r.address} />
                <DetailField label="관심 제품" value={describeBizProducts(r.products)} />
                <DetailField label="월 사용량" value={describeBizVolume(r.monthlyVolume)} />
                <DetailField label="납품 주기" value={describeBizCycle(r.deliveryCycle)} />
                <DetailField label="보유 장비" value={r.equipment ?? '—'} />
                <DetailField label="현재 원두" value={r.currentBean ?? '—'} />
              </div>
              <DetailField label="문의 내용" value={r.message} />

              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <span className="text-muted-foreground text-xs">상태 변경</span>
                {BIZ_STATUS_ORDER.map((s) => {
                  const isCurrent = s === r.status;
                  return (
                    <Button
                      key={s}
                      type="button"
                      size="sm"
                      /* min-w 고정 — 라벨 길이/variant(outline↔default border)/두께
                         변화와 무관하게 폭 고정 → 클릭 시 버튼 위치 흔들림 제거.
                         가장 넓은 '연락중'(3자) 굵게 렌더 기준 여유 폭. */
                      className="!h-7 min-w-[72px]"
                      variant={isCurrent ? 'default' : 'outline'}
                      disabled={isRowPending || isCurrent}
                      onClick={(e) => {
                        e.stopPropagation();
                        onStatusChange(r.id, s);
                      }}
                    >
                      {BIZ_STATUS_LABEL[s]}
                    </Button>
                  );
                })}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
