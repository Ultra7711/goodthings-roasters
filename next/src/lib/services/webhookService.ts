/* ══════════════════════════════════════════════════════════════════════════
   webhookService.ts — Toss 웹훅 비즈 로직 (P2-B Session 5 B-4)

   역할:
   - ADR-002 하이브리드 인증 실행자.
       · 카드 PAYMENT_STATUS_CHANGED → `tossClient.getPayment` 권위 재조회
       · 가상계좌 DEPOSIT_CALLBACK  → `payments.webhook_secret` timing-safe 비교
   - payments-flow §3.2 의 멱등 키 규칙(§3.2.5) · 상태 매핑(§3.2.4) · 실패 매트릭스
     (§5) 을 코드로 고정.
   - 23505 UNIQUE 위반은 "이미 처리된 웹훅" 으로 해석 → 200 skip (silent).

   반환 원칙:
   - Route Handler 가 HTTP 응답으로 변환할 수 있도록 `WebhookResult` 가
     `{ kind, detail?, http }` 구조를 돌려준다. Response 객체는 만들지 않는다.
   - 타이밍 역전(§5.3.1) 전용 kind `timing_inversion` → Route 가 `Retry-After` +
     `x-webhook-timing-inversion` 헤더를 붙여 503 으로 응답.

   참조:
   - docs/payments-flow.md §3.2 · §3.2.4 · §3.2.5 · §5 · §5.3
   - docs/adr/ADR-002-payment-webhook-verification.md §3
   - supabase/migrations/012_payments_hardening.sql §4.4 (apply_webhook_event RPC)
   ══════════════════════════════════════════════════════════════════════════ */

import {
  cardPartialCancelIdempotencyKey,
  cardWebhookIdempotencyKey,
  depositWebhookIdempotencyKey,
  isPgUniqueViolation,
  unknownWebhookIdempotencyKey,
} from '@/lib/payments/idempotency';
import {
  TossApiError,
  TossNetworkError,
  getPayment as tossGetPayment,
  type TossGetPaymentResponse,
} from '@/lib/payments/tossClient';
import { verifyDepositSecret } from '@/lib/payments/webhookVerify';
import {
  applyWebhookEventRpc,
  findOrderForConfirm,
  findPaymentByOrderNumber,
} from '@/lib/repositories/paymentRepo';
import type {
  CardWebhookPayload,
  DepositWebhookPayload,
  UnknownWebhookPayload,
} from '@/lib/schemas/webhook';
import type { DbPaymentEventType } from '@/types/db';

/* ══════════════════════════════════════════
   결과 타입 — Route Handler 가 HTTP 로 매핑
   ══════════════════════════════════════════ */

export type WebhookResultKind =
  | 'ok'                // 정상/멱등 — 200
  | 'timing_inversion'  // 카드: payments 없음 / 가상계좌: webhook_secret 없음 — 503
  | 'auth_failed'       // secret 불일치 · 위조 의심(총액 mismatch) — 401
  | 'bad_request';      // 페이로드 내 order 조회 실패 등 — 400

export type WebhookResult = {
  kind: WebhookResultKind;
  /** 사용 목적: 로그·테스트 — 외부에는 노출하지 않는다. */
  detail?: string;
};

const OK: WebhookResult = { kind: 'ok' };

/* ══════════════════════════════════════════
   Toss status → event_type 매핑 (§3.2.4)
   ══════════════════════════════════════════ */

/** 카드 PAYMENT_STATUS_CHANGED 의 Toss status → 내부 event_type. */
export function mapCardStatus(status: string): DbPaymentEventType {
  switch (status) {
    case 'DONE':
      return 'payment_approved';
    case 'EXPIRED':
    case 'ABORTED':
      return 'payment_cancelled';
    case 'CANCELED':
    case 'PARTIAL_CANCELED':
      return 'refund_completed';
    /* READY · IN_PROGRESS · WAITING_FOR_DEPOSIT · 기타 → 감사 로그만 */
    default:
      return 'webhook_received';
  }
}

