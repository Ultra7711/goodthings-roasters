/* ══════════════════════════════════════════════════════════════════════════
   webhookService.test.ts — Toss 웹훅 처리 단위 테스트 (P2-B B-4 · Session 6 폴리시)

   Session 6 변경:
   - `findPaymentByOrderNumber` + `findOrderForConfirm` 이원 쿼리 →
     `findOrderWithPaymentByOrderNumber` 단일 쿼리 (H-4) 에 맞춰 mock 재구성.

   커버리지:
   - mapCardStatus · mapDepositStatus (§3.2.4 매핑 테이블 전수)
   - handleCardWebhook
       · DONE 정상 경로 (apply_webhook_event RPC 호출 확인)
       · PARTIAL_CANCELED 다회 취소 (cancels[-1].transactionKey 로 멱등 키 생성)
       · 총액 불일치 → auth_failed
       · payments 레코드 없음 → timing_inversion
       · 23505 UNIQUE → ok (silent skip)
       · Toss 4xx → auth_failed
       · Toss 응답 orderId 불일치 → auth_failed
   - handleVirtualAccountWebhook
       · DONE 정상 경로
       · secret 불일치 → auth_failed
       · webhook_secret 없음 → timing_inversion
       · payments 행 없음 → timing_inversion
       · 23505 UNIQUE → ok
   - handleUnknownWebhook → ok (감사 로그만)

   Mock 전략: vi.mock 로 tossClient / paymentRepo 차단.
   ══════════════════════════════════════════════════════════════════════════ */

import { beforeEach, describe, expect, it, vi } from 'vitest';

/* ──────────────────────────────────────────────────────────────────────────
   Module mocks — 반드시 import 보다 먼저 선언해야 vi.mock 호이스팅 유효.
   ────────────────────────────────────────────────────────────────────────── */

vi.mock('@/lib/payments/tossClient', () => {
  class TossApiError extends Error {
    readonly kind = 'api' as const;
    readonly status: number;
    readonly code: string;
    constructor(status: number, code: string, message: string) {
      super(`Toss API ${status} ${code}: ${message}`);
      this.status = status;
      this.code = code;
    }
  }
  class TossNetworkError extends Error {
    readonly kind = 'network' as const;
    constructor(message: string) {
      super(message);
    }
  }
  return {
    TossApiError,
    TossNetworkError,
    getPayment: vi.fn(),
    confirmPayment: vi.fn(),
  };
});

vi.mock('@/lib/repositories/paymentRepo', () => ({
  applyWebhookEventRpc: vi.fn(),
  findOrderWithPaymentByOrderNumber: vi.fn(),
  findPaymentByOrderId: vi.fn(),
  findOrderForConfirm: vi.fn(),
  confirmPaymentRpc: vi.fn(),
}));

/* ──────────────────────────────────────────────────────────────────────────
   SUT + mocked modules import
   ────────────────────────────────────────────────────────────────────────── */

import {
  handleCardWebhook,
  handleUnknownWebhook,
  handleVirtualAccountWebhook,
  mapCardStatus,
  mapDepositStatus,
} from './webhookService';
import {
  getPayment as tossGetPayment,
  TossApiError,
  type TossGetPaymentResponse,
} from '@/lib/payments/tossClient';
import {
  applyWebhookEventRpc,
  findOrderWithPaymentByOrderNumber,
  type OrderWithPayment,
  type PaymentRow,
} from '@/lib/repositories/paymentRepo';
import type {
  CardWebhookPayload,
  DepositWebhookPayload,
  UnknownWebhookPayload,
} from '@/lib/schemas/webhook';

/* ──────────────────────────────────────────────────────────────────────────
   Fixtures
   ────────────────────────────────────────────────────────────────────────── */

