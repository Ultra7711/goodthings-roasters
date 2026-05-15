'use server';

/* ══════════════════════════════════════════════════════════════════════════
   actions.ts — /admin/orders Server Actions (S232 — list 측)

   책임:
   1) getAdminClaims 가드 — 비admin 차단
   2) Zod 검증 — 필터 입력
   3) fetchAdminOrdersForExport (10,000 행 한도)
   4) buildCsv + filename + audit 로그
   5) Blob 다운로드용 csv string 반환

   별 파일 (상세 측 actions): [orderNumber]/actions.ts (기존 · 발송/환불/메모 등)

   참조:
   - lib/admin/csvExport.ts (helper)
   - lib/admin/ordersServer.ts (fetchAdminOrdersForExport)
   - subscriptions/actions.ts (답습 source — exportSubscriptionsCsvAction)
   ══════════════════════════════════════════════════════════════════════════ */

import { z } from 'zod';
import { getAdminClaims } from '@/lib/auth/getClaims';
import { fetchAdminOrdersForExport } from '@/lib/admin/ordersServer';
import { describeStatus } from '@/lib/admin/orders';
import {
  MAX_EXPORT_ROWS,
  buildCsv,
  buildExportFilename,
  formatKstDateTimeCell,
  logCsvExportAudit,
  nowKstDisplay,
} from '@/lib/admin/csvExport';

const ExportOrdersInputSchema = z.object({
  status: z.enum(['all', 'new', 'shipping', 'delivered', 'cancelled']).default('all'),
  period: z.enum(['all', '7d', '30d', '90d']).default('all'),
  payment: z.enum(['all', 'card', 'transfer']).default('all'),
  q: z.string().default(''),
});

export type ExportOrdersInput = z.input<typeof ExportOrdersInputSchema>;

export type ExportCsvResult =
  | { ok: true; filename: string; csv: string; rowCount: number; truncated: boolean }
  | { ok: false; error: 'unauthorized' | 'validation_failed' | 'server_error' };

export async function exportOrdersCsvAction(
  input: ExportOrdersInput,
): Promise<ExportCsvResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = ExportOrdersInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation_failed' };

  try {
    const { rows, truncated } = await fetchAdminOrdersForExport(
      {
        status: parsed.data.status,
        period: parsed.data.period,
        payment: parsed.data.payment,
        q: parsed.data.q,
      },
      MAX_EXPORT_ROWS,
    );

    const headers = [
      '주문번호',
      '주문일시',
      '고객명',
      '이메일',
      '주문자 전화',
      '수령인 전화',
      '우편번호',
      '주소',
      '상세주소',
      '상품',
      '결제 금액',
      '결제수단',
      '상태',
    ] as const;

    const dataRows = rows.map((o) => [
      o.orderNumber,
      formatKstDateTimeCell(o.createdAtIso),
      o.customerName,
      o.contactEmail,
      o.contactPhone ?? '',
      o.shippingPhone ?? '',
      o.shippingZipcode ?? '',
      o.shippingAddr1 ?? '',
      o.shippingAddr2 ?? '',
      o.itemsLabel,
      o.totalAmount,
      o.paymentLabel,
      describeStatus(o.status).label,
    ]);

    const csv = buildCsv(headers, dataRows, {
      domain: '주문',
      generatedAtKst: nowKstDisplay(),
    });
    const filename = buildExportFilename('orders');

    logCsvExportAudit({
      domain: 'orders',
      actorId: claims.userId,
      filters: parsed.data,
      rowCount: rows.length,
      truncated,
    });

    return { ok: true, filename, csv, rowCount: rows.length, truncated };
  } catch (err: unknown) {
    console.error('[exportOrdersCsvAction] failed', {
      message: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
    });
    return { ok: false, error: 'server_error' };
  }
}
