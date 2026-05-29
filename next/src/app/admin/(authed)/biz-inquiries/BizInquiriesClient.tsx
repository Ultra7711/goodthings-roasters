'use client';

/* ══════════════════════════════════════════
   BizInquiriesClient — 비즈 문의 목록 + 확장 상세 + 상태 변경 (S250-3)
   행 클릭 시 상세 패널 펼침. 상태 버튼(신규/연락중/종결) → updateBizInquiryStatus.
   ══════════════════════════════════════════ */

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { BizInquiryRow, BizInquiryStatus } from '@/lib/admin/bizInquiriesServer';
import {
  describeBizType,
  describeBizVolume,
  describeBizCycle,
  describeBizProducts,
  BIZ_STATUS_LABEL,
  BIZ_STATUS_ORDER,
} from '@/lib/admin/bizInquiries';
import { updateBizInquiryStatus } from './actions';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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

export default function BizInquiriesClient({ rows }: { rows: BizInquiryRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

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

  if (rows.length === 0) {
    return (
      <div className="border border-border rounded-md overflow-hidden bg-card">
        <p className="px-4 py-12 text-center text-muted-foreground text-sm">
          접수된 비즈 문의가 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-md overflow-hidden bg-card">
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
    </div>
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
                {BIZ_STATUS_ORDER.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={isRowPending || s === r.status}
                    onClick={(e) => {
                      e.stopPropagation();
                      onStatusChange(r.id, s);
                    }}
                    className={`px-3 py-1 rounded text-xs border transition-colors ${
                      s === r.status
                        ? 'border-foreground bg-foreground text-background cursor-default'
                        : 'border-border text-muted-foreground hover:bg-muted disabled:opacity-50'
                    }`}
                  >
                    {BIZ_STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
