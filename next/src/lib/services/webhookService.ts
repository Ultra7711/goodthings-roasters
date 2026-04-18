/* ══════════════════════════════════════════════════════════════════════════
   webhookService.ts — Toss 웹훅 비즈 로직 (P2-B Session 5 B-4 · Session 6 폴리시)

   역할:
   - ADR-002 하이브리드 인증 실행자.
       · 카드 PAYMENT_STATUS_CHANGED → `tossClient.getPayment` 권위 재조회
       · 가상계좌 DEPOSIT_CALLBACK  → `payments.webhook_secret` timing-safe 비교
   - payments-flow §3.2 의 멱등 키 규칙(§3.2.5) · 상태 매핑(§3.2.4) · 실패 매트릭스
     (§5) 을 코드로 고정.
   - 23505 UNIQUE 위반은 "이미 처리된 웹훅" 으로 해석 → 200 skip (silent).

   Session 6 변경:
   - H-4 (쿼리 통합): `findOrderWithPaymentByOrderNumber` 단일 쿼리로 orders + payments
     동시 조회. 기존 2회 round-trip 제거.
   - C-3 (PII 마스킹): RPC 의 rawPayload 저장 전 `maskTossPayload` 적용.
   - ts H-3: TossNetworkError 중복 throw 분기 축약.

   반환 원칙:
   - Route Handler 가 HTTP 응답으로 변환할 수 있도록 `WebhookResult` 가
     `{ kind, detail? }` 구조를 돌려준다. Response 객체는 만들지 않는다.
   - 타이밍 역전(§5.3.1) 전용 kind `timing_inversion` → Route 가 `Retry-After` +
     `x-webhook-timing-inversion` 헤더를 붙여 503 으로 응답.

   참조:
   - docs/payments-flow.md §3.2 · §3.2.4 · §3.2.5 · §5 · §5.3
   - docs/adr/ADR-002-payment-webhook-verification.md §3
   - supabase/migrations/012_payments_hardening.sql §4.4 (apply_webhook_event RPC)
   - supabase/migrations/013_payments_hardening_followup.sql
   ══════════════════════════════════════════════════════════════════════════ */

import {
  cardPartialCancelIdempotencyKey,
  cardWebhookIdempotencyKey,
  depositWebhookIdempotencyKey,
  isPgUniqueViolation,
  unknownWebhookIdempotencyKey,
} from '@/lib/payments/idempotency';
import { maskTossPayload } from '@/lib/payments/mask';
import {
  TossApiError,
  getPayment as tossGetPayment,
  type TossGetPaymentResponse,
} from '@/lib/payments/tossClient';
import { verifyDepositSecret } from '@/lib/payments/webhookVerify';
import {
  applyWebhookEventRpc,
  findOrderWithPaymentByOrderNumber,
} from '@/lib/repositories/paymentRepo';
import { sendOrderConfirmationEmail } from '@/lib/email/notifications';
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
 * - PARTIAL_CANCELED: 해당 취소 트랜잭션 금액 (012 `apply_webhook_event` 가 `abs` 처리).
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
 * 1) Toss GET 재조회 (권위) — 4xx 는 auth_failed, 네트워크는 throw(500 유도).
 * 2) `findOrderWithPaymentByOrderNumber` 단일 쿼리로 orders + payments 조회.
 *    payments 행 없음 = 타이밍 역전 (confirm 전에 웹훅 도착) → 503.
 * 3) 총액 교차검증 — order.total_amount !== authoritative.totalAmount → 401 위조.
 *    (Toss 스펙상 totalAmount 는 원 승인 금액으로 부분취소 후에도 불변.)
 * 4) 멱등 키 합성 → apply_webhook_event RPC (rawPayload 는 마스킹 후 저장).
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
    /* TossNetworkError · 기타 예외는 재시도 유도(500)를 위해 그대로 throw. */
    throw err;
  }

  /* payload 와 Toss 응답의 orderId 일치 확인 — 위조 방어 */
  if (authoritative.orderId !== payload.data.orderId) {
    return { kind: 'auth_failed', detail: 'order_id_mismatch' };
  }

  /* 2) DB 단일 쿼리 — orders + payments 동시 조회 (H-4) */
  const combo = await findOrderWithPaymentByOrderNumber(payload.data.orderId);
  if (!combo) {
    return { kind: 'bad_request', detail: 'order_not_found' };
  }
  if (!combo.payment) {
    /* §5.3.1 — pending 상태에서 웹훅이 confirm 보다 먼저 도착. */
    return { kind: 'timing_inversion', detail: 'payment_row_missing' };
  }

  /* 3) 총액 교차검증 */
  if (combo.order.total_amount !== authoritative.totalAmount) {
    return { kind: 'auth_failed', detail: 'amount_mismatch' };
  }

  /* 4) 멱등 키 합성 + RPC (rawPayload 는 PII 마스킹) */
  const eventType = mapCardStatus(authoritative.status);
  const amount = pickCardAmount(authoritative);
  const idempotencyKey = buildCardIdempotencyKey(payload, authoritative);

  try {
    await applyWebhookEventRpc({
      orderId: combo.order.id,
      eventType,
      amount,
      rawPayload: maskTossPayload({ payload, authoritative }),
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
 * 1) orders + payments 동시 조회. 없거나 webhook_secret 없음 → 503 타이밍 역전.
 * 2) timing-safe 비교 → 불일치 401.
 * 3) event_type 매핑 + 멱등 키 → RPC (rawPayload 는 마스킹).
 */
export async function handleVirtualAccountWebhook(
  payload: DepositWebhookPayload,
): Promise<WebhookResult> {
  /* 1) orders + payments 단일 쿼리 */
  const combo = await findOrderWithPaymentByOrderNumber(payload.data.orderId);
  if (!combo) {
    return { kind: 'bad_request', detail: 'order_not_found' };
  }
  if (!combo.payment || !combo.payment.webhook_secret) {
    return { kind: 'timing_inversion', detail: 'webhook_secret_unavailable' };
  }

  /* 2) timing-safe 비교 */
  if (!verifyDepositSecret(payload.secret, combo.payment.webhook_secret)) {
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
  const amount = combo.payment.approved_amount;

  try {
    await applyWebhookEventRpc({
      orderId: combo.payment.order_id,
      eventType,
      amount,
      rawPayload: maskTossPayload(payload),
      idempotencyKey,
    });

    /* Session 8-B B-1: 가상계좌 입금 확정 시 입금 완료 알림 메일 (fire-and-forget).
       - 조건: DONE 에 매핑된 `payment_approved` 이벤트만 발송 (취소/만료 제외).
       - 중복 발송 방어: sendEmail idempotencyKey `order-paid:{orderNumber}` 로 분리.
         Resend 측 키 유효기간 내 재시도는 no-op. */
    if (eventType === 'payment_approved') {
      void sendOrderConfirmationEmail(
        payload.data.orderId,
        null,
        { depositCompleted: true },
      );
    }

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
