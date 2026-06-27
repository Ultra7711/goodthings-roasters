/* ══════════════════════════════════════════════════════════════════════════
   billingErrorPolicy.ts — 토스 빌링(자동결제) 에러 분류 정책 (R-1)

   역할:
   - 토스 자동결제 승인 실패 errorCode → retryable | permanent | unknown 분류.
   - dunning(R-3) 재시도 스케줄(retry_at) 산정 기준.

   기준선 (토스 공식 정책 · ~/.claude/plans/reactive-swinging-elephant.md):
   - 재시도 가능(일시): 카드사·한도·일시 거절·공급자 오류.
   - 재시도 불가(영구): 카드 만료·정지·분실/도난·빌링키 무효·customerKey 불일치.
   - unknown: 미분류 코드 — 보수적으로 1회 재시도 후 운영 점검(일시로 취급하되 짧게).

   주의:
   - 토스 errorCode 명칭은 버전·문서에 따라 변형이 있어, 흔한 동의어를 함께 등재한다.
   - 분류 모호 시 unknown → 호출자가 보수적으로 처리.
   ══════════════════════════════════════════════════════════════════════════ */

export type BillingErrorClass = 'retryable' | 'permanent' | 'unknown';

/* 일시 오류 — 시간차 재시도로 회복 가능. */
const RETRYABLE_CODES: ReadonlySet<string> = new Set<string>([
  'REJECT_CARD_PAYMENT',
  'REJECT_ACCOUNT_PAYMENT',
  'EXCEED_MAX_ONE_DAY_AMOUNT',
  'EXCEED_MAX_ONE_DAY_PAYMENT_COUNT',
  'EXCEED_MAX_DAILY_PAYMENT_COUNT',
  'EXCEED_MAX_PAYMENT_AMOUNT',
  'EXCEED_MAX_AMOUNT',
  'PROVIDER_ERROR',
  'FAILED_CARD_COMPANY',
  'FAILED_SYSTEM_CHECK_TIME',
  'FAILED_INTERNAL_SYSTEM_PROCESSING',
  'COMMON_ERROR',
  // 내부 분류(토스 외) — 네트워크/타임아웃은 즉시 재시도 대상.
  'NETWORK_ERROR',
  // 토스 출금 성공 후 후처리(RPC) 실패 — 재시도가 같은 order 로 멱등 복구(R-2a).
  'RPC_FAILED_AFTER_CHARGE',
]);

/* 영구 오류 — 결제수단 재등록 전까지 재시도 무의미. */
const PERMANENT_CODES: ReadonlySet<string> = new Set<string>([
  'INVALID_CARD_EXPIRATION',
  'INVALID_STOPPED_CARD',
  'INVALID_CARD_LOST_OR_STOLEN',
  'INVALID_BILL_KEY_REQUEST',
  'NOT_MATCHES_CUSTOMER_KEY',
  'NOT_FOUND_BILL_KEY',
  'UNAUTHORIZED_KEY',
  'REJECT_CARD_COMPANY',
  'NOT_AVAILABLE_BANK',
  'INVALID_CARD_NUMBER',
  'NOT_SUPPORTED_CARD_TYPE',
  // 내부 분류 — 기본 배송지 미설정·상품 단종은 데이터 수정 전 재시도 무의미.
  'NO_DEFAULT_ADDRESS',
  'PRODUCT_NOT_FOUND',
]);

/** 토스 errorCode(또는 내부 코드) → 분류. */
export function classifyBillingError(code: string | null | undefined): BillingErrorClass {
  if (!code) return 'unknown';
  if (PERMANENT_CODES.has(code)) return 'permanent';
  if (RETRYABLE_CODES.has(code)) return 'retryable';
  return 'unknown';
}

/* dunning 재시도 간격 (시간) — ADR-008 D-8: 24h → 48h → 72h 후 일시정지. */
export const RETRY_SCHEDULE_HOURS: readonly number[] = [24, 48, 72];

/**
 * 다음 재시도 시각(ISO) 산정.
 * - permanent: null (재시도 안 함 → R-3 에서 paused 전환).
 * - retryable | unknown: attemptCount(0-base) 에 해당하는 간격 후. 스케줄 소진 시 null.
 *
 * @param code         토스/내부 errorCode
 * @param attemptCount 지금까지 누적 실패 횟수(이번 실패 포함 전 값, 0-base)
 * @param nowMs        기준 시각 epoch(ms) — 테스트 주입용
 */
export function computeRetryAt(
  code: string | null | undefined,
  attemptCount: number,
  nowMs: number,
): string | null {
  const cls = classifyBillingError(code);
  if (cls === 'permanent') return null;
  // unknown 은 보수적으로 1회만 재시도(스케줄 첫 칸).
  const maxAttempts = cls === 'unknown' ? 1 : RETRY_SCHEDULE_HOURS.length;
  if (attemptCount >= maxAttempts) return null;
  const hours = RETRY_SCHEDULE_HOURS[Math.min(attemptCount, RETRY_SCHEDULE_HOURS.length - 1)];
  return new Date(nowMs + hours * 60 * 60 * 1000).toISOString();
}