const ORDER_NUMBER = 'GT-20260416-00001';
const ORDER_UUID = '11111111-2222-3333-4444-555555555555';
const PAYMENT_KEY = 'toss_test_payment_key_ABC123';
const TOTAL_AMOUNT = 28_000;
const WEBHOOK_SECRET = 'webhook_secret_abcdef_0123456789';

function makeOrderSlice(
  overrides: Partial<OrderWithPayment['order']> = {},
): OrderWithPayment['order'] {
  return {
    id: ORDER_UUID,
    order_number: ORDER_NUMBER,
    status: 'paid',
    payment_method: 'card',
    total_amount: TOTAL_AMOUNT,
    ...overrides,
  };
}

function makePayment(overrides: Partial<PaymentRow> = {}): PaymentRow {
  return {
    id: 'pay-uuid',
    order_id: ORDER_UUID,
    payment_key: PAYMENT_KEY,
    method: 'card',
    webhook_secret: null,
    approved_amount: TOTAL_AMOUNT,
    refunded_amount: 0,
    balance_amount: TOTAL_AMOUNT,
    status: 'approved',
    approved_at: '2026-04-16T01:00:00.000Z',
    easypay_provider: null,
    ...overrides,
  };
}

/** `findOrderWithPaymentByOrderNumber` 의 정상 응답 조립자. */
function makeCombo(
  orderOverrides: Partial<OrderWithPayment['order']> = {},
  payment: PaymentRow | null = makePayment(),
): OrderWithPayment {
  return {
    order: makeOrderSlice(orderOverrides),
    payment,
  };
}

function makeCardPayload(
  overrides: Partial<CardWebhookPayload['data']> = {},
): CardWebhookPayload {
  return {
    eventType: 'PAYMENT_STATUS_CHANGED',
    createdAt: '2026-04-16T01:02:03.000Z',
    data: {
      paymentKey: PAYMENT_KEY,
      orderId: ORDER_NUMBER,
      status: 'DONE',
      lastTransactionKey: 'tx_ABC',
      ...overrides,
    },
  };
}

function makeDepositPayload(
  overrides: Partial<DepositWebhookPayload['data']> = {},
  secret: string = WEBHOOK_SECRET,
): DepositWebhookPayload {
  return {
    eventType: 'DEPOSIT_CALLBACK',
    secret,
    createdAt: '2026-04-16T01:02:03.000Z',
    data: {
      orderId: ORDER_NUMBER,
      paymentStatus: 'DONE',
      ...overrides,
    },
  };
}

function makeTossGetResponse(
  overrides: Partial<TossGetPaymentResponse> = {},
): TossGetPaymentResponse {
  return {
    paymentKey: PAYMENT_KEY,
    orderId: ORDER_NUMBER,
    status: 'DONE',
    method: '카드',
    totalAmount: TOTAL_AMOUNT,
    approvedAt: '2026-04-16T01:00:05.000Z',
    lastTransactionKey: 'tx_ABC',
    ...overrides,
  };
}

/** PostgrestError 23505 (unique_violation) 를 흉내내는 에러 객체. */
function makeUniqueViolation(): Error & { code: string } {
  const err = new Error('duplicate key value violates unique constraint') as Error & {
    code: string;
  };
  err.code = '23505';
  return err;
}

/* ──────────────────────────────────────────────────────────────────────────
   Mock 리셋
   ────────────────────────────────────────────────────────────────────────── */

beforeEach(() => {
  vi.mocked(tossGetPayment).mockReset();
  vi.mocked(findOrderWithPaymentByOrderNumber).mockReset();
  vi.mocked(applyWebhookEventRpc).mockReset();
});

/* ══════════════════════════════════════════
   Pure mappers
   ══════════════════════════════════════════ */

