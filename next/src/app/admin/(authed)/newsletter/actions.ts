'use server';

/* ══════════════════════════════════════════════════════════════════════════
   actions.ts — /admin/newsletter Server Actions (S250-2)

   exportNewsletterSubscribersXlsxAction — 구독자 목록 XLSX 내보내기.
   - owner 전용 (PII = 이메일 · users export 정책 답습 · getAdminOwnerClaims)
   - 현재 필터(status·q) 반영 · MAX_EXPORT_ROWS 초과 시 truncated
   - admin_export_log 기록 (domain 'newsletter' · 082 마이그)
   exportUsersXlsxAction 1:1 답습.

   sendTestNewsletterAction / sendNewsletterCampaignAction — 발송 (S250-2 Phase 2)
   - 테스트: admin 누구나 · 단일 수신.
   - 캠페인: owner 전용 · active 구독자 전원 순차 발송(sendEmail rate-limited) +
     수신자별 List-Unsubscribe 헤더 + newsletter_campaigns 이력 INSERT.
   ══════════════════════════════════════════════════════════════════════════ */

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getAdminClaims, getAdminOwnerClaims } from '@/lib/auth/getClaims';
import { fetchNewsletterSubscribersForExport } from '@/lib/admin/newsletterServer';
import { NEWSLETTER_SOURCE_LABEL } from '@/lib/admin/newsletter';
import { newsletterDraftSchema, type NewsletterDraft } from '@/lib/admin/newsletterCompose';
import {
  MAX_EXPORT_ROWS,
  buildExportFilename,
  formatKstDateTimeCell,
  logExportAudit,
  nowKstDisplay,
} from '@/lib/admin/csvExport';
import { buildXlsxBuffer, bufferToBase64 } from '@/lib/admin/xlsxExport';
import { logActionError } from '@/lib/admin/logActionError';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/email/sendEmail';
import { renderNewsletterEmail } from '@/lib/email/templates/newsletterEmail';

const ExportInputSchema = z.object({
  status: z.enum(['all', 'active', 'unsubscribed']).default('all'),
  q: z.string().default(''),
});

export type ExportNewsletterInput = z.input<typeof ExportInputSchema>;

export type ExportNewsletterResult =
  | { ok: true; filename: string; xlsxBase64: string; rowCount: number; truncated: boolean }
  | { ok: false; error: 'unauthorized' | 'validation_failed' | 'server_error' };

