/* ══════════════════════════════════════════════════════════════════════════
   email/templates/shippingNotificationEmail.ts — 배송 시작 알림 메일 템플릿

   사용처: notifications.sendShippingNotificationEmail()

   D-4 Pass 1 수정:
   - HIGH-1: displayName, carrier, trackingNumber esc() 적용
   - sec MEDIUM-2: orderNumber stripNewlines() → CRLF 헤더 인젝션 방어
   ════════════════════════════════════════════════════════════════════════ */

import { esc, stripNewlines } from './utils';
import { buildOrderCompleteUrl } from './urls';

export type ShippingNotificationEmailProps = {
  orderNumber: string;
  recipientName?: string;
  trackingNumber?: string;
  carrier?: string;
  /**
   * Session 11 보안 #3-4a: 주문 공개 토큰. 존재 시 `/order-complete?token=...` CTA 렌더.
   */
  publicToken?: string;
};

export function renderShippingNotificationEmail(props: ShippingNotificationEmailProps): {
  subject: string;
  html: string;
  text: string;
} {
  const { orderNumber, recipientName, trackingNumber, carrier, publicToken } = props;
  const orderCompleteUrl = buildOrderCompleteUrl(publicToken);

  /* CRLF 인젝션 방어 */
  const safeOrderNumber = stripNewlines(orderNumber);
  const displayName = esc(recipientName?.trim() || '고객');
  const subject = `[굳띵즈] 주문하신 상품이 출발했습니다 — ${safeOrderNumber}`;

  const trackingBlock =
    trackingNumber && carrier
      ? `<div style="background-color:#F5F5F3;border:1px solid #E8E6E1;border-radius:6px;padding:20px;margin:24px 0 0;">
              <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#1C1B19;">배송 추적 정보</p>
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="font-size:13px;color:#6B6963;padding-bottom:8px;">택배사</td>
                  <td style="font-size:13px;color:#1C1B19;text-align:right;padding-bottom:8px;">${esc(carrier)}</td>
                </tr>
                <tr>
                  <td style="font-size:13px;color:#6B6963;">송장번호</td>
                  <td style="font-size:13px;color:#1C1B19;text-align:right;">${esc(trackingNumber)}</td>
                </tr>
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
            <h1 style="margin:0 0 6px;font-size:24px;font-weight:300;color:#1C1B19;">상품이 출발했습니다</h1>
            <p style="margin:0 0 28px;font-size:13px;color:#A8A49E;">주문번호: ${esc(safeOrderNumber)}</p>
            <p style="margin:0 0 24px;font-size:15px;color:#6B6963;line-height:1.75;">
              ${displayName}님, 주문하신 원두가 출발했습니다.<br>
              신선한 상태로 곧 도착할 예정입니다.
            </p>

            ${trackingBlock}

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

  const trackingText =
    trackingNumber && carrier
      ? `\n─ 배송 추적 ─\n택배사: ${carrier}\n송장번호: ${trackingNumber}`
      : '';

  const ctaText = orderCompleteUrl ? `\n\n주문 내역 보기: ${orderCompleteUrl}` : '';

  const text = `[굳띵즈] 상품이 출발했습니다 — ${safeOrderNumber}

${recipientName?.trim() || '고객'}님, 주문하신 원두가 출발했습니다.
신선한 상태로 곧 도착할 예정입니다.${trackingText}${ctaText}

© ${new Date().getFullYear()} Good Things Roasters`;

  return { subject, html, text };
}