describe('mapCardStatus — §3.2.4 매핑', () => {
  it('DONE → payment_approved', () => {
    expect(mapCardStatus('DONE')).toBe('payment_approved');
  });
  it('EXPIRED/ABORTED → payment_cancelled', () => {
    expect(mapCardStatus('EXPIRED')).toBe('payment_cancelled');
    expect(mapCardStatus('ABORTED')).toBe('payment_cancelled');
  });
  it('CANCELED/PARTIAL_CANCELED → refund_completed', () => {
    expect(mapCardStatus('CANCELED')).toBe('refund_completed');
    expect(mapCardStatus('PARTIAL_CANCELED')).toBe('refund_completed');
  });
  it('READY/IN_PROGRESS/기타 → webhook_received', () => {
    expect(mapCardStatus('READY')).toBe('webhook_received');
    expect(mapCardStatus('IN_PROGRESS')).toBe('webhook_received');
    expect(mapCardStatus('UNKNOWN_TOSS_STATUS')).toBe('webhook_received');
  });
});

describe('mapDepositStatus — §3.2.4 매핑', () => {
  it('DONE → payment_approved', () => {
    expect(mapDepositStatus('DONE')).toBe('payment_approved');
  });
  it('CANCELED → refund_completed', () => {
    expect(mapDepositStatus('CANCELED')).toBe('refund_completed');
  });
  it('EXPIRED → payment_cancelled', () => {
    expect(mapDepositStatus('EXPIRED')).toBe('payment_cancelled');
  });
  it('WAITING_FOR_DEPOSIT/기타 → webhook_received', () => {
    expect(mapDepositStatus('WAITING_FOR_DEPOSIT')).toBe('webhook_received');
    expect(mapDepositStatus('UNKNOWN')).toBe('webhook_received');
  });
});

/* ══════════════════════════════════════════
   handleCardWebhook
   ══════════════════════════════════════════ */

