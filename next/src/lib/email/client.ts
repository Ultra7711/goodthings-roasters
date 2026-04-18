/* ══════════════════════════════════════════════════════════════════════════
   email/client.ts — Resend SDK 싱글톤 + stub 구현

   사양: docs/email-infrastructure.md §3, §6
   ════════════════════════════════════════════════════════════════════════ */

import { Resend } from 'resend';
import { getEmailConfig } from './config';
import { createTokenBucket, type TokenBucket } from './rateLimit';

let resendClient: Resend | null = null;
let bucket: TokenBucket | null = null;

/**
 * live 모드 전용 Resend 싱글톤.
 * stub 모드에서는 호출되지 않으며, 호출 시 throw 로 오용 방어.
 */
export function getResendClient(): Resend {
  const config = getEmailConfig();
  if (config.mode !== 'live') {
    throw new Error('[email] getResendClient() called in stub mode');
  }
  if (!config.apiKey) {
    // getEmailConfig 가 이미 검증했으므로 이론상 도달 불가.
    throw new Error('[email] RESEND_API_KEY missing in live mode');
  }
  if (!resendClient) {
    resendClient = new Resend(config.apiKey);
  }
  return resendClient;
}

/**
 * 프로세스 싱글톤 토큰버킷. 첫 호출 시 EmailConfig.rps 로 초기화된다.
 */
export function getRateLimiter(): TokenBucket {
  if (!bucket) {
    const config = getEmailConfig();
    bucket = createTokenBucket(config.rps);
  }
  return bucket;
}

/** 테스트 전용 — 싱글톤 초기화. 프로덕션 코드에서 호출 금지. */
export function resetEmailClientForTests(): void {
  resendClient = null;
  bucket = null;
}
