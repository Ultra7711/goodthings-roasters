/* ══════════════════════════════════════════════════════════════════════════
   webhookVerify.ts — 가상계좌 DEPOSIT_CALLBACK secret 검증 유틸 (P2-B B-4)

   역할:
   - Toss 가상계좌 웹훅의 top-level `secret` 필드를
     `payments.webhook_secret` (DB 저장값) 와 **timing-safe** 비교.
   - 카드 PAYMENT_STATUS_CHANGED 는 secret 방식이 아님 — `tossClient.getPayment`
     로 권위 재조회(§3.1 / ADR-002 §3.1). 본 모듈은 가상계좌 경로 전용.

   보안 원칙:
   - 문자열 비교는 타이밍 차이로 secret 을 추출하는 side channel 공격을 방어하기 위해
     반드시 `crypto.timingSafeEqual` 사용. `===` · `strcmp` 금지.
   - 길이가 다르면 `timingSafeEqual` 이 throw 하므로 사전 length 비교로 분기 일원화.

   서버 전용:
   - Node.js `crypto` 모듈 의존. 클라이언트 번들 유입 금지.

   참조:
   - docs/payments-flow.md §3.2.3 (가상계좌 검증) · §6.3 (timing-safe 비교 예시)
   - docs/adr/ADR-002-payment-webhook-verification.md §3.2
   ══════════════════════════════════════════════════════════════════════════ */

/* 런타임 가드 — 클라이언트 번들 유입 방어 (라우트 핸들러/서비스에서만 사용) */
if (typeof window !== 'undefined') {
  throw new Error('webhookVerify 은 서버 전용 모듈입니다.');
}

import { timingSafeEqual } from 'node:crypto';

/**
 * Toss 가상계좌 `secret` 을 DB 저장값과 timing-safe 비교.
 *
 * - 길이 불일치 또는 UTF-8 인코딩 실패 → false (401 유도).
 * - 내용 불일치 → false (401 유도).
 * - 정확 일치 → true.
 *
 * @param provided Toss 페이로드 top-level `secret`
 * @param expected DB `payments.webhook_secret` 값
 */
export function verifyDepositSecret(
  provided: string,
  expected: string,
): boolean {
  /* 명백한 invariant 먼저 차단 (timingSafeEqual 호출 비용 절감 + 타입 안전성).
     두 문자열 모두 secret 이 아니라 "입력된 값"과 "기대값" 모두 UTF-8 그대로 비교. */
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;
  if (provided.length === 0 || expected.length === 0) return false;

  const providedBuf = Buffer.from(provided, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');

  /* timingSafeEqual 은 길이가 다르면 throw — 사전 체크로 일원화.
     길이 비교 자체는 상수시간이 아니지만 secret 길이를 감춰도
     Toss 가 secret 포맷을 표준화하므로 실익이 없다. */
  if (providedBuf.length !== expectedBuf.length) return false;

  return timingSafeEqual(providedBuf, expectedBuf);
}
