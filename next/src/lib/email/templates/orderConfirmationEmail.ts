/* ══════════════════════════════════════════════════════════════════════════
   email/templates/orderConfirmationEmail.ts — 주문 확인 메일 템플릿

   사용처: notifications.sendOrderConfirmationEmail()

   D-4 Pass 1 수정:
   - HIGH-1: 모든 동적 값 esc() 적용 (item.name, displayName, VA 필드)
   - sec MEDIUM-2: orderNumber stripNewlines() → CRLF 헤더 인젝션 방어
   - code LOW-1: formatMethod 타입을 Record<DbPaymentMethod, string> 으로 좁힘
   ════════════════════════════════════════════════════════════════════════ */

import { esc, stripNewlines } from './utils';
import { buildOrderCompleteUrl } from './urls';
import type { DbPaymentMethod, EasypayProvider } from '@/types/db';

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
  /** BUG-115 PR1: method='easypay' 일 때 provider. 그 외 null. */
  easypayProvider?: EasypayProvider | null;
  items: OrderConfirmationEmailItem[];
  virtualAccount?: {
    bank: string | null;
    accountNumber: string;
    dueDate: string | null;
    customerName: string | null;
  } | null;
  /**
   * Session 8-B B-1: 가상계좌 입금 완료 알림 모드.
   * true = `[굳띵즈] 입금이 확인되었습니다` 톤으로 전환 + 가상계좌 안내 블록 숨김.
   * false/undefined = 기존 "주문이 확인되었습니다" 메일 (confirm 직후).
   */
  depositCompleted?: boolean;
  /**
   * Session 11 보안 #3-4a: 주문 공개 토큰 (orders.public_token UUID v4).
   * 존재하면 `/order-complete?token=...` CTA 링크를 렌더링한다.
   * 이메일 링크의 `?orderNumber=` enumeration 표면을 제거하기 위한 1급 식별자.
   */
  publicToken?: string;
};

function formatKRW(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}

const METHOD_LABELS: Record<DbPaymentMethod, string> = {
  card: '신용카드',
  transfer: '가상계좌',
  easypay: '간편결제',
};

/** BUG-115 PR1: easypay provider 9종 라벨 (이메일·UI 공통). */
const EASYPAY_PROVIDER_LABELS: Record<EasypayProvider, string> = {
  tosspay: '토스페이',
  kakaopay: '카카오페이',
  naverpay: '네이버페이',
  payco: '페이코',
  applepay: '애플페이',
  samsungpay: '삼성페이',
  lpay: 'L.pay',
  ssgpay: 'SSG페이',
  pinpay: '핀페이',
};

/**
 * 결제 수단 라벨 합성. easypay 면 "{provider} (간편결제)" 로 노출, 그 외는 단순 라벨.
 * provider 가 누락된 easypay 행은 라벨 fallback "간편결제" 만 노출 (방어적).
 */
function paymentMethodLabel(
  method: DbPaymentMethod,
  provider: EasypayProvider | null | undefined,
): string {
  if (method === 'easypay' && provider) {
    return `${EASYPAY_PROVIDER_LABELS[provider]} (간편결제)`;
  }
  return METHOD_LABELS[method];
}

export function renderOrderConfirmationEmail(props: OrderConfirmationEmailProps): {
  subject: string;
  html: string;
  text: string;
} {
  const { orderNumber, recipientName, subtotal, shippingFee, discountAmount, totalAmount, method, easypayProvider, items, virtualAccount, depositCompleted, publicToken } = props;
  const methodLabel = paymentMethodLabel(method, easypayProvider ?? null);
  const orderCompleteUrl = buildOrderCompleteUrl(publicToken);

  /* CRLF 인젝션 방어 — subject 헤더 삽입 전 제거 */
  const safeOrderNumber = stripNewlines(orderNumber);
  const displayName = esc(recipientName?.trim() || '고객');

  /* Session 8-B B-1: 입금 완료 모드에서는 subject/headline/intro 를 전환하고
     가상계좌 블록은 숨긴다 (이미 입금 완료 → 재안내 불필요). */
  const headline = depositCompleted
    ? '입금이 확인되었습니다'
    : '주문이 확인되었습니다';
  const subject = `[굳띵즈] ${headline} — ${safeOrderNumber}`;
  const intro = depositCompleted
    ? `${displayName}님, 입금이 정상적으로 확인되었습니다.<br>곧 배송 준비를 시작하겠습니다.`
    : `${displayName}님, 주문해 주셔서 감사합니다.<br>신선하게 로스팅된 원두를 곧 보내드리겠습니다.`;
  const introText = depositCompleted
    ? `${recipientName?.trim() || '고객'}님, 입금이 정상적으로 확인되었습니다. 곧 배송 준비를 시작하겠습니다.`
    : `${recipientName?.trim() || '고객'}님, 주문해 주셔서 감사합니다.`;

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

  /* 입금 완료 모드에서는 가상계좌 안내 블록을 숨김 */
  const virtualAccountBlock =
    virtualAccount != null && !depositCompleted
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
            <h1 style="margin:0 0 6px;font-size:24px;font-weight:300;color:#1C1B19;">${esc(headline)}</h1>
            <p style="margin:0 0 28px;font-size:13px;color:#A8A49E;">주문번호: ${esc(safeOrderNumber)}</p>
            <p style="margin:0 0 32px;font-size:15px;color:#6B6963;line-height:1.7;">
              ${intro}
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

            <p style="margin:16px 0 0;font-size:13px;color:#6B6963;">결제 방법: ${methodLabel}</p>

            ${virtualAccountBlock}

            ${
              orderCompleteUrl
                ? `<table cellpadding="0" cellspacing="0" style="margin:32px 0 0;">
              <tr>
                <td style="background-color:#7A6B52;border-radius:4px;">
                  <a href="${orderCompleteUrl}"
                     style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:500;color:#FAFAF8;text-decoration:none;letter-spacing:0.03em;">
                    주문 내역 보기
                  </a>
                </td>
              </tr>
            </table>`
                : ''
            }

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
    virtualAccount != null && !depositCompleted
      ? `\n─ 가상계좌 안내 ─\n은행: ${virtualAccount.bank ?? '—'}\n계좌번호: ${virtualAccount.accountNumber}${virtualAccount.dueDate ? `\n입금 기한: ${virtualAccount.dueDate}` : ''}`
      : '';

  const discountText = discountAmount > 0 ? `\n할인: -${formatKRW(discountAmount)}` : '';

  const ctaText = orderCompleteUrl ? `\n\n주문 내역 보기: ${orderCompleteUrl}` : '';

  const text = `[굳띵즈] ${headline} — ${safeOrderNumber}

${introText}

─ 주문 상품 ─
${itemsText}

소계: ${formatKRW(subtotal)}
배송비: ${shippingFee === 0 ? '무료' : formatKRW(shippingFee)}${discountText}
합계: ${formatKRW(totalAmount)}
결제 방법: ${methodLabel}${vaText}${ctaText}

© ${new Date().getFullYear()} Good Things Roasters`;

  return { subject, html, text };
}
