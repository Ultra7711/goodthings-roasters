/* ══════════════════════════════════════════════════════════════════════════
   email/templates/orderConfirmationEmail.ts — 주문 확인 메일 템플릿

   사용처: notifications.sendOrderConfirmationEmail()

   D-4 Pass 1 수정:
   - HIGH-1: 모든 동적 값 esc() 적용 (item.name, displayName, VA 필드)
   - sec MEDIUM-2: orderNumber stripNewlines() → CRLF 헤더 인젝션 방어
   - code LOW-1: formatMethod 타입을 Record<DbPaymentMethod, string> 으로 좁힘
   ════════════════════════════════════════════════════════════════════════ */

import { esc, stripNewlines } from './utils';
import type { DbPaymentMethod } from '@/types/db';

export type OrderConfirmationEmailItem = {
  name: string;
  quantity: number;
  unitPrice: number;
};

export type OrderConfirmationEmailProps = {
  orderNumber: string;
  recipientName?: string;
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  totalAmount: number;
  method: DbPaymentMethod;
  items: OrderConfirmationEmailItem[];
  virtualAccount?: {
    bank: string | null;
    accountNumber: string;
    dueDate: string | null;
    customerName: string | null;
  } | null;
};

function formatKRW(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}

const METHOD_LABELS: Record<DbPaymentMethod, string> = {
  card: '신용카드',
  transfer: '가상계좌',
};

