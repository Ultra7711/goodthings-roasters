/* ══════════════════════════════════════════════════════════════════════════
   schemas/webhook.ts — Toss 웹훅 페이로드 zod 스키마 (P2-B B-4)

   ⚠️ 권위 원칙 (ADR-002):
   - 카드 PAYMENT_STATUS_CHANGED 는 페이로드를 1차 신뢰하지 않음. status/amount 는
     `tossClient.getPayment()` 권위 재조회로 교차검증. 본 스키마는 "라우팅" 정도의
     최소 형태만 강제한다 (paymentKey · orderId 존재 여부).
   - 가상계좌 DEPOSIT_CALLBACK 은 top-level `secret` 을 DB 와 timing-safe 비교하므로
     해당 필드 존재 + 문자열 보장이 핵심.

   Unknown eventType:
   - `webhook_received` 감사 로그만 남기고 200 을 반환해야 Toss 가 재시도하지 않음.
   - 파싱 실패가 아니라 "알 수 없는 타입" 분기이므로 별도 스키마로 모델링.

   참조:
   - docs/payments-flow.md §3.2.1 페이로드 판별 · §3.2.2 · §3.2.3
   - docs/adr/ADR-002-payment-webhook-verification.md §3
   ══════════════════════════════════════════════════════════════════════════ */

import { z } from 'zod';

/* ── 공통 원시 타입 ─────────────────────────────────────────────────────── */

const OrderNumberSchema = z
  .string()
  .regex(/^GT-\d{8}-\d{5}$/, { message: 'invalid_order_number' });

const PaymentKeySchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9_-]+$/, { message: 'payment_key_invalid_chars' });

const NonEmptyString = z.string().min(1);

/* ── 카드 PAYMENT_STATUS_CHANGED ────────────────────────────────────────── */

/**
 * 카드 웹훅의 `data` 는 Toss Payment 객체 자체가 들어온다.
 * 본 스키마는 라우팅에 필요한 최소 필드 + 멱등 키 합성 필드만 명시한다.
 * 나머지 필드는 `passthrough` 로 허용 → 권위값은 GET 재조회로 다시 확보.
 */
const CardPaymentDataSchema = z
  .object({
    paymentKey: PaymentKeySchema,
    orderId: OrderNumberSchema,
    status: NonEmptyString,
    /** 멱등 키 합성 (§3.2.5). 일부 상태(READY 등)에서는 부재할 수 있어 optional. */
    lastTransactionKey: z.string().min(1).optional(),
  })
  .passthrough();

export const CardWebhookSchema = z
  .object({
    eventType: z.literal('PAYMENT_STATUS_CHANGED'),
    /** 이벤트 발생 시각 — ISO 8601 문자열. 폴백 멱등 키 합성에 사용. */
    createdAt: NonEmptyString,
    data: CardPaymentDataSchema,
  })
  .passthrough();

export type CardWebhookPayload = z.infer<typeof CardWebhookSchema>;

/* ── 가상계좌 DEPOSIT_CALLBACK ──────────────────────────────────────────── */

/**
 * DEPOSIT_CALLBACK 의 `data` 에는 `orderId`, `paymentStatus`, `virtualAccountInfo` 등.
 * `lastTransactionKey` · top-level `paymentKey` 부재 → 멱등 키는 orderId + status + createdAt.
 */
const DepositDataSchema = z
  .object({
    orderId: OrderNumberSchema,
    /** Toss 정의: WAITING_FOR_DEPOSIT | DONE | CANCELED | EXPIRED */
    paymentStatus: NonEmptyString,
  })
  .passthrough();

export const DepositWebhookSchema = z
  .object({
    eventType: z.literal('DEPOSIT_CALLBACK'),
    /** DB 저장값과 timing-safe 비교 (§3.2.3) */
    secret: NonEmptyString,
    createdAt: NonEmptyString,
    data: DepositDataSchema,
  })
  .passthrough();

export type DepositWebhookPayload = z.infer<typeof DepositWebhookSchema>;

/* ── Unknown eventType (감사 로그 전용) ──────────────────────────────────── */

/**
 * 미지 이벤트 — 파싱 실패(400) 와 구분. `eventType` 문자열이 존재하기만 하면
 * 나머지는 raw_payload 로 보존.
 */
export const UnknownWebhookSchema = z
  .object({
    eventType: NonEmptyString,
    createdAt: NonEmptyString.optional(),
  })
  .passthrough();

export type UnknownWebhookPayload = z.infer<typeof UnknownWebhookSchema>;

/* ── discriminatedUnion — 라우터 분기 ───────────────────────────────────── */

/**
 * Toss 웹훅 페이로드 전체 스키마.
 * eventType 기준 discriminated union → 파싱 후 `parsed.data.eventType` 으로 분기.
 *
 * 파싱 실패 시: 호출자가 `UnknownWebhookSchema` 로 재시도해 감사 로그 + 200.
 * 그마저도 실패하면 400 (eventType 자체가 문자열이 아님).
 */
export const KnownWebhookSchema = z.discriminatedUnion('eventType', [
  CardWebhookSchema,
  DepositWebhookSchema,
]);

export type KnownWebhookPayload = z.infer<typeof KnownWebhookSchema>;
