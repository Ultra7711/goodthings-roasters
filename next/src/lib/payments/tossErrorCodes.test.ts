/* ══════════════════════════════════════════════════════════════════════════
   tossErrorCodes.test.ts — 카드 거절 코드 분류 테스트 (Session 8 보안 #1)
   ══════════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';
import { isCardRejectionCode, CARD_REJECT_CODES } from './tossErrorCodes';

describe('isCardRejectionCode', () => {
  it('[1] 카드 거절 코드 6종은 모두 true', () => {
    expect(isCardRejectionCode('INVALID_CARD')).toBe(true);
    expect(isCardRejectionCode('INVALID_CARD_NUMBER')).toBe(true);
    expect(isCardRejectionCode('INVALID_CARD_EXPIRATION')).toBe(true);
    expect(isCardRejectionCode('REJECT_CARD_COMPANY')).toBe(true);
    expect(isCardRejectionCode('NOT_SUPPORTED_CARD_TYPE')).toBe(true);
    expect(isCardRejectionCode('EXCEED_MAX_CARD_INSTALLMENT_PLAN')).toBe(true);
  });

  it('[2] 확정 D3: EXCEED_MAX_DAILY_PAYMENT_COUNT 는 false (카드사 한도, 공격 무관)', () => {
    expect(isCardRejectionCode('EXCEED_MAX_DAILY_PAYMENT_COUNT')).toBe(false);
  });

  it('[3] ALREADY_PROCESSED_PAYMENT 는 false (멱등 재처리 정상 경로)', () => {
    expect(isCardRejectionCode('ALREADY_PROCESSED_PAYMENT')).toBe(false);
  });

  it('[4] 빈 값/null/undefined 는 false', () => {
    expect(isCardRejectionCode('')).toBe(false);
    expect(isCardRejectionCode(null)).toBe(false);
    expect(isCardRejectionCode(undefined)).toBe(false);
  });

  it('[5] 알 수 없는 코드는 false', () => {
    expect(isCardRejectionCode('UNKNOWN_ERROR_CODE')).toBe(false);
  });

  it('[6] CARD_REJECT_CODES 는 readonly Set (6개)', () => {
    expect(CARD_REJECT_CODES.size).toBe(6);
  });
});
