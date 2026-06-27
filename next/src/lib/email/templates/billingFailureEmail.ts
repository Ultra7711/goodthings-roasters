/* ══════════════════════════════════════════════════════════════════════════
   email/templates/billingFailureEmail.ts — 정기배송 자동결제 실패(일시정지) 알림

   사용처: notifications.sendBillingFailureEmail()
   발송 시점: 영구 오류 또는 재시도 소진(24/48/72h)으로 구독이 paused 전환될 때.
   목적: 결제수단 재등록 유도(마이페이지) → 정기배송 재개.

   보안: 사용자 입력(productName·recipientName) esc() 적용.
   ════════════════════════════════════════════════════════════════════════ */

import { esc } from './utils';
import { getAppUrl } from './urls';

export type BillingFailureEmailProps = {
  recipientName?: string;
  productName: string;
};

export function renderBillingFailureEmail(props: BillingFailureEmailProps): {
  subject: string;
  html: string;
  text: string;
} {
  const displayName = esc(props.recipientName?.trim() || '고객');
  const productName = esc(props.productName.trim() || '정기배송 상품');
  const mypageUrl = `${getAppUrl()}/mypage`;
  const subject = '[굳띵즈] 정기배송 자동결제에 실패해 구독이 일시정지되었습니다';

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
            <h1 style="margin:0 0 6px;font-size:24px;font-weight:300;color:#1C1B19;">자동결제에 실패했습니다</h1>
            <p style="margin:0 0 28px;font-size:13px;color:#A8A49E;">${productName} 정기배송</p>
            <p style="margin:0 0 24px;font-size:15px;color:#6B6963;line-height:1.75;">
              ${displayName}님, <strong style="color:#1C1B19;">${productName}</strong> 정기배송의 자동결제가 여러 차례 실패하여
              구독이 <strong style="color:#1C1B19;">일시정지</strong>되었습니다.<br>
              카드 만료·정지·한도 초과 등이 원인일 수 있습니다.
            </p>
            <div style="background-color:#F5F5F3;border:1px solid #E8E6E1;border-radius:6px;padding:20px;margin:0 0 8px;">
              <p style="margin:0;font-size:14px;color:#6B6963;line-height:1.7;">
                마이페이지에서 <strong style="color:#1C1B19;">결제수단을 다시 등록</strong>하시면
                정기배송을 재개할 수 있습니다.
              </p>
            </div>

            <table cellpadding="0" cellspacing="0" style="margin:32px 0 0;">
              <tr>
                <td style="background-color:#7A6B52;border-radius:4px;">
                  <a href="${mypageUrl}"
                     style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:500;color:#FAFAF8;text-decoration:none;letter-spacing:0.03em;">
                    결제수단 관리
                  </a>
                </td>
              </tr>
            </table>

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

  const text = `[굳띵즈] 정기배송 자동결제에 실패해 구독이 일시정지되었습니다

${props.recipientName?.trim() || '고객'}님, ${props.productName.trim() || '정기배송 상품'} 정기배송의 자동결제가 여러 차례 실패하여 구독이 일시정지되었습니다.
카드 만료·정지·한도 초과 등이 원인일 수 있습니다.

마이페이지에서 결제수단을 다시 등록하시면 정기배송을 재개할 수 있습니다.

결제수단 관리: ${mypageUrl}

© ${new Date().getFullYear()} Good Things Roasters`;

  return { subject, html, text };
}
