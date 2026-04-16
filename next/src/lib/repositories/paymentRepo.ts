/* ══════════════════════════════════════════════════════════════════════════
   paymentRepo.ts — 결제 저장/조회 Repository (P2-B Session 4 B-3)

   역할:
   - Supabase 쿼리만 담당. 비즈 로직(Toss 호출·교차검증) 은 paymentService.
   - 모든 write 경로는 012 마이그레이션의 SECURITY DEFINER RPC 를 경유.
     (payments 테이블 RLS = service_role 전용, authenticated 직접 UPDATE 금지)

   참조:
   - supabase/migrations/012_payments_hardening.sql (payments · confirm_payment RPC)
   - supabase/migrations/003_orders.sql (orders 스키마 · order_number 포맷)
   - docs/payments-flow.md §3.1 · §4.3
   ══════════════════════════════════════════════════════════════════════════ */

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import type {
  DbOrderStatus,
  DbPaymentEventType,
  DbPaymentMethod,
  DbPaymentStatus,
} from '@/types/db';

/* ══════════════════════════════════════════
   orders — confirm 전 소유·상태 조회
   ══════════════════════════════════════════ */

export type OrderForConfirm = {
  id: string;
  order_number: string;
  user_id: string | null;
  guest_email: string | null;
  contact_email: string;
  status: DbOrderStatus;
  payment_method: DbPaymentMethod;
  total_amount: number;
};

/**
 * `orders.order_number` 기준 confirm 흐름에 필요한 최소 필드 조회.
 * service_role 로 RLS 우회 — 소유/상태 판단은 호출자(paymentService) 책임.
 *
 * @returns null = 레코드 없음 / OrderForConfirm 조회 성공
 * @throws 네트워크/DB 오류 시 Supabase PostgrestError
 */
export async function findOrderForConfirm(
  orderNumber: string,
): Promise<OrderForConfirm | null> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from('orders')
    .select(
      'id, order_number, user_id, guest_email, contact_email, status, payment_method, total_amount',
    )
    .eq('order_number', orderNumber)
    .maybeSingle<OrderForConfirm>();

  if (error) throw error;
  return data ?? null;
}

/* ══════════════════════════════════════════
   payments — 조회
   ══════════════════════════════════════════ */

export type PaymentRow = {
  id: string;
  order_id: string;
  payment_key: string | null;
  method: DbPaymentMethod;
  webhook_secret: string | null;
  approved_amount: number;
  refunded_amount: number;
  balance_amount: number;
  status: DbPaymentStatus;
  approved_at: string | null;
};

/**
 * order_id 기준 payments 레코드 조회. 멱등 경로(이미 paid 상태)에서
 * 기존 결제 정보를 응답 payload 로 돌려주기 위해 사용.
 */
export async function findPaymentByOrderId(
  orderId: string,
): Promise<PaymentRow | null> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from('payments')
    .select(
      'id, order_id, payment_key, method, webhook_secret, approved_amount, refunded_amount, balance_amount, status, approved_at',
    )
    .eq('order_id', orderId)
    .maybeSingle<PaymentRow>();

  if (error) throw error;
  return data ?? null;
}

/**
 * `orders.order_number` 기준 payments 레코드 + 소속 order 식별자 동시 조회.
 *
 * 용도 — 웹훅(§3.2):
 * - Toss 웹훅 페이로드의 `data.orderId` 는 우리가 발행한 `order_number` (예 `GT-20260416-00001`).
 * - RPC (`apply_webhook_event`) 는 UUID 형태의 `orders.id` 를 요구하므로
 *   orders 를 한 번 조회해 UUID + webhook_secret 을 함께 얻는다.
 * - 카드 경로는 `webhook_secret` 을 사용하지 않지만 총액/상태는 GET 재조회로 대체.
 * - 가상계좌 경로에서 `webhook_secret` 을 timing-safe 비교.
 *
 * @returns null = 주문 또는 payments 레코드 없음
 */
