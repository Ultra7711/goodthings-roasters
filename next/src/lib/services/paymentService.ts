/* ══════════════════════════════════════════════════════════════════════════
   paymentService.ts — 결제 비즈 로직 (P2-B Session 4 B-3 · Session 6 폴리시)

   역할:
   - confirm 플로우의 3중 멱등 방어 중 "레이어 1 · 레이어 3" 책임.
     (레이어 2 = 012 confirm_payment RPC 의 SELECT FOR UPDATE + 멱등 RETURN)
   - Toss 호출 전 pre-check → Toss 호출 → RPC 원자 커밋.
   - 소유/상태/금액 위반은 도메인 에러로 격상 (route handler 가 HTTP 로 매핑).

   원칙:
   - Response / NextRequest 객체를 알지 못한다 (route handler 책임).
   - Toss 호출은 tossClient 에 위임 (재시도·timeout·base64 인증).
   - payment_transactions INSERT 는 RPC 내부에서 처리 — 서비스는 RPC 호출만.

   Session 6 변경:
   - security H-1: 게스트 소유권 교차검증 (options.guestEmail ↔ orders.guest_email).
     실제 방어 대상은 MitM 이 아니라 "레퍼러 누출/공유 링크로 유출된 successUrl 의
     30초 재조회" 윈도우. 토스 공식이나 국내 커머스 표준에는 포함되지 않는 추가
     방어층이며, 비용 대비 가치 중립 — 제거해도 무방하나 저비용이라 유지.
   - code H-3: `mapTossMethod` 를 단일 상수 테이블로 좁혀 오매핑 방지.
   - code H-4: 135-라인 confirmOrder 를 단계별 보조 함수로 분리.
   - C-3: RPC 로 전달하는 `rawResponse` 는 `maskTossPayload` 적용 (PCI DSS 3.4.1).

   Session 6 폴리시(리서치 기반 재조정):
   - M-3: `approvedAt` 누락 시 throw 대신 서버 now() fallback + `console.warn`
     + `rawResponse._fallback.approved_at=true` 플래그. 이유: DONE 상태에서
     approvedAt 누락은 실제로 0% 에 가까우며, throw 시 오탐으로 인한 정상 결제
     실패 피해가 감사 정확도 이득을 초과.
   - H-3 (Toss 웹훅 IP allowlist 추가 제안): 공식 IP CIDR 미공개 + ADR-002
     하이브리드 인증으로 이미 무력화 → 도입 금지.

   참조:
   - docs/payments-flow.md §3.1 (스펙) · §3.1.3 (3중 방어) · §4.3 (RPC)
   - docs/security-research-2026-04-16.md (A/B/C 3자 리서치 종합)
   - docs/backend-architecture-plan.md §7.2 (레이어 분리)
   ══════════════════════════════════════════════════════════════════════════ */

import { isPgUniqueViolation } from '@/lib/payments/idempotency';
import { maskTossPayload } from '@/lib/payments/mask';
import { logPaymentEvent, maskPaymentKey } from '@/lib/logging/paymentLogger';
import {
  confirmPayment as tossConfirmPayment,
  TossApiError,
  TossNetworkError,
  type TossConfirmResponse,
} from '@/lib/payments/tossClient';
import {
  confirmPaymentRpc,
  findOrderForConfirm,
  findPaymentByOrderId,
  type OrderForConfirm,
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
  /**
   * Session 11 보안 #3-4a: 고객 대면 UUID v4.
   * confirm API 응답 → 클라이언트가 `/order-complete?token=...` 으로 deep-link,
   * 이메일 CTA 링크 생성 경로에도 그대로 전달.
   */
  publicToken: string;
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
   내부 유틸 — method 매핑 (code H-3)
   ══════════════════════════════════════════ */

/**
 * Toss `method` 응답 → DB `payment_method` enum 단일 매핑 테이블.
 *
 * Toss 가 한글(`카드`/`가상계좌`/`계좌이체`) 또는 영어 토큰(`CARD`/`VIRTUAL_ACCOUNT`/
 * `TRANSFER`/`card`) 를 섞어 반환할 수 있어 모두 열거한다. 여기에 없는 수단
 * (간편결제·휴대폰·문화상품권 등) 은 MVP 범위 밖 → `method_mismatch` 로 거부.
 */
const TOSS_METHOD_TABLE: Readonly<Record<string, DbPaymentMethod>> = {
  카드: 'card',
  CARD: 'card',
  card: 'card',
  가상계좌: 'transfer',
  계좌이체: 'transfer',
  VIRTUAL_ACCOUNT: 'transfer',
  TRANSFER: 'transfer',
};

function mapTossMethod(method: string | undefined): DbPaymentMethod | null {
  if (!method) return null;
  return TOSS_METHOD_TABLE[method] ?? null;
}

/* ══════════════════════════════════════════
   내부 유틸 — 결과 조립
   ══════════════════════════════════════════ */

/**
 * 멱등 경로(이미 paid) · 정상 커밋 후 공통 응답 조립.
 * payments 레코드가 없는 경우(= pending 상태의 멱등 조회) 는 method=card 기본값.
 */
function buildResultFromExisting(
  orderNumber: string,
  publicToken: string,
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
    publicToken,
    status,
    totalAmount,
    method,
    virtualAccount: va,
  };
}

