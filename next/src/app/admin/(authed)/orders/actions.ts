'use server';

/* ══════════════════════════════════════════════════════════════════════════
   actions.ts — /admin/orders Server Actions (S232 — list 측 · S255-C xlsx)

   책임:
   1) getAdminClaims 가드 — 비admin 차단
   2) Zod 검증 — 필터 입력
   3) fetchAdminOrdersForExport (10,000 행 한도)
   4) buildXlsxBuffer + filename + audit 로그
   5) client 디코딩용 xlsx base64 반환

   별 파일 (상세 측 actions): [orderNumber]/actions.ts (기존 · 발송/환불/메모 등)

   참조:
   - lib/admin/csvExport.ts (helper · 모듈명 historical)
   - lib/admin/xlsxExport.ts (buildXlsxBuffer · S255-C 도입)
   - lib/admin/ordersServer.ts (fetchAdminOrdersForExport)
   - subscriptions/actions.ts (답습 source — exportSubscriptionsXlsxAction)
   ══════════════════════════════════════════════════════════════════════════ */

import { z } from 'zod';
import { getAdminOwnerClaims } from '@/lib/auth/getClaims';
import { fetchAdminOrdersForExport } from '@/lib/admin/ordersServer';
import { describeStatus } from '@/lib/admin/orders';
import {
  MAX_EXPORT_ROWS,
  buildExportFilename,
  formatKstDateTimeCell,
  logExportAudit,
  nowKstDisplay,
} from '@/lib/admin/csvExport';
import { buildXlsxBuffer, bufferToBase64 } from '@/lib/admin/xlsxExport';
import { logActionError } from '@/lib/admin/logActionError';

const ExportOrdersInputSchema = z.object({
  status: z
    .enum(['all', 'new', 'shipping', 'delivered', 'cancelled', 'refund_requested', 'untracked'])
    .default('all'),
  period: z.enum(['all', '7d', '30d', '90d']).default('all'),
  payment: z.enum(['all', 'card', 'transfer']).default('all'),
  q: z.string().default(''),
});

export type ExportOrdersInput = z.input<typeof ExportOrdersInputSchema>;

export type ExportXlsxResult =
  | {
      ok: true;
      filename: string;
      /** S255-C: xlsx Buffer 를 base64 로 직렬화한 값. client 가 atob → Uint8Array → Blob. */
      xlsxBase64: string;
      rowCount: number;
      truncated: boolean;
    }
  | { ok: false; error: 'unauthorized' | 'validation_failed' | 'server_error' };

export async function exportOrdersXlsxAction(
  input: ExportOrdersInput,
): Promise<ExportXlsxResult> {
  /* S232: owner (관리자) 만 내보내기. staff (운영자) 는 차단. */
  const claims = await getAdminOwnerClaims();
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

    const buffer = await buildXlsxBuffer(headers, dataRows, {
      domain: '주문',
      generatedAtKst: nowKstDisplay(),
    });
    const filename = buildExportFilename('orders', 'xlsx');

    await logExportAudit({
      domain: 'orders',
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
    logActionError(
      '[exportOrdersXlsxAction] failed',
      err instanceof Error ? err : null,
    );
    return { ok: false, error: 'server_error' };
  }
}