export function renderOrderConfirmationEmail(props: OrderConfirmationEmailProps): {
  subject: string;
  html: string;
  text: string;
} {
  const { orderNumber, recipientName, subtotal, shippingFee, discountAmount, totalAmount, method, items, virtualAccount } = props;

  /* CRLF 인젝션 방어 — subject 헤더 삽입 전 제거 */
  const safeOrderNumber = stripNewlines(orderNumber);
  const displayName = esc(recipientName?.trim() || '고객');
  const subject = `[굳띵즈] 주문이 확인되었습니다 — ${safeOrderNumber}`;

  const itemRows = items
    .map(
      (item) => `
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #E8E6E1;font-size:14px;color:#1C1B19;line-height:1.4;">${esc(item.name)}</td>
              <td style="padding:10px 0;border-bottom:1px solid #E8E6E1;font-size:14px;color:#6B6963;text-align:center;white-space:nowrap;">${item.quantity}개</td>
              <td style="padding:10px 0;border-bottom:1px solid #E8E6E1;font-size:14px;color:#1C1B19;text-align:right;white-space:nowrap;">${formatKRW(item.unitPrice * item.quantity)}</td>
            </tr>`,
    )
    .join('');

  const discountRow =
    discountAmount > 0
      ? `<tr>
              <td style="font-size:14px;color:#6B6963;padding-bottom:8px;">할인</td>
              <td style="font-size:14px;color:#1C1B19;text-align:right;padding-bottom:8px;">−${formatKRW(discountAmount)}</td>
            </tr>`
      : '';

  const virtualAccountBlock =
    virtualAccount != null
      ? `<div style="background-color:#F5F5F3;border:1px solid #E8E6E1;border-radius:6px;padding:20px;margin:24px 0 0;">
              <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#1C1B19;">가상계좌 안내</p>
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="font-size:13px;color:#6B6963;padding-bottom:8px;">은행</td>
                  <td style="font-size:13px;color:#1C1B19;text-align:right;padding-bottom:8px;">${esc(virtualAccount.bank ?? '—')}</td>
                </tr>
                <tr>
                  <td style="font-size:13px;color:#6B6963;padding-bottom:8px;">계좌번호</td>
                  <td style="font-size:13px;color:#1C1B19;text-align:right;padding-bottom:8px;">${esc(virtualAccount.accountNumber)}</td>
                </tr>
                ${
                  virtualAccount.dueDate
                    ? `<tr>
                  <td style="font-size:13px;color:#6B6963;">입금 기한</td>
                  <td style="font-size:13px;color:#7A6B52;font-weight:500;text-align:right;">${esc(virtualAccount.dueDate)}</td>
                </tr>`
                    : ''
                }
              </table>
            </div>`
      : '';

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F0EDE8;font-family:'Pretendard','Inter',-apple-system,BlinkMacSystemFont,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F0EDE8;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FAFAF8;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="background-color:#1C1B19;padding:32px 40px;">
            <p style="margin:0;font-size:17px;font-weight:600;letter-spacing:0.1em;color:#FAFAF8;text-transform:uppercase;">Good Things Roasters</p>
          </td>
        </tr>
        <tr>
          <td style="padding:48px 40px 40px;">
            <h1 style="margin:0 0 6px;font-size:24px;font-weight:300;color:#1C1B19;">주문이 확인되었습니다</h1>
            <p style="margin:0 0 28px;font-size:13px;color:#A8A49E;">주문번호: ${esc(safeOrderNumber)}</p>
            <p style="margin:0 0 32px;font-size:15px;color:#6B6963;line-height:1.7;">
              ${displayName}님, 주문해 주셔서 감사합니다.<br>
              신선하게 로스팅된 원두를 곧 보내드리겠습니다.
            </p>

            <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
              <thead>
                <tr>
                  <th style="font-size:11px;font-weight:500;color:#A8A49E;text-align:left;padding-bottom:10px;border-bottom:2px solid #1C1B19;letter-spacing:0.05em;">상품명</th>
                  <th style="font-size:11px;font-weight:500;color:#A8A49E;text-align:center;padding-bottom:10px;border-bottom:2px solid #1C1B19;letter-spacing:0.05em;">수량</th>
                  <th style="font-size:11px;font-weight:500;color:#A8A49E;text-align:right;padding-bottom:10px;border-bottom:2px solid #1C1B19;letter-spacing:0.05em;">금액</th>
                </tr>
              </thead>
              <tbody>${itemRows}
              </tbody>
            </table>

            <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:8px;">
              <tr>
                <td style="font-size:14px;color:#6B6963;padding-bottom:8px;">소계</td>
                <td style="font-size:14px;color:#1C1B19;text-align:right;padding-bottom:8px;">${formatKRW(subtotal)}</td>
              </tr>
              <tr>
                <td style="font-size:14px;color:#6B6963;padding-bottom:8px;">배송비</td>
                <td style="font-size:14px;color:#1C1B19;text-align:right;padding-bottom:8px;">${shippingFee === 0 ? '무료' : formatKRW(shippingFee)}</td>
              </tr>
              ${discountRow}
              <tr>
                <td style="font-size:16px;font-weight:600;color:#1C1B19;padding-top:14px;border-top:2px solid #1C1B19;">합계</td>
                <td style="font-size:16px;font-weight:600;color:#1C1B19;text-align:right;padding-top:14px;border-top:2px solid #1C1B19;">${formatKRW(totalAmount)}</td>
              </tr>
            </table>

            <p style="margin:16px 0 0;font-size:13px;color:#6B6963;">결제 방법: ${METHOD_LABELS[method]}</p>

            ${virtualAccountBlock}

            <hr style="border:none;border-top:1px solid #E8E6E1;margin:32px 0 20px;">
            <p style="margin:0;font-size:12px;color:#A8A49E;line-height:1.6;">
              본 메일은 발신 전용입니다. 문의는 홈페이지를 통해 연락해 주세요.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px 24px;background-color:#F0EDE8;border-top:1px solid #E8E6E1;">
            <p style="margin:0;font-size:12px;color:#A8A49E;line-height:1.6;">
              © ${new Date().getFullYear()} Good Things Roasters. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const itemsText = items
    .map((i) => `- ${i.name} x${i.quantity}: ${formatKRW(i.unitPrice * i.quantity)}`)
    .join('\n');

  const vaText =
    virtualAccount != null
      ? `\n─ 가상계좌 안내 ─\n은행: ${virtualAccount.bank ?? '—'}\n계좌번호: ${virtualAccount.accountNumber}${virtualAccount.dueDate ? `\n입금 기한: ${virtualAccount.dueDate}` : ''}`
      : '';

  const discountText = discountAmount > 0 ? `\n할인: -${formatKRW(discountAmount)}` : '';

  const text = `[굳띵즈] 주문이 확인되었습니다 — ${safeOrderNumber}

${recipientName?.trim() || '고객'}님, 주문해 주셔서 감사합니다.

─ 주문 상품 ─
${itemsText}

소계: ${formatKRW(subtotal)}
배송비: ${shippingFee === 0 ? '무료' : formatKRW(shippingFee)}${discountText}
합계: ${formatKRW(totalAmount)}
결제 방법: ${METHOD_LABELS[method]}${vaText}

© ${new Date().getFullYear()} Good Things Roasters`;

  return { subject, html, text };
}