/* ══════════════════════════════════════════
   내부 유틸 — 단계별 보조 함수 (code H-4 분리)
   ══════════════════════════════════════════ */

/**
 * 소유권 교차검증.
 * - 회원: `orders.user_id === options.userId`
 * - 게스트: `orders.user_id === null` AND `orders.guest_email === input.guestEmail`
 *
 * guestEmail 은 옵션으로 보냈어도(하위호환) DB 값이 존재하면 반드시 일치해야
 * 한다. 대소문자 차이로 인한 오탐 방지를 위해 로컬 비교는 소문자 정규화.
 */
function assertOwnership(
  order: OrderForConfirm,
  options: ConfirmOptions,
  guestEmail: string | undefined,
): void {
  if (options.userId) {
    if (order.user_id !== options.userId) {
      throw new PaymentServiceError('forbidden', 'not_owner');
    }
    return;
  }

  /* 게스트 플로우: user_id 가 null 이어야 한다. */
  if (order.user_id !== null) {
    throw new PaymentServiceError('forbidden', 'guest_cannot_confirm_member_order');
  }

  /* guest_email 교차검증 (security H-1).
     - DB 값이 있으면 클라이언트가 반드시 같은 이메일을 보내야 한다.
     - DB 값이 없는 레거시 주문은 스킵 허용 (방어적 — 하지만 신규 주문 경로에서는
       체크아웃이 항상 guest_email 을 저장하므로 사실상 모든 주문이 검증된다).

     실제 방어 대상 (2026-04-16 리서치 기반 재평가):
       MitM 이 아니라 "레퍼러 누출 · 공유 링크로 유출된 successUrl 의 30초 재조회"
       윈도우. 토스 공식/국내 커머스 표준에 포함되지 않는 추가 방어층이지만 비용이
       낮아 유지. 제거해도 무방. 상세: docs/security-research-2026-04-16.md §2.1 */
  const dbEmail = order.guest_email?.trim().toLowerCase() ?? null;
  if (dbEmail) {
    const sent = guestEmail?.trim().toLowerCase();
    if (!sent || sent !== dbEmail) {
      throw new PaymentServiceError('forbidden', 'guest_email_mismatch');
    }
  }
}

/**
 * 상태·금액 교차검증 + 이미 paid 인 경우 멱등 응답 조기 반환.
 * @returns 멱등 응답 (이미 paid) / null (pending → 다음 단계 진행)
 */
async function handleStateAndAmount(
  order: OrderForConfirm,
  input: PaymentConfirmInput,
): Promise<ConfirmResult | null> {
  if (order.status === 'paid') {
    const existing = await findPaymentByOrderId(order.id);
    return buildResultFromExisting(
      order.order_number,
      order.public_token,
      order.status,
      order.total_amount,
      existing,
    );
  }
  if (order.status !== 'pending') {
    throw new PaymentServiceError('state_conflict', order.status);
  }

  if (order.total_amount !== input.amount) {
    throw new PaymentServiceError('amount_mismatch');
  }
  return null;
}

/**
 * Toss confirm 호출 + `ALREADY_PROCESSED_PAYMENT` 레이스 복구.
 * - 4xx → `toss_failed`
 * - Network/5xx → `toss_unavailable`
 *
 * @returns `{ kind: 'response', value }` 또는 `{ kind: 'idempotent', value }`.
 *   후자는 동시 요청이 먼저 RPC 까지 끝낸 케이스로 멱등 응답 그대로 반환해야 한다.
 */
async function callToss(
  input: PaymentConfirmInput,
): Promise<
  | { kind: 'response'; value: TossConfirmResponse }
  | { kind: 'idempotent'; value: ConfirmResult }
> {
  try {
    const value = await tossConfirmPayment({
      paymentKey: input.paymentKey,
      orderId: input.orderId,
      amount: input.amount,
    });
    return { kind: 'response', value };
  } catch (err) {
    if (err instanceof TossApiError) {
      if (err.code === 'ALREADY_PROCESSED_PAYMENT') {
        const recheck = await findOrderForConfirm(input.orderId);
        if (recheck?.status === 'paid') {
          const existing = await findPaymentByOrderId(recheck.id);
          return {
            kind: 'idempotent',
            value: buildResultFromExisting(
              recheck.order_number,
              recheck.public_token,
              recheck.status,
              recheck.total_amount,
              existing,
            ),
          };
        }
      }
      throw new PaymentServiceError('toss_failed', err.code);
    }
    if (err instanceof TossNetworkError) {
      throw new PaymentServiceError('toss_unavailable');
    }
    throw err;
  }
}

