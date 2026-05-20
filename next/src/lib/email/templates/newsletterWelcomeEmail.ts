/* ══════════════════════════════════════════════════════════════════════════
   email/templates/newsletterWelcomeEmail.ts — newsletter 구독 환영 메일 (S241 Phase 3)

   사용처: Phase 3 — subscribeNewsletter 성공 직후 자동 발송 (Resend).

   디자인 (ONIBUS COFFEE 메일 참고):
   - 중앙 정렬 미니멀
   - 상단 good things SVG 로고 (PNG 변환본 호스팅)
   - 큰 타이틀 강조
   - 본문 2~3줄
   - CTA 버튼 (사이트 둘러보기)
   - 헤어라인 분할선
   - 푸터 (구독 취소 링크 + 문의)

   호환:
   - 이메일 클라이언트 호환 위해 table-based 레이아웃 + inline styles
   - PNG 로고 (SVG 미지원 클라이언트 대응)

   인자:
   - unsubscribeToken — newsletter_subscribers.unsubscribe_token uuid (필수).
     /unsubscribe?token=... 링크 생성.
   ════════════════════════════════════════════════════════════════════════ */

import { esc } from './utils';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://goodthingsroasters.com';
const LOGO_URL = `${APP_URL}/images/icons/logo-email.png`;
const CONTACT_EMAIL = process.env.RESEND_REPLY_TO ?? 'hello@goodthingsroasters.com';

export type NewsletterWelcomeEmailProps = {
  unsubscribeToken: string;
};

export function renderNewsletterWelcomeEmail(
  props: NewsletterWelcomeEmailProps,
): { subject: string; html: string; text: string } {
  const subject = '굳띵즈 뉴스레터를 신청해 주셔서 감사합니다';
  const unsubscribeUrl = `${APP_URL}/unsubscribe?token=${esc(props.unsubscribeToken)}`;

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#FFFFFF;font-family:'Pretendard','Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFFFFF;">
    <tr>
      <td align="center" style="padding:40px 0;">

        <!-- 600px 메일 박스 (브라우저 중앙 배치, 내부는 왼쪽 정렬) -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- 로고 -->
          <tr>
            <td align="left" style="padding:48px 40px 40px;">
              <img src="${LOGO_URL}" width="140" alt="good things"
                   style="display:block;width:140px;height:auto;border:0;outline:none;">
            </td>
          </tr>

          <!-- 타이틀 -->
          <tr>
            <td align="left" style="padding:0 40px 16px;">
              <h1 style="margin:0;font-size:26px;font-weight:600;color:#1C1B19;line-height:1.4;letter-spacing:-0.02em;text-align:left;">
                굳띵즈에 오신 것을 환영합니다!
              </h1>
            </td>
          </tr>

          <!-- 본문 -->
          <tr>
            <td align="left" style="padding:0 40px 32px;">
              <p style="margin:0;font-size:16px;color:#4A4844;line-height:1.75;text-align:left;">
                뉴스레터를 신청해 주셔서 감사합니다. 시즌 원두 출시, 매장 소식, 정기배송 안내를 가장 먼저 받아보실 수 있습니다.
              </p>
            </td>
          </tr>

          <!-- CTA 버튼 -->
          <tr>
            <td align="left" style="padding:0 40px 64px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:#1C1B19;">
                    <a href="${APP_URL}"
                       style="display:inline-block;padding:16px 36px;font-size:14px;font-weight:500;color:#FFFFFF;text-decoration:none;letter-spacing:0.02em;">
                      사이트 둘러보기
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 헤어라인 -->
          <tr>
            <td style="padding:0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top:1px solid #EDEBE6;font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>

          <!-- 푸터 -->
          <tr>
            <td align="left" style="padding:28px 40px 48px;">
              <p style="margin:0;font-size:13px;color:#4A4844;line-height:1.5;text-align:left;">
                문의 사항이 있으시면 이 메일에 회신하시거나
                <a href="mailto:${esc(CONTACT_EMAIL)}" style="color:#000000;text-decoration:none;font-weight:600;">${esc(CONTACT_EMAIL)}</a>
                으로 연락 주시기 바랍니다.
              </p>
              <p style="margin:8px 0 0;font-size:13px;color:#4A4844;line-height:1.5;text-align:left;">
                뉴스레터 수신을 원하지 않으시면
                <a href="${unsubscribeUrl}" style="color:#000000;text-decoration:none;font-weight:600;">구독 취소</a>
                를 눌러주세요.
              </p>
              <p style="margin:12px 0 0;font-size:12px;color:#4A4844;line-height:1.5;text-align:left;">
                © ${new Date().getFullYear()} Good Things Roasters
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `굳띵즈 뉴스레터에 오신 것을 환영합니다

시즌 원두 출시 · 매장 소식 · 정기배송 안내를 가장 먼저 받아보십시오.

사이트 둘러보기: ${APP_URL}

────────────────────────────────────
본 메일은 발신 전용입니다.
문의: ${CONTACT_EMAIL}
구독 취소: ${unsubscribeUrl}

© ${new Date().getFullYear()} Good Things Roasters`;

  return { subject, html, text };
}
