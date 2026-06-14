'use client';

/* ══════════════════════════════════════════════════════════════════════════
   IlogenExportButton.tsx — 대시보드 원클릭 로젠택배 ILOGEN 엑셀 다운로드 (S319)

   발송 대기(paid) 주문 전체를 ILOGEN 복수건 대량등록 양식으로 내려받는다.
   OrdersTableClient.handleExport 1:1 답습 (owner-only · truncated 경고 · toast).
   ══════════════════════════════════════════════════════════════════════════ */

import { useTransition } from 'react';
import { toast } from 'sonner';
import { exportIlogenXlsxAction } from './orders/actions';
import { downloadXlsxFromBase64 } from '@/lib/admin/clientDownload';
import { describeError } from '@/lib/admin/errorDescribe';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
import { Button } from '@/components/admin/ui/button';

type Props = {
  /** owner (관리자) 만 활성. staff (운영자) 는 disabled. */
  isOwner: boolean;
  /** 발송 대기(paid) 건수 — 버튼 라벨 표시 + 0건 비활성. */
  pendingCount: number;
};

const DownloadIcon = () => (
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

export function IlogenExportButton({ isOwner, pendingCount }: Props) {
  const [isExporting, startExport] = useTransition();

  function handleExport() {
    startExport(async () => {
      const result = await exportIlogenXlsxAction();
      if (!result.ok) {
        toast.error(describeError(result.error));
        return;
      }
      if (result.rowCount === 0) {
        toast.info('발송 대기 중인 주문이 없습니다.');
        return;
      }
      downloadXlsxFromBase64(result.xlsxBase64, result.filename);
      if (result.truncated) {
        toast.warning(
          `${result.rowCount.toLocaleString()}건 내보냈습니다. 상한(10,000건) 초과 — 일부만 포함되었습니다.`,
        );
      } else {
        toast.success(`발송 대기 ${result.rowCount.toLocaleString()}건을 내보냈습니다.`);
      }
    });
  }

  const showBadge = !isExporting && pendingCount > 0;

  return (
    <AdminTopbarActions>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="!h-7"
        onClick={handleExport}
        disabled={!isOwner || isExporting || pendingCount === 0}
        title={
          !isOwner
            ? '관리자 권한 필요'
            : pendingCount === 0
              ? '발송 대기 주문 없음'
              : '발송 대기 주문을 로젠택배 ILOGEN 양식으로 내보냅니다'
        }
      >
        <DownloadIcon />
        {isExporting ? '내보내는 중…' : '로젠 ILOGEN 엑셀'}
        {showBadge && (
          <span
            className="text-xs tabular-nums rounded-sm bg-[var(--primary)] !text-white"
            style={{ padding: '1px 6px' }}
          >
            {pendingCount.toLocaleString()}
          </span>
        )}
      </Button>
    </AdminTopbarActions>
  );
}
