/* ══════════════════════════════════════════════════════════════════════════
   email/templates/welcomeEmail.ts — 신규 가입 환영 메일 템플릿

   사용처: notifications.sendWelcomeEmail()
   ════════════════════════════════════════════════════════════════════════ */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://goodthingsroasters.com';

export type WelcomeEmailProps = {
  name?: string;
};

export function renderWelcomeEmail(props: WelcomeEmailProps): {
  subject: string;
  html: string;
  text: string;
} {
  const displayName = props.name?.trim() || '고객';
  const subject = '굳띵즈에 오신 것을 환영합니다';

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${subject}</title>
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
            <h1 style="margin:0 0 16px;font-size:26px;font-weight:300;color:#1C1B19;line-height:1.35;">환영합니다, ${displayName}님</h1>
            <p style="margin:0 0 8px;font-size:15px;color:#6B6963;line-height:1.75;">
              굳띵즈 로스터리에 가입해 주셔서 감사합니다.
            </p>
            <p style="margin:0 0 32px;font-size:15px;color:#6B6963;line-height:1.75;">
              매일 정성껏 로스팅한 원두를 만나보세요.
            </p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background-color:#7A6B52;border-radius:4px;">
                  <a href="${APP_URL}/shop"
                     style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:500;color:#FAFAF8;text-decoration:none;letter-spacing:0.03em;">
                    원두 둘러보기
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px 24px;background-color:#F0EDE8;border-top:1px solid #E8E6E1;">
            <p style="margin:0;font-size:12px;color:#A8A49E;line-height:1.6;">
              본 메일은 발신 전용입니다. 문의는 홈페이지를 통해 연락해 주세요.<br>
              © 2025 Good Things Roasters. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `굳띵즈에 오신 것을 환영합니다, ${displayName}님!

매일 정성껏 로스팅한 원두를 만나보세요.
${APP_URL}/shop

© 2025 Good Things Roasters`;

  return { subject, html, text };
}
