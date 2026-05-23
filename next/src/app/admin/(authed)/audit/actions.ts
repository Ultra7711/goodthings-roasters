'use server';

/* ══════════════════════════════════════════════════════════════════════════
   actions.ts — /admin/audit Server Actions (S233-fu Step 4)

   책임:
   - exportAuditCsvAction: 감사 로그 통합 타임라인 CSV 내보내기
   - owner 가드 (감사 로그 자체 접근 owner-only · /admin/audit 페이지 정합)
   - logCsvExportAudit (재귀 audit · 057 마이그 'audit' enum 답습)

   사용 사례:
   - 정부 · KISA 컴플라이언스 측 PII 조회 기록 제출 자료
   - 분기별 외부 감사 첨부

   참조:
   - lib/admin/auditServer.ts (fetchAdminAuditEvents)
   - lib/admin/csvExport.ts (helper)
   - subscriptions/actions.ts · orders/actions.ts (답습 source)
   ══════════════════════════════════════════════════════════════════════════ */

import { getAdminOwnerClaims } from '@/lib/auth/getClaims';
import { fetchAdminAuditEvents } from '@/lib/admin/auditServer';
import { describeAuditAction, formatAuditKstDateTime, describeExportFilters } from '@/lib/admin/audit';
import {
  buildExportFilename,
  logCsvExportAudit,
  nowKstDisplay,
} from '@/lib/admin/csvExport';
import { buildXlsxBuffer, bufferToBase64 } from '@/lib/admin/xlsxExport';

export type ExportCsvResult =
  | {
      ok: true;
      filename: string;
      /** S255-C: xlsx Buffer base64 직렬화. client 가 디코딩 후 Blob 생성. */
      xlsxBase64: string;
      rowCount: number;
      truncated: boolean;
    }
  | { ok: false; error: 'unauthorized' | 'server_error' };

export async function exportAuditCsvAction(): Promise<ExportCsvResult> {
  const claims = await getAdminOwnerClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  try {
    const events = await fetchAdminAuditEvents();

    const headers = [
      '시각',
      '활동',
      '실행자 이메일',
      '실행자 ID',
      '대상 이메일',
      '대상 ID',
      '내용',
    ] as const;

    const dataRows = events.map((e) => {
      const action = describeAuditAction(e.action).label;
      let detail = '';
      if (e.source === 'export') {
        const domain = String(e.details.domain ?? '');
        const filters = (e.details.filters as Record<string, unknown>) ?? {};
        const rowCount = (e.details.row_count as number) ?? 0;
        const truncated = e.details.truncated === true;
        detail = `${describeExportFilters(domain, filters)} · ${rowCount.toLocaleString()}건${truncated ? ' (상한 초과)' : ''}`;
      } else {
        const reason = e.details.reason;
        detail = typeof reason === 'string' && reason.length > 0 ? reason : '';
      }
      return [
        formatAuditKstDateTime(e.createdAtIso),
        action,
        e.actorEmail ?? '',
        e.actorId,
        e.targetUserEmail ?? '',
        e.targetUserId ?? '',
        detail,
      ];
    });

    const buffer = await buildXlsxBuffer(headers, dataRows, {
      domain: '감사 로그',
      generatedAtKst: nowKstDisplay(),
    });
    const filename = buildExportFilename('audit', 'xlsx');

    /* 재귀 audit — 감사 로그 내보내기 행위 자체도 기록 (057 마이그 'audit' enum 답습) */
    await logCsvExportAudit({
      domain: 'audit',
      actorId: claims.userId,
      filters: {},
      rowCount: events.length,
      truncated: false,
    });

    return {
      ok: true,
      filename,
      xlsxBase64: bufferToBase64(buffer),
      rowCount: events.length,
      truncated: false,
    };
  } catch (err: unknown) {
    console.error('[exportAuditCsvAction] failed', {
      message: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
    });
    return { ok: false, error: 'server_error' };
  }
}
