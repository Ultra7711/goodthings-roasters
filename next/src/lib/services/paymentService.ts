/* ══════════════════════════════════════════════════════════════════════════
   paymentService.ts — 결제 비즈 로직 (P2-B Session 4 B-3)

   역할:
   - confirm 플로우의 3중 멱등 방어 중 "레이어 1 · 레이어 3" 책임.
     (레이어 2 = 012 confirm_payment RPC 의 SELECT FOR UPDATE + 멱등 RETURN)
   - Toss 호출 전 pre-check → Toss 호출 → RPC 원자 커밋.
   - 소유/상태/금액 위반은 도메인 에러로 격상 (route handler 가 HTTP 로 매핑).

   원칙:
   - Response / NextRequest 객체를 알지 못한다 (route handler 책임).
   - Toss 호출은 tossClient 에 위임 (재시도·timeout·base64 인증).
   - payment_transactions INSERT 는 RPC 내부에서 처리 — 서비스는 RPC 호출만.

   참조:
   - docs/payments-flow.md §3.1 (스펙) · §3.1.3 (3중 방어) · §4.3 (RPC)
   - docs/backend-architecture-plan.md §7.2 (레이어 분리)
   ══════════════════════════════════════════════════════════════════════════ */

import {
  confirmPayment as tossConfirmPayment,
  TossApiError,
  TossNetworkError,
  type TossConfirmResponse,
} from '@/lib/payments/tossClient';
import { isPgUniqueViolation } from '@/lib/payments/idempotency';
import {
  findOrderForConfirm,
  findPaymentByOrderId,
  confirmPaymentRpc,
  type PaymentRow,
} from '@/lib/repositories/paymentRepo';
import type { PaymentConfirmInput } from '@/lib/schemas/payment';
import type { DbOrderStatus, DbPaymentMethod } from '@/types/db';

/* ══════════════════════════════════════════
   에러 — 도메인 레벨
   ══════════════════════════════════════════ */

/**
 * Confirm 플로우 도메인 에러.
 * Route Handler 에서 code 로 분기 → apiError 매핑.
 */
export class PaymentServiceError extends Error {
  readonly code: PaymentServiceErrorCode;
  readonly detail?: string;

  constructor(code: PaymentServiceErrorCode, detail?: string) {
    super(code);
    this.name = 'PaymentServiceError';
    this.code = code;
    this.detail = detail;
  }
}

export type PaymentServiceErrorCode =
  | 'not_found'
  | 'forbidden'
  | 'state_conflict'
  | 'amount_mismatch'
  | 'toss_failed'       // Toss 4xx (카드 거부 등)
  | 'toss_unavailable'  // 네트워크·5xx 재시도 후 실패
  | 'method_mismatch';  // orders.payment_method 와 Toss 실제 method 불일치

/* ══════════════════════════════════════════
   결과 타입
   ══════════════════════════════════════════ */

export type ConfirmResult = {
  orderNumber: string;
  status: DbOrderStatus; // 정상 = 'paid', 멱등 = 기존 상태
  totalAmount: number;
  method: DbPaymentMethod;
  /** 가상계좌인 경우 사용자에게 계좌번호 안내. 카드는 null. */
  virtualAccount: {
    bank: string | null;
    accountNumber: string;
    dueDate: string | null;
    customerName: string | null;
  } | null;
};

/* ══════════════════════════════════════════
   내부 유틸
   ══════════════════════════════════════════ */

/**
 * Toss 응답의 `method` 문자열(한글)을 DB payment_method enum 에 매핑.
 * - '카드' → 'card'
 * - '가상계좌' → 'transfer'
 * - '계좌이체' → 'transfer'
 *
 * 기타 수단(간편결제·휴대폰 등)은 MVP 범위 밖 — method_mismatch 로 거부.
 */
function mapTossMethod(method: string | undefined): DbPaymentMethod | null {
  if (!method) return null;
  if (method === '카드' || method === 'CARD' || method === 'card') return 'card';
  if (method === '가상계좌' || method === '계좌이체' || method === 'VIRTUAL_ACCOUNT' || method === 'TRANSFER') {
    return 'transfer';
  }
  return null;
}

/**
 * 멱등 경로(이미 paid) 에서 응답 payload 조립.
 * payments 레코드가 반드시 존재 (confirm RPC 가 upsert 완료 상태).
 */
function buildResultFromExisting(
  orderNumber: string,
  status: DbOrderStatus,
  totalAmount: number,
  payment: PaymentRow | null,
  virtualAccountFromToss?: TossConfirmResponse['virtualAccount'] | null,
): ConfirmResult {
  const method: DbPaymentMethod = payment?.method ?? 'card';
  const va =
    method === 'transfer' && virtualAccountFromToss
      ? {
          bank: virtualAccountFromToss.bank ?? null,
          accountNumber: virtualAccountFromToss.accountNumber,
          dueDate: virtualAccountFromToss.dueDate ?? null,
          customerName: virtualAccountFromToss.customerName ?? null,
        }
      : null;

  return {
    orderNumber,
    status,
    totalAmount,
    method,
    virtualAccount: va,
  };
}

/* ══════════════════════════════════════════
   confirm 플로우
   ══════════════════════════════════════════ */

export type ConfirmOptions = {
  /** 로그인 사용자 id. 게스트면 null. */
  userId: string | null;
};