/** 가상계좌 DEPOSIT_CALLBACK 의 paymentStatus → 내부 event_type. */
export function mapDepositStatus(paymentStatus: string): DbPaymentEventType {
  switch (paymentStatus) {
    case 'DONE':
      return 'payment_approved';
    case 'CANCELED':
      return 'refund_completed';
    case 'EXPIRED':
      return 'payment_cancelled';
    /* WAITING_FOR_DEPOSIT 등 → 감사 로그만 */
    default:
      return 'webhook_received';
  }
}

/* ══════════════════════════════════════════
   내부 유틸 — amount 결정
   ══════════════════════════════════════════ */

/**
 * 카드 웹훅 이벤트별 저장할 amount 결정.
 * - PARTIAL_CANCELED: 해당 취소 트랜잭션 금액 (음수 저장은 006 enum 이 허용).
 *                     하지만 012 `apply_webhook_event` 는 `abs(p_amount)` 로 처리하므로
 *                     **양수로 그대로 전달**한다.
 * - CANCELED: 전액 환불 — totalAmount.
 * - DONE / EXPIRED / ABORTED: totalAmount.
 * - 기타(webhook_received): 0.
 */
function pickCardAmount(authoritative: TossGetPaymentResponse): number {
  const status = authoritative.status;
  if (status === 'PARTIAL_CANCELED') {
    const lastCancel = authoritative.cancels?.at(-1);
    return lastCancel?.cancelAmount ?? 0;
  }
  if (status === 'DONE' || status === 'CANCELED' || status === 'EXPIRED' || status === 'ABORTED') {
    return authoritative.totalAmount;
  }
  return 0;
}

/**
 * 카드 웹훅 멱등 키 — PARTIAL_CANCELED 는 §3.2.5 하이브리드 규칙.
 *
 * 폴백: `cancels[-1].transactionKey` 가 없으면 `lastTransactionKey` 로 대체.
 * 둘 다 없으면 `createdAt` 을 추가 세그먼트로 붙여 최소 유일성을 확보.
 */
function buildCardIdempotencyKey(
  payload: CardWebhookPayload,
  authoritative: TossGetPaymentResponse,
): string {
  const paymentKey = authoritative.paymentKey;

  if (authoritative.status === 'PARTIAL_CANCELED') {
    const cancelKey =
      authoritative.cancels?.at(-1)?.transactionKey ??
      authoritative.lastTransactionKey ??
      `${payload.createdAt}`;
    return cardPartialCancelIdempotencyKey(paymentKey, cancelKey);
  }

  const last =
    authoritative.lastTransactionKey ?? `fallback:${payload.createdAt}`;
  return cardWebhookIdempotencyKey(paymentKey, last);
}

/* ══════════════════════════════════════════
   handlers — 카드 / 가상계좌 / unknown
   ══════════════════════════════════════════ */

/**
 * 카드 웹훅 처리 (ADR-002 §3.1).
 *
 * 1) Toss GET 재조회 (권위) — 4xx/5xx 는 구분해 auth_failed/bad_request.
 * 2) orders 조회 — order_number = payload.data.orderId.
 *    payments 행 없음 = 타이밍 역전 (confirm 전에 웹훅 도착) → 503.
 * 3) 총액 교차검증 — order.total_amount !== authoritative.totalAmount → 401 위조.
 * 4) 멱등 키 합성 → apply_webhook_event RPC.
 * 5) 23505 UNIQUE → 200 silent.
 */