describe('handleCardWebhook', () => {
  it('DONE 정상 경로 — 권위 GET → applyWebhookEventRpc 호출, kind=ok', async () => {
    vi.mocked(tossGetPayment).mockResolvedValue(makeTossGetResponse());
    vi.mocked(findOrderWithPaymentByOrderNumber).mockResolvedValue(makeCombo());
    vi.mocked(applyWebhookEventRpc).mockResolvedValue(undefined);

    const result = await handleCardWebhook(makeCardPayload());

    expect(result.kind).toBe('ok');
    expect(tossGetPayment).toHaveBeenCalledWith(PAYMENT_KEY);
    expect(findOrderWithPaymentByOrderNumber).toHaveBeenCalledWith(ORDER_NUMBER);
    expect(applyWebhookEventRpc).toHaveBeenCalledTimes(1);
    const rpcArgs = vi.mocked(applyWebhookEventRpc).mock.calls[0][0];
    expect(rpcArgs.orderId).toBe(ORDER_UUID);
    expect(rpcArgs.eventType).toBe('payment_approved');
    expect(rpcArgs.amount).toBe(TOTAL_AMOUNT);
    /* 멱등 키 = webhook:{paymentKey}:{lastTransactionKey} */
    expect(rpcArgs.idempotencyKey).toBe(`webhook:${PAYMENT_KEY}:tx_ABC`);
  });

  it('PARTIAL_CANCELED 다회 — cancels[-1].transactionKey 로 멱등 키 분리', async () => {
    vi.mocked(tossGetPayment).mockResolvedValue(
      makeTossGetResponse({
        status: 'PARTIAL_CANCELED',
        lastTransactionKey: 'tx_CANCEL_2',
        cancels: [
          { transactionKey: 'tx_CANCEL_1', cancelAmount: 3_000 },
          { transactionKey: 'tx_CANCEL_2', cancelAmount: 2_000 },
        ],
      }),
    );
    vi.mocked(findOrderWithPaymentByOrderNumber).mockResolvedValue(makeCombo());
    vi.mocked(applyWebhookEventRpc).mockResolvedValue(undefined);

    const result = await handleCardWebhook(makeCardPayload());

    expect(result.kind).toBe('ok');
    const rpcArgs = vi.mocked(applyWebhookEventRpc).mock.calls[0][0];
    expect(rpcArgs.eventType).toBe('refund_completed');
    /* 마지막 cancel 의 금액 — 2,000원 */
    expect(rpcArgs.amount).toBe(2_000);
    expect(rpcArgs.idempotencyKey).toBe(
      `webhook:${PAYMENT_KEY}:partial:tx_CANCEL_2`,
    );
  });

  it('총액 불일치 → auth_failed (위조 의심)', async () => {
    vi.mocked(tossGetPayment).mockResolvedValue(
      makeTossGetResponse({ totalAmount: 99_999 }),
    );
    vi.mocked(findOrderWithPaymentByOrderNumber).mockResolvedValue(makeCombo());

    const result = await handleCardWebhook(makeCardPayload());

    expect(result.kind).toBe('auth_failed');
    expect(result.detail).toBe('amount_mismatch');
    expect(applyWebhookEventRpc).not.toHaveBeenCalled();
  });

  it('orders 레코드 없음 → bad_request', async () => {
    vi.mocked(tossGetPayment).mockResolvedValue(makeTossGetResponse());
    vi.mocked(findOrderWithPaymentByOrderNumber).mockResolvedValue(null);

    const result = await handleCardWebhook(makeCardPayload());

    expect(result.kind).toBe('bad_request');
    expect(result.detail).toBe('order_not_found');
    expect(applyWebhookEventRpc).not.toHaveBeenCalled();
  });

  it('payments 레코드 없음 → timing_inversion', async () => {
    vi.mocked(tossGetPayment).mockResolvedValue(makeTossGetResponse());
    vi.mocked(findOrderWithPaymentByOrderNumber).mockResolvedValue(
      makeCombo({}, null),
    );

    const result = await handleCardWebhook(makeCardPayload());

    expect(result.kind).toBe('timing_inversion');
    expect(result.detail).toBe('payment_row_missing');
    expect(applyWebhookEventRpc).not.toHaveBeenCalled();
  });

  it('23505 UNIQUE → ok (silent skip)', async () => {
    vi.mocked(tossGetPayment).mockResolvedValue(makeTossGetResponse());
    vi.mocked(findOrderWithPaymentByOrderNumber).mockResolvedValue(makeCombo());
    vi.mocked(applyWebhookEventRpc).mockRejectedValue(makeUniqueViolation());

    const result = await handleCardWebhook(makeCardPayload());

    expect(result.kind).toBe('ok');
  });

  it('Toss 4xx → auth_failed', async () => {
    vi.mocked(tossGetPayment).mockRejectedValue(
      new TossApiError(404, 'NOT_FOUND_PAYMENT', 'not found'),
    );

    const result = await handleCardWebhook(makeCardPayload());

    expect(result.kind).toBe('auth_failed');
    expect(result.detail).toBe('toss_api_404');
  });

  it('Toss 응답의 orderId 가 payload 와 다르면 auth_failed', async () => {
    vi.mocked(tossGetPayment).mockResolvedValue(
      makeTossGetResponse({ orderId: 'GT-20260416-99999' }),
    );

    const result = await handleCardWebhook(makeCardPayload());

    expect(result.kind).toBe('auth_failed');
    expect(result.detail).toBe('order_id_mismatch');
    expect(findOrderWithPaymentByOrderNumber).not.toHaveBeenCalled();
  });
});

/* ══════════════════════════════════════════
   handleVirtualAccountWebhook
   ══════════════════════════════════════════ */

