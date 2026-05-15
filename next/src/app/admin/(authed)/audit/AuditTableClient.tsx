'use client';

/* ══════════════════════════════════════════════════════════════════════════
   AuditTableClient — /admin/audit 통합 타임라인 (S233-fu Step 3)

   Orders/Users 답습 패턴:
   - AdminPageHeader / AdminDataTable / AdminEmptyState
   - 행 호버 + 클릭 = X (조회 전용 · interactive 없음)

   carry-over (출시 후 결정):
   - 도메인 필터 (csv / role / 전체)
   - 페이지네이션 (현재 100건 cap)
   - 사용자 필터 (특정 actor / target 만 조회)
   - export 다운로드 자체 audit 페이지 export
   ══════════════════════════════════════════════════════════════════════════ */

import { useMemo, useTransition } from 'react';
import { toast } from 'sonner';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminDataTable, type Column } from '@/components/admin/AdminDataTable';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
import { Badge as ShadcnBadge } from '@/components/admin/ui/badge';
import { Button } from '@/components/admin/ui/button';
import {
  describeAuditAction,
  describeExportFilters,
  formatAuditKstDateTime,
  type AuditTone,
} from '@/lib/admin/audit';
import type { AdminAuditEvent } from '@/lib/admin/auditServer';
import { exportAuditCsvAction } from './actions';

const TONES: Record<AuditTone, { bg: string; fg: string; dot: string }> = {
  primary: { bg: 'var(--primary-soft)', fg: 'var(--primary-soft-fg)', dot: 'var(--primary)' },
  success: { bg: 'var(--success-soft)', fg: 'var(--success)', dot: 'var(--success)' },
  warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)', dot: 'var(--warning)' },
  neutral: { bg: 'var(--neutral-soft)', fg: 'var(--neutral-soft-fg)', dot: 'var(--foreground-muted)' },
  info:    { bg: 'var(--info-soft)',    fg: 'var(--info)',    dot: 'var(--info)' },
};

type Props = {
  events: AdminAuditEvent[];
};

export default function AuditTableClient({ events }: Props) {
  const [isExporting, startExport] = useTransition();

  /* CSV 내보내기 — 컴플라이언스 자료 (정부·KISA PII 조회 기록 제출용). */
  function handleExport() {
    startExport(async () => {
      const result = await exportAuditCsvAction();
      if (!result.ok) {
        const map: Record<string, string> = {
          unauthorized: '관리자 권한이 필요합니다.',
          server_error: '내보내는 중 오류가 발생했습니다.',
        };
        toast.error(map[result.error] ?? '오류가 발생했습니다.');
        return;
      }
      if (result.rowCount === 0) {
        toast.info('내보낼 감사 로그가 없습니다.');
        return;
      }
      const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`${result.rowCount.toLocaleString()}건을 내보냈습니다.`);
    });
  }

  const columns: readonly Column<AdminAuditEvent>[] = useMemo(() => [
    {
      key: 'createdAt',
      header: '시각',
      cellClassName: 'text-xs text-muted-foreground tabular-nums whitespace-nowrap',
      render: (e) => formatAuditKstDateTime(e.createdAtIso),
    },
    {
      key: 'action',
      header: '활동',
      render: (e) => {
        const desc = describeAuditAction(e.action);
        const t = TONES[desc.tone];
        return (
          <ShadcnBadge
            variant="outline"
            className="border-transparent gap-1.5"
            style={{ background: t.bg, color: t.fg }}
          >
            <span aria-hidden style={{ width: 5, height: 5, borderRadius: 999, background: t.dot }} />
            {desc.label}
          </ShadcnBadge>
        );
      },
    },
    {
      key: 'actor',
      header: '실행자',
      cellClassName: 'text-sm',
      render: (e) => e.actorEmail ?? <span className="text-[var(--foreground-subtle)]">—</span>,
    },
    {
      key: 'target',
      header: '대상',
      cellClassName: 'text-sm',
      render: (e) => {
        if (e.source === 'export') {
          /* CSV 행은 대상 사용자 없음 → 행 수 / truncated 표시 */
          const rowCount = (e.details.row_count as number) ?? 0;
          const truncated = e.details.truncated === true;
          return (
            <span className="tabular-nums">
              {rowCount.toLocaleString()}건
              {truncated && (
                <span className="ml-1.5 text-xs text-[var(--warning)]">(상한 초과)</span>
              )}
            </span>
          );
        }
        return e.targetUserEmail ?? <span className="text-[var(--foreground-subtle)]">—</span>;
      },
    },
    {
      key: 'detail',
      header: '내용',
      cellClassName: 'text-xs text-muted-foreground',
      render: (e) => {
        if (e.source === 'export') {
          const domain = String(e.details.domain ?? '');
          const filters = (e.details.filters as Record<string, unknown>) ?? {};
          return describeExportFilters(domain, filters);
        }
        const reason = e.details.reason;
        return typeof reason === 'string' && reason.length > 0
          ? reason
          : <span className="text-[var(--foreground-subtle)]">사유 없음</span>;
      },
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
          disabled={isExporting || events.length === 0}
          title="감사 로그를 CSV 로 내보내기 (컴플라이언스 첨부 자료)"
        >
          <DownloadIcon />
          {isExporting ? '내보내는 중…' : 'CSV 내보내기'}
        </Button>
      </AdminTopbarActions>

      <AdminPageHeader
        title="감사 로그"
        subtitle={
          <>
            CSV 내보내기 · 권한 변경 통합 타임라인 · 최근 {events.length}건
          </>
        }
      />

      <AdminDataTable
        columns={columns}
        data={events}
        rowKey={(e) => e.id}
        empty={
          <AdminEmptyState
            variant="table-row"
            colSpan={columns.length}
            message="아직 기록된 감사 로그가 없습니다."
          />
        }
      />
    </>
  );
}

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
