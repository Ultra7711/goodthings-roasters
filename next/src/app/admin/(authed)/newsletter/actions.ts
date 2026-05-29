'use server';

/* ══════════════════════════════════════════════════════════════════════════
   actions.ts — /admin/newsletter Server Actions (S250-2)

   exportNewsletterSubscribersXlsxAction — 구독자 목록 XLSX 내보내기.
   - owner 전용 (PII = 이메일 · users export 정책 답습 · getAdminOwnerClaims)
   - 현재 필터(status·q) 반영 · MAX_EXPORT_ROWS 초과 시 truncated
   - admin_export_log 기록 (domain 'newsletter' · 082 마이그)
   exportUsersXlsxAction 1:1 답습.
   ══════════════════════════════════════════════════════════════════════════ */

import { z } from 'zod';
import { getAdminOwnerClaims } from '@/lib/auth/getClaims';
import { fetchNewsletterSubscribersForExport } from '@/lib/admin/newsletterServer';
import { NEWSLETTER_SOURCE_LABEL } from '@/lib/admin/newsletter';
import {
  MAX_EXPORT_ROWS,
  buildExportFilename,
  formatKstDateTimeCell,
  logExportAudit,
  nowKstDisplay,
} from '@/lib/admin/csvExport';
import { buildXlsxBuffer, bufferToBase64 } from '@/lib/admin/xlsxExport';
import { logActionError } from '@/lib/admin/logActionError';

const ExportInputSchema = z.object({
  status: z.enum(['all', 'active', 'unsubscribed']).default('all'),
  q: z.string().default(''),
});

export type ExportNewsletterInput = z.input<typeof ExportInputSchema>;

export type ExportNewsletterResult =
  | { ok: true; filename: string; xlsxBase64: string; rowCount: number; truncated: boolean }
  | { ok: false; error: 'unauthorized' | 'validation_failed' | 'server_error' };

export async function exportNewsletterSubscribersXlsxAction(
  input: ExportNewsletterInput,
): Promise<ExportNewsletterResult> {
  const claims = await getAdminOwnerClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = ExportInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation_failed' };

  try {
    const { rows, truncated } = await fetchNewsletterSubscribersForExport(
      { status: parsed.data.status, q: parsed.data.q },
      MAX_EXPORT_ROWS,
    );

    const headers = ['이메일', '이름', '상태', '유입', '가입일'] as const;
    const dataRows = rows.map((r) => [
      r.email,
      r.userName ?? (r.userId ? '—' : '비회원'),
      r.status === 'active' ? '활성' : '거부',
      NEWSLETTER_SOURCE_LABEL[r.source] ?? r.source,
      formatKstDateTimeCell(r.createdAtIso),
    ]);

    const buffer = await buildXlsxBuffer(headers, dataRows, {
      domain: '뉴스레터',
      generatedAtKst: nowKstDisplay(),
    });
    const filename = buildExportFilename('newsletter', 'xlsx');

    await logExportAudit({
      domain: 'newsletter',
      actorId: claims.userId,
      filters: parsed.data,
      rowCount: rows.length,
      truncated,
    });

    return {
      ok: true,
      filename,
      xlsxBase64: bufferToBase64(buffer),
      rowCount: rows.length,
      truncated,
    };
  } catch (err: unknown) {
    logActionError('[exportNewsletterSubscribersXlsxAction] failed', err instanceof Error ? err : null);
    return { ok: false, error: 'server_error' };
  }
}
