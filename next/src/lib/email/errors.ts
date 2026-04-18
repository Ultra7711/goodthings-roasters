/* ══════════════════════════════════════════════════════════════════════════
   email/errors.ts — EmailError 클래스 + Resend 에러 정규화

   사양: docs/email-infrastructure.md §4.2
   ════════════════════════════════════════════════════════════════════════ */

import type { EmailErrorCode, EmailErrorShape } from './types';

export class EmailError extends Error {
  readonly code: EmailErrorCode;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(code: EmailErrorCode, message: string, retryable: boolean, cause?: unknown) {
    super(message);
    this.name = 'EmailError';
    this.code = code;
    this.retryable = retryable;
    this.cause = cause;
  }

  toShape(): EmailErrorShape {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
    };
  }
}

type RawResendError = {
  name?: string;
  message?: string;
  statusCode?: number;
};

function isRawResendError(v: unknown): v is RawResendError {
  return typeof v === 'object' && v !== null;
}

/**
 * Resend SDK 에러 객체 → EmailError 정규화.
 *
 * Resend v4 에러 형식: { name, message, statusCode }
 * - 429 / name === 'rate_limit_exceeded' → retryable
 * - 401 / 403                              → auth_failed
 * - 4xx (validation_error · invalid_*)     → invalid_payload
 * - 5xx                                     → provider_error (retryable)
 * - 그 외                                    → unknown
 */
export function normalizeResendError(err: unknown): EmailError {
  if (err instanceof EmailError) return err;

  if (!isRawResendError(err)) {
    return new EmailError('unknown', 'unknown email error', false, err);
  }

  const message = err.message ?? 'email send failed';
  const name = err.name ?? '';
  const status = err.statusCode ?? 0;

  if (name === 'rate_limit_exceeded' || status === 429) {
    return new EmailError('rate_limit_exceeded', message, true, err);
  }
  if (status === 401 || status === 403) {
    return new EmailError('auth_failed', message, false, err);
  }
  if (status >= 400 && status < 500) {
    return new EmailError('invalid_payload', message, false, err);
  }
  if (status >= 500) {
    return new EmailError('provider_error', message, true, err);
  }
  return new EmailError('unknown', message, false, err);
}
