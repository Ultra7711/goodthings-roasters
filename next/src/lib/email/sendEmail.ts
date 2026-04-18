/* ══════════════════════════════════════════════════════════════════════════
   email/sendEmail.ts — 공용 이메일 발송 진입점

   사양: docs/email-infrastructure.md §8

   흐름:
     1) config 검증 (getEmailConfig — 부트 시점 fail-fast)
     2) 페이로드 검증 (to 필수, subject 필수, html/text/react 중 최소 1개,
        idempotencyKey 형식)
     3) from 기본값 주입
     4) mode === 'stub' → 마스킹 로그 + stub-uuid 반환
     5) mode === 'live' → rate limit acquire → Resend SDK 호출 → 응답 파싱
     6) 에러 정규화 + 마스킹 로깅 (실패 경로는 console.error)

   호출 측은 실패 시 결제 롤백하지 않는다 (docs §10).

   2026-04-17 Pass 1 수정:
     - code-review H-2: maskEmailAddress → lib/utils/maskEmail 공용 호출
     - code-review H-3 / ts M-6: 실패 경로 console.error, 경고 console.warn
     - security H-1: subject 원문 로깅 제거 → subjectLen 만 기록
     - security M-1: idempotencyKey JSON.stringify + 12자 truncate
     - security M-3: idempotencyKey 형식 검증 (/^[\w:._\-]{1,255}$/)

   2026-04-17 Session 8 Deferred 처리:
     - code M-x: logFailure 헬퍼로 console.error 3회 중복 DRY
     - security L-1: provider_error cause 에 response 전체 저장 금지 →
       { hasData, hasError, dataId } 요약만 보존 (PII 필드 유출 차단)
     - ts L-2: Resend SDK 타입(`CreateEmailOptions`/`CreateEmailRequestOptions`)
       정식 import → `unknown as` 캐스트 제거
   ════════════════════════════════════════════════════════════════════════ */

import { randomUUID } from 'node:crypto';
import type { CreateEmailOptions, CreateEmailRequestOptions } from 'resend';
import { getEmailConfig } from './config';
import { getRateLimiter, getResendClient } from './client';
import { EmailError, normalizeResendError } from './errors';
import { maskRecipients } from '../utils/maskEmail';
import type { EmailPayload, EmailResult } from './types';

/* ─── 로그 안전성 헬퍼 ─────────────────────────────────────────────────── */

/**
 * idempotencyKey 를 로그에 임베드할 때 사용. JSON.stringify 로 개행·따옴표를
 * 이스케이프하고, 12자 이후는 truncate. `"order-conf…"` 형태.
 */
function formatIdempotencyForLog(key: string): string {
  const head = key.length > 12 ? `${key.slice(0, 12)}…` : key;
  return JSON.stringify(head);
}

/* ─── 페이로드 검증 ──────────────────────────────────────────────────── */

// Resend idempotencyKey 는 공식 가이드에 형식 제약이 없으나, 로그 인젝션·외부
// 저장소(Redis 등) 키 충돌 방지를 위해 허용 문자를 좁힌다. `:`·`.`·`_`·`-`
// 은 `order-confirm:GTR-001` 류 실제 사용 패턴과 호환.
const IDEMPOTENCY_KEY_PATTERN = /^[\w:._\-]{1,255}$/;

function validatePayload(payload: EmailPayload): EmailError | null {
  const toList = Array.isArray(payload.to) ? payload.to : [payload.to];
  if (toList.length === 0 || toList.some((v) => typeof v !== 'string' || v.trim().length === 0)) {
    return new EmailError('invalid_payload', 'to is required', false);
  }
  if (typeof payload.subject !== 'string' || payload.subject.trim().length === 0) {
    return new EmailError('invalid_payload', 'subject is required', false);
  }
  const hasBody =
    (typeof payload.html === 'string' && payload.html.length > 0) ||
    (typeof payload.text === 'string' && payload.text.length > 0) ||
    payload.react !== undefined;
  if (!hasBody) {
    return new EmailError('invalid_payload', 'html, text, or react is required', false);
  }
  if (payload.idempotencyKey !== undefined) {
    if (typeof payload.idempotencyKey !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(payload.idempotencyKey)) {
      return new EmailError(
        'invalid_payload',
        'idempotencyKey must match /^[\\w:._\\-]{1,255}$/',
        false,
      );
    }
  }
  return null;
}

/* ─── stub 경로 ───────────────────────────────────────────────────────── */

function stubSend(payload: EmailPayload): EmailResult {
  const id = `stub-${randomUUID()}`;
  // 콘솔 1줄 구조화 로그 (PII 마스킹). subject 원문은 저장하지 않음 (security H-1).
  console.log(
    `[email:stub] id=${id} to=${maskRecipients(payload.to)} subjectLen=${payload.subject.length}` +
      (payload.idempotencyKey ? ` idempotencyKey=${formatIdempotencyForLog(payload.idempotencyKey)}` : ''),
  );
  return { ok: true, id, mode: 'stub' };
}