/**
 * payments-flow §3.1 confirm 플로우.
 *
 * 처리 순서:
 *   1) orders 조회 (order_number 기준)
 *   2) 소유권 검사: 회원 → user_id 일치, 게스트 → user_id == null
 *   3) 상태 검사: 이미 paid 면 기존 payments 로 멱등 응답 / pending 만 진행
 *   4) 금액 교차 검증: orders.total_amount === input.amount
 *   5) Toss confirm 호출
 *   6) Toss 응답의 method ↔ orders.payment_method 일치 확인
 *   7) confirm_payment RPC — 원자 커밋 (이미 paid 면 RPC 가 멱등 반환)
 *
 * 레이어 3 (23505 UNIQUE) 은 `payment_transactions.idempotency_key` 에서
 * 트리거되며, RPC 가 throw 한 PostgrestError 를 여기서 catch → 멱등 응답 변환.
 */
export async function confirmOrder(
  input: PaymentConfirmInput,
  options: ConfirmOptions,
): Promise<ConfirmResult> {
  /* 1) orders 조회 */
  const order = await findOrderForConfirm(input.orderId);
  if (!order) {
    throw new PaymentServiceError('not_found');
  }

  /* 2) 소유권 검사 */
  if (options.userId) {
    if (order.user_id !== options.userId) {
      throw new PaymentServiceError('forbidden', 'not_owner');
    }
  } else {
    /* 게스트 플로우: user_id 가 null 이어야 한다.
       회원 주문을 비로그인 상태에서 confirm 시도하는 것은 차단. */
    if (order.user_id !== null) {
      throw new PaymentServiceError('forbidden', 'guest_cannot_confirm_member_order');
    }
  }

  /* 3) 상태 검사 — 레이어 1 핵심 (§3.1.3) */
  if (order.status === 'paid') {
    const existing = await findPaymentByOrderId(order.id);
    return buildResultFromExisting(
      order.order_number,
      order.status,
      order.total_amount,
      existing,
    );
  }
  if (order.status !== 'pending') {
    throw new PaymentServiceError('state_conflict', order.status);
  }

  /* 4) 금액 교차 검증 — Toss 호출 전 (돈이 움직이기 전) */
  if (order.total_amount !== input.amount) {
    throw new PaymentServiceError('amount_mismatch');
  }

  /* 5) Toss confirm 호출 */
  let tossResponse: TossConfirmResponse;
  try {
    tossResponse = await tossConfirmPayment({
      paymentKey: input.paymentKey,
      orderId: input.orderId,
      amount: input.amount,
    });
  } catch (err) {
    if (err instanceof TossApiError) {
      /* Toss 가 `ALREADY_PROCESSED_PAYMENT` 를 반환하는 엣지:
         레이어 1 이 order.status='pending' 을 읽은 직후 동시 호출이 이미 RPC 까지
         완료했을 수 있음 → 재조회해서 paid 이면 멱등 응답. */
      if (err.code === 'ALREADY_PROCESSED_PAYMENT') {
        const recheck = await findOrderForConfirm(input.orderId);
        if (recheck?.status === 'paid') {
          const existing = await findPaymentByOrderId(recheck.id);
          return buildResultFromExisting(
            recheck.order_number,
            recheck.status,
            recheck.total_amount,
            existing,
          );
        }
      }
      throw new PaymentServiceError('toss_failed', err.code);
    }
    if (err instanceof TossNetworkError) {
      throw new PaymentServiceError('toss_unavailable');
    }
    throw err;
  }

  /* 6) method 매핑 + 일치 확인 */
  const tossMethod = mapTossMethod(tossResponse.method);
  if (!tossMethod) {
    throw new PaymentServiceError('method_mismatch', tossResponse.method ?? 'unknown');
  }
  if (tossMethod !== order.payment_method) {
    throw new PaymentServiceError('method_mismatch',
      `expected=${order.payment_method},actual=${tossMethod}`);
  }

  /* 7) RPC — 원자 커밋
     가상계좌 webhook_secret 은 Toss 응답의 virtualAccount.secret 에서 추출.
     카드는 null. */
  const webhookSecret =
    tossMethod === 'transfer'
      ? tossResponse.virtualAccount?.secret ?? null
      : null;

  /* 가상계좌인데 secret 누락 = Toss 스펙 위반. 저장 거부. */
  if (tossMethod === 'transfer' && !webhookSecret) {
    throw new PaymentServiceError('toss_failed', 'virtual_account_secret_missing');
  }

  try {
    const rpcResult = await confirmPaymentRpc({
      orderId: order.id,
      paymentKey: tossResponse.paymentKey,
      method: tossMethod,
      webhookSecret,
      approvedAmount: tossResponse.totalAmount,
      approvedAt: tossResponse.approvedAt ?? new Date().toISOString(),
      rawResponse: tossResponse as unknown,
    });

    const payment = await findPaymentByOrderId(order.id);
    return buildResultFromExisting(
      rpcResult.orderNumber,
      rpcResult.status,
      order.total_amount,
      payment,
      tossResponse.virtualAccount,
    );
  } catch (err) {
    /* 레이어 3: idempotency_key UNIQUE 위반 → 동시 확정의 늦은 쪽
       → 현재 상태를 재조회해 멱등 응답 반환. */
    if (isPgUniqueViolation(err)) {
      const recheck = await findOrderForConfirm(input.orderId);
      if (recheck) {
        const existing = await findPaymentByOrderId(recheck.id);
        return buildResultFromExisting(
          recheck.order_number,
          recheck.status,
          recheck.total_amount,
          existing,
          tossResponse.virtualAccount,
        );
      }
    }
    throw err;
  }
}