export async function handleCardWebhook(
  payload: CardWebhookPayload,
): Promise<WebhookResult> {
  /* 1) Toss 권위 재조회 */
  let authoritative: TossGetPaymentResponse;
  try {
    authoritative = await tossGetPayment(payload.data.paymentKey);
  } catch (err) {
    if (err instanceof TossApiError) {
      /* 4xx → Toss 가 해당 paymentKey 를 모른다 / 위조 — 401 분기. */
      return { kind: 'auth_failed', detail: `toss_api_${err.status}` };
    }
    if (err instanceof TossNetworkError) {
      /* 네트워크/5xx 재시도 실패 — Toss 가 재시도하도록 500 이 맞지만,
         Route 에서 500 을 떨어뜨려 Toss retry 유발. 여기서는 throw. */
      throw err;
    }
    throw err;
  }

  /* payload 와 Toss 응답의 orderId 일치 확인 — 위조 방어 */
  if (authoritative.orderId !== payload.data.orderId) {
    return { kind: 'auth_failed', detail: 'order_id_mismatch' };
  }

  /* 2) DB 매칭 — payments 존재 여부로 타이밍 역전 판정 */
  const paymentRow = await findPaymentByOrderNumber(payload.data.orderId);
  if (!paymentRow) {
    /* §5.3.1 — pending 상태에서 웹훅이 confirm 보다 먼저 도착. */
    return { kind: 'timing_inversion', detail: 'payment_row_missing' };
  }

  /* order UUID 확보 — RPC 는 UUID 필요 */
  const order = await findOrderForConfirm(payload.data.orderId);
  if (!order) {
    return { kind: 'bad_request', detail: 'order_not_found' };
  }

  /* 3) 총액 교차검증 */
  if (order.total_amount !== authoritative.totalAmount) {
    return { kind: 'auth_failed', detail: 'amount_mismatch' };
  }

  /* 4) 멱등 키 합성 + RPC */
  const eventType = mapCardStatus(authoritative.status);
  const amount = pickCardAmount(authoritative);
  const idempotencyKey = buildCardIdempotencyKey(payload, authoritative);

  try {
    await applyWebhookEventRpc({
      orderId: order.id,
      eventType,
      amount,
      rawPayload: { payload, authoritative } as unknown,
      idempotencyKey,
    });
    return OK;
  } catch (err) {
    if (isPgUniqueViolation(err)) return OK; // 이미 처리된 웹훅
    throw err;
  }
}

/**
 * 가상계좌 DEPOSIT_CALLBACK 처리 (ADR-002 §3.2).
 *
 * 1) payments 조회 — 없거나 webhook_secret 없음 → 503 타이밍 역전.
 * 2) timing-safe 비교 → 불일치 401.
 * 3) event_type 매핑 + 멱등 키 → RPC.
 */
export async function handleVirtualAccountWebhook(
  payload: DepositWebhookPayload,
): Promise<WebhookResult> {
  /* 1) payments 조회 */
  const paymentRow = await findPaymentByOrderNumber(payload.data.orderId);
  if (!paymentRow || !paymentRow.webhook_secret) {
    return { kind: 'timing_inversion', detail: 'webhook_secret_unavailable' };
  }

  /* 2) timing-safe 비교 */
  if (!verifyDepositSecret(payload.secret, paymentRow.webhook_secret)) {
    return { kind: 'auth_failed', detail: 'secret_mismatch' };
  }

  /* 3) event_type + 멱등 키 + RPC */
  const eventType = mapDepositStatus(payload.data.paymentStatus);
  const idempotencyKey = depositWebhookIdempotencyKey(
    payload.data.orderId,
    payload.data.paymentStatus,
    payload.createdAt,
  );

  /* 금액: DONE = approved_amount, 그 외(취소/만료) = approved_amount.
     (부분 환불이 없는 가상계좌 특성상 전액 기준이 맞다.) */
  const amount = paymentRow.approved_amount;

  try {
    await applyWebhookEventRpc({
      orderId: paymentRow.order_id,
      eventType,
      amount,
      rawPayload: payload as unknown,
      idempotencyKey,
    });
    return OK;
  } catch (err) {
    if (isPgUniqueViolation(err)) return OK;
    throw err;
  }
}

/**
 * 알 수 없는 eventType — 감사 로그만 남기고 200.
 *
 * RPC 는 `p_order_id` 가 필요 — payload 에 유효 orderId 가 없을 수 있어
 * DB INSERT 를 강제하지 않고 keylog 포맷으로 console.warn 만 남긴다.
 * 향후 Toss 가 신규 eventType 을 추가하면 본 함수를 분기로 확장한다.
 *
 * 멱등 키 자체는 다른 시스템이 payload 해시를 집계할 때 재사용할 수 있도록
 * 결과 detail 에 포함한다 (테스트 hook).
 */
export async function handleUnknownWebhook(
  payload: UnknownWebhookPayload,
): Promise<WebhookResult> {
  const createdAt = payload.createdAt ?? new Date().toISOString();
  const key = unknownWebhookIdempotencyKey(payload.eventType, createdAt);

  console.warn('[webhook] unknown eventType', {
    eventType: payload.eventType,
    idempotencyKey: key,
  });
  return { kind: 'ok', detail: key };
}