describe('handleVirtualAccountWebhook', () => {
  const virtualCombo = () =>
    makeCombo(
      { payment_method: 'transfer' },
      makePayment({ method: 'transfer', webhook_secret: WEBHOOK_SECRET }),
    );

  it('DONE 정상 경로 — timing-safe secret 일치 + RPC 호출', async () => {
    vi.mocked(findOrderWithPaymentByOrderNumber).mockResolvedValue(virtualCombo());
    vi.mocked(applyWebhookEventRpc).mockResolvedValue(undefined);

    const result = await handleVirtualAccountWebhook(makeDepositPayload());

    expect(result.kind).toBe('ok');
    const rpcArgs = vi.mocked(applyWebhookEventRpc).mock.calls[0][0];
    expect(rpcArgs.eventType).toBe('payment_approved');
    expect(rpcArgs.amount).toBe(TOTAL_AMOUNT);
    expect(rpcArgs.idempotencyKey).toBe(
      `webhook:deposit:${ORDER_NUMBER}:DONE:2026-04-16T01:02:03.000Z`,
    );
  });

  it('secret 불일치 → auth_failed (timing-safe)', async () => {
    vi.mocked(findOrderWithPaymentByOrderNumber).mockResolvedValue(virtualCombo());

    const result = await handleVirtualAccountWebhook(
      makeDepositPayload({}, 'wrong_secret_value_xx'),
    );

    expect(result.kind).toBe('auth_failed');
    expect(result.detail).toBe('secret_mismatch');
    expect(applyWebhookEventRpc).not.toHaveBeenCalled();
  });

  it('webhook_secret 컬럼 없음 → timing_inversion', async () => {
    vi.mocked(findOrderWithPaymentByOrderNumber).mockResolvedValue(
      makeCombo(
        { payment_method: 'transfer' },
        makePayment({ method: 'transfer', webhook_secret: null }),
      ),
    );

    const result = await handleVirtualAccountWebhook(makeDepositPayload());

    expect(result.kind).toBe('timing_inversion');
    expect(result.detail).toBe('webhook_secret_unavailable');
  });

  it('payments 행 자체 없음 → timing_inversion', async () => {
    vi.mocked(findOrderWithPaymentByOrderNumber).mockResolvedValue(
      makeCombo({ payment_method: 'transfer' }, null),
    );

    const result = await handleVirtualAccountWebhook(makeDepositPayload());

    expect(result.kind).toBe('timing_inversion');
  });

  it('orders 자체 없음 → bad_request', async () => {
    vi.mocked(findOrderWithPaymentByOrderNumber).mockResolvedValue(null);

    const result = await handleVirtualAccountWebhook(makeDepositPayload());

    expect(result.kind).toBe('bad_request');
    expect(result.detail).toBe('order_not_found');
  });

  it('23505 UNIQUE → ok (silent skip)', async () => {
    vi.mocked(findOrderWithPaymentByOrderNumber).mockResolvedValue(virtualCombo());
    vi.mocked(applyWebhookEventRpc).mockRejectedValue(makeUniqueViolation());

    const result = await handleVirtualAccountWebhook(makeDepositPayload());

    expect(result.kind).toBe('ok');
  });
});

/* ══════════════════════════════════════════
   handleUnknownWebhook
   ══════════════════════════════════════════ */

describe('handleUnknownWebhook', () => {
  it('감사 로그만 남기고 ok 반환', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const payload: UnknownWebhookPayload = {
      eventType: 'FUTURE_EVENT',
      createdAt: '2026-04-16T05:00:00.000Z',
    };

    const result = await handleUnknownWebhook(payload);

    expect(result.kind).toBe('ok');
    expect(result.detail).toBe('unknown:FUTURE_EVENT:2026-04-16T05:00:00.000Z');
    expect(warn).toHaveBeenCalledWith(
      '[webhook] unknown eventType',
      expect.objectContaining({ eventType: 'FUTURE_EVENT' }),
    );
    /* RPC 는 호출하지 않는다 (유효 order 가 없으므로) */
    expect(applyWebhookEventRpc).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('createdAt 부재 시에도 fallback 키 생성', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await handleUnknownWebhook({
      eventType: 'NO_DATE_EVENT',
    });

    expect(result.kind).toBe('ok');
    expect(result.detail?.startsWith('unknown:NO_DATE_EVENT:')).toBe(true);
    warn.mockRestore();
  });
});
