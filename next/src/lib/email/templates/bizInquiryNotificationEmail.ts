/* ══════════════════════════════════════════════════════════════════════════
   email/templates/bizInquiryNotificationEmail.ts — B2B 문의 운영자 알림 (S243-A-2)

   사용처: submitBizInquiry server action 성공 직후 자동 발송 (Resend · fire-and-forget).
   수신자: 운영자 (BIZ_INQUIRY_TO 또는 RESEND_REPLY_TO).

   디자인:
   - 사용자 친화 아닌 운영자 정보 메일 — minimal table 레이아웃.
   - 모든 입력 필드 라벨 + 값 한눈에. 빈 값은 "—" 로 표시.
   - 회신용 사용자 이메일은 reply-to header + 본문 강조.

   인자: 라벨 변환은 호출처에서 완료한 상태 (BIZ_TYPE_OPTIONS 등 label 매핑).
   ════════════════════════════════════════════════════════════════════════ */

import { esc } from './utils';

export type BizInquiryNotificationProps = {
  name: string;
  email: string;
  phone: string;
  company: string;
  bizTypeLabel: string;
  address: string;
  regNum: string | null;
  equipment: string | null;
  currentBean: string | null;
  productLabels: string[];
  monthlyVolumeLabel: string | null;
  deliveryCycleLabel: string | null;
  message: string;
  submittedAt: string;
};

function fmtValue(v: string | null | undefined): string {
  return v && v.trim() ? esc(v) : '<span style="color:#A0A0A0;">—</span>';
}

function fmtMultiline(v: string): string {
  return esc(v).replace(/\n/g, '<br>');
}

export function renderBizInquiryNotificationEmail(
  props: BizInquiryNotificationProps,
): { subject: string; html: string; text: string } {
  const subject = `[GTR 비즈니스 문의] ${props.company} · ${props.bizTypeLabel}`;
  const productsLabel = props.productLabels.length > 0
    ? props.productLabels.join(', ')
    : null;

  const rows: { label: string; value: string | null }[] = [
    { label: '고객명', value: props.name },
    { label: '이메일', value: props.email },
    { label: '전화번호', value: props.phone },
    { label: '상호명', value: props.company },
    { label: '업종', value: props.bizTypeLabel },
    { label: '사업장 주소', value: props.address },
    { label: '사업자등록번호', value: props.regNum },
    { label: '보유 장비', value: props.equipment },
    { label: '사용 중인 원두', value: props.currentBean },
    { label: '관심 제품', value: productsLabel },
    { label: '예상 월 사용량', value: props.monthlyVolumeLabel },
    { label: '희망 납품 주기', value: props.deliveryCycleLabel },
  ];

  const rowsHtml = rows
    .map(
      (r) => `
            <tr>
              <td style="padding:10px 0;width:140px;color:#666666;font-size:13px;line-height:1.6;letter-spacing:0.02em;vertical-align:top;">${esc(r.label)}</td>
              <td style="padding:10px 0;color:#1A1A1A;font-size:13px;line-height:1.6;vertical-align:top;">${fmtValue(r.value)}</td>
            </tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F4F2;font-family:'Pretendard','Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F4F2;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background-color:#FFFFFF;">

          <!-- 헤더 -->
          <tr>
            <td style="padding:32px 40px 16px;border-bottom:1px solid #E5E2DD;">
              <div style="font-size:12px;color:#A0A0A0;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px;">Good Things Roasters</div>
              <div style="font-size:20px;color:#1A1A1A;font-weight:500;">새 비즈니스 문의가 접수되었습니다</div>
              <div style="font-size:13px;color:#666666;margin-top:4px;">${esc(props.submittedAt)}</div>
            </td>
          </tr>

          <!-- 필드 테이블 -->
          <tr>
            <td style="padding:24px 40px 8px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${rowsHtml}
              </table>
            </td>
          </tr>

          <!-- 메시지 -->
          <tr>
            <td style="padding:16px 40px 32px;">
              <div style="color:#666666;font-size:13px;letter-spacing:0.02em;margin-bottom:8px;">요청 사항</div>
              <div style="padding:16px;background-color:#FAFAFA;border-left:2px solid #1A1A1A;color:#1A1A1A;font-size:14px;line-height:1.7;">${fmtMultiline(props.message)}</div>
            </td>
          </tr>

          <!-- 푸터 -->
          <tr>
            <td style="padding:16px 40px 32px;border-top:1px solid #E5E2DD;">
              <div style="font-size:12px;color:#999999;line-height:1.6;">
                회신은 이 메일에 직접 답장하거나 <a href="mailto:${esc(props.email)}" style="color:#1A1A1A;">${esc(props.email)}</a> 로 보내면 됩니다.<br>
                개인정보 수집·이용에 동의한 시점에 자동 발송된 알림입니다.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textRows = rows
    .map((r) => `${r.label}: ${r.value && r.value.trim() ? r.value : '—'}`)
    .join('\n');

  const text = `[GTR 비즈니스 문의]
${props.submittedAt}

${textRows}

요청 사항:
${props.message}

──
회신은 이 메일에 직접 답장하거나 ${props.email} 로.`;

  return { subject, html, text };
}