export async function findPaymentByOrderNumber(
  orderNumber: string,
): Promise<PaymentRow | null> {
  const admin = getSupabaseAdmin();

  /* orders → payments (1:1) 조인. payments 가 없으면 inner join 결과 비어있음. */
  const { data, error } = await admin
    .from('orders')
    .select(
      `
      id,
      payments:payments!inner (
        id,
        order_id,
        payment_key,
        method,
        webhook_secret,
        approved_amount,
        refunded_amount,
        balance_amount,
        status,
        approved_at
      )
      `,
    )
    .eq('order_number', orderNumber)
    .maybeSingle<{ id: string; payments: PaymentRow | PaymentRow[] | null }>();

  if (error) throw error;
  if (!data) return null;

  /* Supabase 는 1:1 관계도 상황에 따라 배열로 반환할 수 있어 양쪽 모두 처리. */
  const payment = Array.isArray(data.payments) ? data.payments[0] : data.payments;
  return payment ?? null;
}

/* ══════════════════════════════════════════
   apply_webhook_event RPC — 웹훅 멱등 커밋
   ══════════════════════════════════════════ */

export type ApplyWebhookEventRpcParams = {
  /** orders.id (UUID). webhook 페이로드의 order_number 를 한 번 더 조회해 얻는다. */
  orderId: string;
  eventType: DbPaymentEventType;
  /**
   * payment_transactions 에 기록될 금액.
   * - 카드 DONE: 총 승인 금액
   * - 카드 PARTIAL_CANCELED: 해당 취소 트랜잭션 금액
   * - 가상계좌 DONE: 입금 금액
   * - refund_*: 환불 금액
   */
  amount: number;
  rawPayload: unknown;
  idempotencyKey: string;
};

/**
 * 012 `apply_webhook_event(...)` RPC 호출.
 * - payment_transactions INSERT (UNIQUE(idempotency_key) → 23505 on duplicate).
 * - eventType 에 따라 payments.status / orders.status 상태 전이.
 * - `webhook_received` 는 감사 로그 용도 (상태 전이 없음).
 *
 * 에러 전략:
 * - 23505 (unique_violation) 는 **호출자(webhookService) 가 삼킴** → 200 응답.
 * - 그 외 PostgrestError 는 throw → route 에서 500.
 *
 * @throws PostgrestError (unique_violation 포함 — 분기는 호출자 책임)
 */
export async function applyWebhookEventRpc(
  params: ApplyWebhookEventRpcParams,
): Promise<void> {
  const admin = getSupabaseAdmin();

  const { error } = await admin.rpc('apply_webhook_event', {
    p_order_id: params.orderId,
    p_event_type: params.eventType,
    p_amount: params.amount,
    p_raw: params.rawPayload,
    p_idempotency_key: params.idempotencyKey,
  });

  if (error) throw error;
}

/* ══════════════════════════════════════════
   confirm_payment RPC — 원자 커밋
   ══════════════════════════════════════════ */

export type ConfirmPaymentRpcParams = {
  orderId: string; // orders.id (UUID)
  paymentKey: string;
  method: DbPaymentMethod;
  /** 가상계좌(transfer) 만 not null. 카드(card) 는 null. */
  webhookSecret: string | null;
  approvedAmount: number;
  approvedAt: string; // ISO 8601
  rawResponse: unknown; // Toss confirm 응답 원본
};

export type ConfirmPaymentRpcResult = {
  orderNumber: string;
  status: DbOrderStatus; // 정상 커밋 = 'paid' / 멱등 = 기존 status
};

/**
 * 012 `confirm_payment(...)` RPC 호출.
 * - SELECT FOR UPDATE 로 동시 confirm 직렬화.
 * - 이미 paid 이면 현재 상태 멱등 반환.
 * - pending 이 아닌 상태에서 호출 시 `check_violation` (42000대) 예외.
 *
 * @throws PostgrestError (no_data_found · check_violation · 23505 등)
 */
export async function confirmPaymentRpc(
  params: ConfirmPaymentRpcParams,
): Promise<ConfirmPaymentRpcResult> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .rpc('confirm_payment', {
      p_order_id: params.orderId,
      p_payment_key: params.paymentKey,
      p_method: params.method,
      p_webhook_secret: params.webhookSecret,
      p_approved_amount: params.approvedAmount,
      p_approved_at: params.approvedAt,
      p_raw: params.rawResponse,
    })
    .single<{ order_number: string; status: DbOrderStatus }>();

  if (error) throw error;
  if (!data) throw new Error('confirm_payment_rpc_empty_result');

  return {
    orderNumber: data.order_number,
    status: data.status,
  };
}