/* ─── live 경로 ───────────────────────────────────────────────────────── */

type ResendSendResult = {
  data: { id: string } | null;
  error: unknown;
};

/**
 * live 경로 실패 로그 헬퍼 (code M-x DRY).
 *
 * 3개 실패 분기(throw / response.error / missing id)가 동일 포맷을 공유하므로
 * 단일 helper 로 묶는다. PII 필드(subject 원문·body·response 전체) 는 로깅
 * 대상에서 제외 — to 는 마스킹, duration 은 숫자만.
 */
function logLiveFailure(
  err: EmailError,
  to: EmailPayload['to'],
  startedAt: number,
): void {
  console.error(
    `[email:live] FAIL code=${err.code} retryable=${err.retryable} ` +
      `to=${maskRecipients(to)} duration=${Date.now() - startedAt}ms`,
  );
}

/**
 * Resend 응답의 안전한 요약 (security L-1).
 *
 * provider_error cause 에 response 전체를 저장하면 차후 response.data.to /
 * response.error.headers 등 향후 SDK 변경으로 PII 필드가 포함될 수 있다.
 * 형태 불변 필드(boolean·문자열 id)만 남겨 로그 안전성 보존.
 */
function summarizeResendResponse(res: ResendSendResult): {
  hasData: boolean;
  hasError: boolean;
  dataId: string | null;
} {
  return {
    hasData: res.data !== null,
    hasError: res.error !== null && res.error !== undefined,
    dataId: res.data?.id ?? null,
  };
}

async function liveSend(payload: EmailPayload): Promise<EmailResult> {
  const config = getEmailConfig();
  const bucket = getRateLimiter();
  const client = getResendClient();

  await bucket.acquire();

  const from = payload.from ?? config.fromEmail;
  const replyTo = payload.replyTo ?? config.replyTo ?? undefined;

  /* ts L-2: Resend 정식 타입 사용 (unknown as 제거).
     CreateEmailOptions 는 html/text/react 중 최소 1개를 요구하는 discriminated
     RequireAtLeastOne 이지만 validatePayload 가 이미 보장한다. */
  const sdkPayload: CreateEmailOptions = {
    from,
    to: payload.to,
    subject: payload.subject,
    ...(payload.html !== undefined ? { html: payload.html } : {}),
    ...(payload.text !== undefined ? { text: payload.text } : {}),
    ...(payload.react !== undefined ? { react: payload.react } : {}),
    ...(payload.cc !== undefined ? { cc: payload.cc } : {}),
    ...(payload.bcc !== undefined ? { bcc: payload.bcc } : {}),
    ...(replyTo !== undefined ? { replyTo } : {}),
  } as CreateEmailOptions;

  const sendOptions: CreateEmailRequestOptions | undefined = payload.idempotencyKey
    ? { idempotencyKey: payload.idempotencyKey }
    : undefined;

  const start = Date.now();
  let response: ResendSendResult;
  try {
    // Resend v4: client.emails.send(payload, options?)
    response = (await client.emails.send(sdkPayload, sendOptions)) as ResendSendResult;
  } catch (err) {
    // security H-3: 원본 err.message 를 EmailError.message 로 복사하지 않는다.
    // 고정 문자열로 교체하고 원본은 cause 에만 보존 → 클라이언트 응답 유출 차단.
    const normalized =
      err instanceof EmailError
        ? err
        : new EmailError('network_error', 'network error', true, err);
    logLiveFailure(normalized, payload.to, start);
    return { ok: false, error: normalized.toShape(), mode: 'live' };
  }

  if (response.error) {
    const normalized = normalizeResendError(response.error);
    logLiveFailure(normalized, payload.to, start);
    return { ok: false, error: normalized.toShape(), mode: 'live' };
  }

  if (!response.data?.id) {
    /* security L-1: response 전체를 cause 로 넘기지 않고 요약만 보존. */
    const err = new EmailError(
      'provider_error',
      'resend response missing id',
      true,
      summarizeResendResponse(response),
    );
    logLiveFailure(err, payload.to, start);
    return { ok: false, error: err.toShape(), mode: 'live' };
  }

  console.log(
    `[email:live] id=${response.data.id} to=${maskRecipients(payload.to)} ` +
      `subjectLen=${payload.subject.length} duration=${Date.now() - start}ms` +
      (payload.idempotencyKey ? ` idempotencyKey=${formatIdempotencyForLog(payload.idempotencyKey)}` : ''),
  );

  return { ok: true, id: response.data.id, mode: 'live' };
}

/* ─── 공용 진입 ───────────────────────────────────────────────────────── */

export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const config = getEmailConfig();

  const validationError = validatePayload(payload);
  if (validationError) {
    return { ok: false, error: validationError.toShape(), mode: config.mode };
  }

  if (config.mode === 'stub') {
    return stubSend(payload);
  }
  return liveSend(payload);
}
