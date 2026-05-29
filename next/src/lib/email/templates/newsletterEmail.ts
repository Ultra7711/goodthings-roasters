/* ══════════════════════════════════════════════════════════════════════════
   email/templates/newsletterEmail.ts — 뉴스레터 캠페인 본문 렌더러 (S250-2 Phase 2)

   newsletterWelcomeEmail 의 600px 테이블 + 인라인 스타일 shell 을 재사용한다.
   고정 shell(로고 헤더 + 헤어라인 + 푸터[문의·구독취소·©])은 그대로 두고,
   가운데 본문만 컴포저 블록(heading / paragraph / image / cta)으로 채운다.

   - 순수 함수 (node 의존 없음) → 컴포저(client)의 라이브 미리보기에서도 import.
   - 모든 동적 값은 esc() 적용 (HTML 인젝션 방어).
   - 디자인 토큰: #1C1B19(텍스트/버튼) · #4A4844(본문) · #EDEBE6(헤어라인) ·
     600px box · padding 40px. (newsletterWelcomeEmail 과 1:1 정합)
   ════════════════════════════════════════════════════════════════════════ */

import type { NewsletterBlock } from '@/lib/admin/newsletterCompose';
import { esc } from './utils';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://goodthingsroasters.com';
const LOGO_URL = `${APP_URL}/images/icons/logo-email.png`;
const CONTACT_EMAIL = process.env.RESEND_REPLY_TO ?? 'hello@goodthingsroasters.com';

/* 본문 박스 안쪽 폭 = 600 - (좌우 padding 40*2) = 520px */
const CONTENT_WIDTH = 520;

export type NewsletterEmailProps = {
  subject: string;
  blocks: NewsletterBlock[];
  /** 푸터 구독취소 링크용 토큰 (수신자별). 미리보기는 placeholder 토큰 사용. */
  unsubscribeToken: string;
};

/* ─── 블록 → HTML row ──────────────────────────────────────────────────── */

function escMultiline(value: string): string {
  return esc(value).replace(/\r?\n/g, '<br>');
}

function blockHtml(block: NewsletterBlock): string {
  switch (block.type) {
    case 'heading':
      return `
          <tr>
            <td align="left" style="padding:0 40px 16px;">
              <h1 style="margin:0;font-size:26px;font-weight:600;color:#1C1B19;line-height:1.4;letter-spacing:-0.02em;text-align:left;">
                ${esc(block.text)}
              </h1>
            </td>
          </tr>`;
    case 'paragraph':
      return `
          <tr>
            <td align="left" style="padding:0 40px 24px;">
              <p style="margin:0;font-size:16px;color:#4A4844;line-height:1.75;text-align:left;">
                ${escMultiline(block.text)}
              </p>
            </td>
          </tr>`;
    case 'image': {
      const img = `<img src="${esc(block.src)}" width="${CONTENT_WIDTH}" alt="${esc(block.alt)}"
                   style="display:block;width:100%;max-width:${CONTENT_WIDTH}px;height:auto;border:0;outline:none;">`;
      const inner = block.href
        ? `<a href="${esc(block.href)}" style="text-decoration:none;border:0;">${img}</a>`
        : img;
      return `
          <tr>
            <td align="left" style="padding:0 40px 24px;">
              ${inner}
            </td>
          </tr>`;
    }
    case 'cta':
      return `
          <tr>
            <td align="left" style="padding:8px 40px 32px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:#1C1B19;">
                    <a href="${esc(block.url)}"
                       style="display:inline-block;padding:16px 36px;font-size:14px;font-weight:500;color:#FFFFFF;text-decoration:none;letter-spacing:0.02em;">
                      ${esc(block.label)}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
  }
}

/* ─── 블록 → text ─────────────────────────────────────────────────────── */

function blockText(block: NewsletterBlock): string {
  switch (block.type) {
    case 'heading':
      return block.text;
    case 'paragraph':
      return block.text;
    case 'image':
      return block.alt ? `[이미지: ${block.alt}]` : '[이미지]';
    case 'cta':
      return `${block.label}: ${block.url}`;
  }
}

/* ─── 공개 렌더 ───────────────────────────────────────────────────────── */

export function renderNewsletterEmail(
  props: NewsletterEmailProps,
): { subject: string; html: string; text: string } {
  const subject = props.subject;
  const unsubscribeUrl = `${APP_URL}/unsubscribe?token=${esc(props.unsubscribeToken)}`;
  const blocksHtml = props.blocks.map(blockHtml).join('');

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

        <!-- 600px 메일 박스 -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- 로고 -->
          <tr>
            <td align="left" style="padding:48px 40px 40px;">
              <img src="${LOGO_URL}" width="140" alt="good things"
                   style="display:block;width:140px;height:auto;border:0;outline:none;">
            </td>
          </tr>
${blocksHtml}
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

  const bodyText = props.blocks.map(blockText).join('\n\n');
  const text = `${bodyText}

────────────────────────────────────
본 메일은 발신 전용입니다.
문의: ${CONTACT_EMAIL}
구독 취소: ${unsubscribeUrl}

© ${new Date().getFullYear()} Good Things Roasters`;

  return { subject, html, text };
}
