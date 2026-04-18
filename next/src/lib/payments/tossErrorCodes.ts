/* ══════════════════════════════════════════════════════════════════════════
   payments/tossErrorCodes.ts — Toss 카드 거절 코드 분류 (Session 8 보안 #1)

   목적:
   - Carding RL (`payment_confirm_reject` 프리셋) 의 증분 대상 판정.
   - 카드사 거절 / 카드 정보 오류성 코드만 "공격 시그널" 로 간주하고
     카운트 — 네트워크·시스템 에러는 증분하지 않는다.

   스펙: docs/payments-security-hardening.md §2 (확정 D3)

   포함 기준 (공격 시그널):
   - INVALID_CARD          : 유효하지 않은 카드 정보
   - INVALID_CARD_NUMBER   : 카드번호 오류
   - INVALID_CARD_EXPIRATION : 만료일 오류
   - REJECT_CARD_COMPANY   : 카드사 승인 거절
   - NOT_SUPPORTED_CARD_TYPE : 지원 불가 카드
   - EXCEED_MAX_CARD_INSTALLMENT_PLAN : 할부 규칙 위반

   제외 기준:
   - EXCEED_MAX_DAILY_PAYMENT_COUNT (D3) — 카드사 레벨 한도, 공격 무관.
   - ALREADY_PROCESSED_PAYMENT       — 멱등 재처리 정상 경로.
   - 네트워크/타임아웃 (TossNetworkError)  — 우리 쪽 신호 아님.

   참조:
   - https://docs.tosspayments.com/reference/error-codes
   ══════════════════════════════════════════════════════════════════════════ */

export const CARD_REJECT_CODES: ReadonlySet<string> = new Set([
  'INVALID_CARD',
  'INVALID_CARD_NUMBER',
  'INVALID_CARD_EXPIRATION',
  'REJECT_CARD_COMPANY',
  'NOT_SUPPORTED_CARD_TYPE',
  'EXCEED_MAX_CARD_INSTALLMENT_PLAN',
]);

/**
 * Toss 에러 코드가 Carding 공격 시그널에 해당하는지.
 * null/undefined/빈 문자열 모두 false.
 */
export function isCardRejectionCode(code: string | null | undefined): boolean {
  if (!code) return false;
  return CARD_REJECT_CODES.has(code);
}
