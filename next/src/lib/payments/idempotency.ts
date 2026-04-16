/* ══════════════════════════════════════════════════════════════════════════
   idempotency.ts — payment_transactions.idempotency_key 합성 규칙 (B-3)

   payments-flow.md §3.2.5 의 하이브리드 규칙을 코드로 고정하여
   confirm API · webhook 핸들러(B-4) · 테스트 코드가 동일 키 포맷을 사용하도록
   단일 소스화한다.

   ⚠️ 이 파일의 키 포맷을 변경하면 DB(payment_transactions) 의 과거 레코드와
     정합성이 깨진다. 정말 바꿔야 한다면 마이그레이션 + 재키 스크립트를 동반할 것.

   참조:
   - payments-flow.md §3.2.5 idempotency_key 합성 규칙
   - supabase/migrations/006_payment_transactions.sql (UNIQUE 제약)
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * confirm API 경로 — `confirm:{paymentKey}`
 *
 * 012 마이그레이션 `confirm_payment` RPC 가 동일 규칙으로 INSERT 하므로
 * 앱 레이어와 DB 레이어의 키 포맷이 일치해야 한다.
 */
export function confirmIdempotencyKey(paymentKey: string): string {
  return `confirm:${paymentKey}`;
}

/**
 * 카드 PAYMENT_STATUS_CHANGED 웹훅 (일반 · PARTIAL_CANCELED 제외)
 *  — `webhook:{paymentKey}:{lastTransactionKey}`
 */
export function cardWebhookIdempotencyKey(
  paymentKey: string,
  lastTransactionKey: string,
): string {
  return `webhook:${paymentKey}:${lastTransactionKey}`;
}

/**
 * 카드 PARTIAL_CANCELED 웹훅 — `webhook:{paymentKey}:partial:{cancelTransactionKey}`
 *
 * 다회 부분취소 대응: `lastTransactionKey` 만 쓰면 여러 부분취소가 동일 키로
 * collapse → 감사 로그 유실. 마지막 cancel transactionKey 로 구분.
 */
export function cardPartialCancelIdempotencyKey(
  paymentKey: string,
  cancelTransactionKey: string,
): string {
  return `webhook:${paymentKey}:partial:${cancelTransactionKey}`;
}

/**
 * 가상계좌 DEPOSIT_CALLBACK — `webhook:deposit:{orderId}:{paymentStatus}:{createdAt}`
 *
 * DEPOSIT_CALLBACK 에는 lastTransactionKey · top-level paymentKey 부재.
 * orderId + 이벤트 타임스탬프 + 상태 조합으로 동일 상태 중복 재시도를 방어.
 */
export function depositWebhookIdempotencyKey(
  orderId: string,
  paymentStatus: string,
  createdAt: string,
): string {
  return `webhook:deposit:${orderId}:${paymentStatus}:${createdAt}`;
}

/**
 * 알 수 없는 eventType 감사 로그 전용 — `unknown:{eventType}:{createdAt}`
 */
export function unknownWebhookIdempotencyKey(
  eventType: string,
  createdAt: string,
): string {
  return `unknown:${eventType}:${createdAt}`;
}

/**
 * PostgreSQL UNIQUE 제약 위반 코드 (23505).
 *
 * 멱등성 키 UNIQUE 를 두 번째 INSERT 가 위반할 때 Supabase PostgrestError 의
 * `code` 필드가 '23505' 로 올라온다. 호출자가 이 코드를 catch 해 silent 200 처리.
 */
export const PG_UNIQUE_VIOLATION = '23505';

/**
 * Supabase PostgrestError 인지 여부를 얄팍하게 판별.
 * (PostgrestError 는 런타임에 exposed 된 class 가 아니라 덕 타이핑으로 처리.)
 */
export function isPgUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === PG_UNIQUE_VIOLATION
  );
}