/**
 * Toss 응답 → RPC 파라미터 조립. method 일치·webhook_secret 검증 포함.
 *
 * M-3 (Session 6 리서치 기반 재조정):
 *   - 과거: `approvedAt` 누락 시 `toss_failed(approved_at_missing)` throw.
 *     → 정당한 결제를 오탐으로 실패시킬 위험이 감사 정확도 이득보다 큼.
 *   - 현재: 누락 시 서버 `now()` 로 대체 + `console.warn` + `approvedAtFallback=true`
 *     플래그 반환. 호출부에서 rawResponse 에 `_fallback.approved_at=true` 기록해
 *     감사 추적성 유지. DONE 상태에서 approvedAt 누락은 실질적으로 0% 에 가깝다.
 */
function deriveRpcParams(
  order: OrderForConfirm,
  tossResponse: TossConfirmResponse,
): {
  method: DbPaymentMethod;
  webhookSecret: string | null;
  approvedAt: string;
  approvedAtFallback: boolean;
} {
  const method = mapTossMethod(tossResponse.method);
  if (!method) {
    throw new PaymentServiceError('method_mismatch', tossResponse.method ?? 'unknown');
  }
  if (method !== order.payment_method) {
    throw new PaymentServiceError(
      'method_mismatch',
      `expected=${order.payment_method},actual=${method}`,
    );
  }

  const webhookSecret =
    method === 'transfer' ? (tossResponse.virtualAccount?.secret ?? null) : null;
  if (method === 'transfer' && !webhookSecret) {
    throw new PaymentServiceError('toss_failed', 'virtual_account_secret_missing');
  }

  let approvedAt = tossResponse.approvedAt;
  let approvedAtFallback = false;
  if (!approvedAt) {
    approvedAt = new Date().toISOString();
    approvedAtFallback = true;
    /* Session 8 보안 #4: paymentKey 평문 금지 → maskPaymentKey 로 치환. */
    logPaymentEvent('warn', 'approved_at_fallback', {
      orderId: order.id,
      paymentKeyMasked: maskPaymentKey(tossResponse.paymentKey),
      fallbackApprovedAt: approvedAt,
    });
  }

  return { method, webhookSecret, approvedAt, approvedAtFallback };
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
 *   2) 소유권 검사: 회원 user_id · 게스트 guest_email 교차검증
 *   3) 상태·금액 검사: 이미 paid → 멱등 응답 / pending 만 진행
 *   4) Toss confirm 호출
 *   5) Toss method ↔ orders.payment_method 일치 + approvedAt 존재 확인
 *   6) confirm_payment RPC — 원자 커밋 (이미 paid 면 RPC 가 멱등 반환)
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

  /* 2) 소유권 검사 (회원·게스트 분기) */
  assertOwnership(order, options, input.guestEmail);

  /* 3) 상태·금액 검사 (멱등 paid 조기 반환) */
  const idempotent = await handleStateAndAmount(order, input);
  if (idempotent) return idempotent;

  /* 4) Toss confirm 호출 */
  const toss = await callToss(input);
  if (toss.kind === 'idempotent') return toss.value;
  const tossResponse = toss.value;

  /* 5) method / webhook_secret / approvedAt 검증 */
  const { method, webhookSecret, approvedAt, approvedAtFallback } = deriveRpcParams(
    order,
    tossResponse,
  );

  /* 6) RPC — 원자 커밋. rawResponse 는 C-3 마스킹 후 저장.
     approvedAt fallback 발생 시 `_fallback.approved_at=true` 플래그로 감사 추적성 유지. */
  const maskedResponse = maskTossPayload(tossResponse);
  const rawResponseForRpc =
    approvedAtFallback && maskedResponse !== null && typeof maskedResponse === 'object'
      ? { ...(maskedResponse as Record<string, unknown>), _fallback: { approved_at: true } }
      : maskedResponse;

  try {
    const rpcResult = await confirmPaymentRpc({
      orderId: order.id,
      paymentKey: tossResponse.paymentKey,
      method,
      webhookSecret,
      approvedAmount: tossResponse.totalAmount,
      approvedAt,
      rawResponse: rawResponseForRpc,
    });

    const payment = await findPaymentByOrderId(order.id);
    return buildResultFromExisting(
      rpcResult.orderNumber,
      order.public_token,
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
          recheck.public_token,
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