export async function exportNewsletterSubscribersXlsxAction(
  input: ExportNewsletterInput,
): Promise<ExportNewsletterResult> {
  const claims = await getAdminOwnerClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = ExportInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation_failed' };

  try {
    const { rows, truncated } = await fetchNewsletterSubscribersForExport(
      { status: parsed.data.status, q: parsed.data.q },
      MAX_EXPORT_ROWS,
    );

    const headers = ['이메일', '이름', '상태', '유입', '가입일'] as const;
    const dataRows = rows.map((r) => [
      r.email,
      r.userName ?? (r.userId ? '—' : '비회원'),
      r.status === 'active' ? '활성' : '거부',
      NEWSLETTER_SOURCE_LABEL[r.source] ?? r.source,
      formatKstDateTimeCell(r.createdAtIso),
    ]);

    const buffer = await buildXlsxBuffer(headers, dataRows, {
      domain: '뉴스레터',
      generatedAtKst: nowKstDisplay(),
    });
    const filename = buildExportFilename('newsletter', 'xlsx');

    await logExportAudit({
      domain: 'newsletter',
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
    logActionError('[exportNewsletterSubscribersXlsxAction] failed', err instanceof Error ? err : null);
    return { ok: false, error: 'server_error' };
  }
}

/* ── 발송 (S250-2 Phase 2) ────────────────────────────────────────────── */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://goodthingsroasters.com';

/* 활성 구독자 fetch 상한 — 무료 티어(일 100통) 기준 충분. 초과분은 carry. */
const MAX_CAMPAIGN_RECIPIENTS = 5000;

/* idempotencyKey 안전 문자만 (IDEMPOTENCY_KEY_PATTERN 정합). */
function emailKeyPart(email: string): string {
  return email.toLowerCase().replace(/[^a-z0-9._\-]/g, '_').slice(0, 80);
}

/* 수신자별 List-Unsubscribe 헤더 (RFC 2369 + RFC 8058 one-click).
   POST 엔드포인트 = /api/newsletter/unsubscribe (C8). */
function buildUnsubscribeHeaders(token: string): Record<string, string> {
  const url = `${APP_URL}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
  return {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

export type SendTestNewsletterResult =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'validation_failed' | 'send_failed' };

/**
 * 테스트 발송 — 단일 수신 (admin 누구나).
 * 실제 발송 전 레이아웃·이미지·구독취소 링크 확인용.
 * unsubscribeToken 은 placeholder(랜덤) — 실 row 와 매치 안 되어도 graceful.
 */
export async function sendTestNewsletterAction(
  draft: NewsletterDraft,
  toEmail: string,
): Promise<SendTestNewsletterResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = newsletterDraftSchema.safeParse(draft);
  const emailParsed = z.string().trim().email().safeParse(toEmail);
  if (!parsed.success || !emailParsed.success) {
    return { ok: false, error: 'validation_failed' };
  }

  const token = randomUUID();
  const { subject, html, text } = renderNewsletterEmail({
    subject: parsed.data.subject,
    blocks: parsed.data.blocks,
    unsubscribeToken: token,
  });

  try {
    const result = await sendEmail({
      to: emailParsed.data,
      subject: `[테스트] ${subject}`,
      html,
      text,
      headers: buildUnsubscribeHeaders(token),
      idempotencyKey: `nl-test:${emailKeyPart(emailParsed.data)}:${token.replace(/[^a-z0-9]/gi, '').slice(0, 8)}`,
    });
    if (!result.ok) {
      logActionError('[sendTestNewsletterAction] send failed', null, {
        code: result.error.code,
      });
      return { ok: false, error: 'send_failed' };
    }
    return { ok: true };
  } catch (err: unknown) {
    logActionError('[sendTestNewsletterAction] unexpected', err instanceof Error ? err : null);
    return { ok: false, error: 'send_failed' };
  }
}

export type SendNewsletterCampaignResult =
  | { ok: true; recipientCount: number; sentCount: number; failedCount: number }
  | {
      ok: false;
      error: 'unauthorized' | 'validation_failed' | 'no_recipients' | 'server_error';
    };

/**
 * 캠페인 발송 — active 구독자 전원 (owner 전용).
 *
 * - 수신자별 개인화(구독취소 토큰 footer + List-Unsubscribe 헤더) → 통별 sendEmail.
 * - sendEmail 토큰버킷(5rps)이 자연 throttle. 무료 티어 일 100통 규모에서 안전.
 * - 개별 실패는 집계만 하고 나머지 진행 (fail-soft).
 * - 발송 후 newsletter_campaigns INSERT (blocks 보존 → 복제 재발송).
 * - idempotencyKey `nl:{campaign}:{email}` → 24h 내 중복 발송 차단.
 */
export async function sendNewsletterCampaignAction(
  draft: NewsletterDraft,
): Promise<SendNewsletterCampaignResult> {
  const claims = await getAdminOwnerClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = newsletterDraftSchema.safeParse(draft);
  if (!parsed.success) return { ok: false, error: 'validation_failed' };

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('newsletter_subscribers')
    .select('email, unsubscribe_token')
    .eq('status', 'active')
    .range(0, MAX_CAMPAIGN_RECIPIENTS - 1);
  if (error) {
    logActionError('[sendNewsletterCampaignAction] recipients fetch failed', error);
    return { ok: false, error: 'server_error' };
  }

  const recipients = (data ?? []) as { email: string; unsubscribe_token: string }[];
  if (recipients.length === 0) return { ok: false, error: 'no_recipients' };

  const campaignId = randomUUID();
  const campaignKeyPart = campaignId.replace(/[^a-z0-9]/gi, '').slice(0, 12);

  let sentCount = 0;
  let failedCount = 0;

  for (const r of recipients) {
    try {
      const { subject, html, text } = renderNewsletterEmail({
        subject: parsed.data.subject,
        blocks: parsed.data.blocks,
        unsubscribeToken: r.unsubscribe_token,
      });
      const result = await sendEmail({
        to: r.email,
        subject,
        html,
        text,
        headers: buildUnsubscribeHeaders(r.unsubscribe_token),
        idempotencyKey: `nl:${campaignKeyPart}:${emailKeyPart(r.email)}`,
      });
      if (result.ok) sentCount += 1;
      else failedCount += 1;
    } catch (err: unknown) {
      failedCount += 1;
      logActionError(
        '[sendNewsletterCampaignAction] recipient send failed',
        err instanceof Error ? err : null,
      );
    }
  }

  const status = failedCount === 0 ? 'sent' : sentCount === 0 ? 'failed' : 'partial';

  const { error: insErr } = await admin.from('newsletter_campaigns').insert({
    id: campaignId,
    subject: parsed.data.subject,
    blocks: parsed.data.blocks,
    recipient_count: recipients.length,
    sent_count: sentCount,
    failed_count: failedCount,
    status,
    created_by: claims.userId,
    sent_at: new Date().toISOString(),
  });
  if (insErr) {
    /* 발송은 이미 완료 — 이력 INSERT 실패는 로그만 (결과는 정상 반환). */
    logActionError('[sendNewsletterCampaignAction] campaign insert failed', insErr);
  }

  return {
    ok: true,
    recipientCount: recipients.length,
    sentCount,
    failedCount,
  };
}
