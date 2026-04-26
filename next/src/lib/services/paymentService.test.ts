/* ══════════════════════════════════════════════════════════════════════════
   paymentService.test.ts — confirm 플로우 단위 테스트 (BUG-115 PR1)

   커버리지:
   - 카드 정상: 'card' → mapTossMethod → confirmPaymentRpc 호출, easypayProvider=null
   - 가상계좌 정상: 'transfer' + virtualAccount.secret 전달
   - 간편결제 정상 (BUG-115): EASY_PAY 응답 + easyPay.provider='KAKAOPAY' → easypay_provider='kakaopay'
   - 간편결제 실패 (BUG-115): EASY_PAY 응답 + provider 누락 → 'easypay_provider_missing'
   - 매핑 실패: 'MOBILE_PHONE' 등 미지원 method → 'method_mismatch'
   - method_mismatch 비교 검증 제거 검증 (BUG-115): order.payment_method='card' + Toss 'easypay' → 정상 진행

   Mock 전략: vi.mock 으로 tossClient + paymentRepo 차단.
   ══════════════════════════════════════════════════════════════════════════ */

import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  }
  return {
    TossApiError,
    TossNetworkError,
    confirmPayment: vi.fn(),
    getPayment: vi.fn(),
  };
});

vi.mock('@/lib/repositories/paymentRepo', () => ({
  findOrderForConfirm: vi.fn(),
  findPaymentByOrderId: vi.fn(),
  confirmPaymentRpc: vi.fn(),
}));

import { confirmOrder, PaymentServiceError } from './paymentService';
import {
  confirmPayment as tossConfirmPayment,
  type TossConfirmResponse,
} from '@/lib/payments/tossClient';
import {
  confirmPaymentRpc,
  findOrderForConfirm,
  findPaymentByOrderId,
  type ConfirmPaymentRpcParams,
  type OrderForConfirm,
  type PaymentRow,
} from '@/lib/repositories/paymentRepo';
import type { PaymentConfirmInput } from '@/lib/schemas/payment';

const ORDER_UUID = '11111111-2222-3333-4444-555555555555';
const ORDER_NUMBER = 'GT-20260427-00001';
const PUBLIC_TOKEN = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const PAYMENT_KEY = 'toss_test_payment_key_BUG115';
const TOTAL_AMOUNT = 28_000;
const VA_SECRET = 'va_secret_abcdef_0123456789';

function makeOrder(overrides: Partial<OrderForConfirm> = {}): OrderForConfirm {
  return {
    id: ORDER_UUID,
    order_number: ORDER_NUMBER,
    public_token: PUBLIC_TOKEN,
    user_id: 'user-uuid-123',
    guest_email: null,
    contact_email: 'test@example.com',
    status: 'pending',
    payment_method: 'card',
    total_amount: TOTAL_AMOUNT,
    ...overrides,
  };
}

function makeInput(overrides: Partial<PaymentConfirmInput> = {}): PaymentConfirmInput {
  return {
    paymentKey: PAYMENT_KEY,
    orderId: ORDER_NUMBER,
    amount: TOTAL_AMOUNT,
    ...overrides,
  };
}

function makeTossResponse(
  overrides: Partial<TossConfirmResponse> = {},
): TossConfirmResponse {
  return {
    paymentKey: PAYMENT_KEY,
    orderId: ORDER_NUMBER,
    status: 'DONE',
    method: '카드',
    totalAmount: TOTAL_AMOUNT,
    approvedAt: '2026-04-27T01:00:00.000Z',
    ...overrides,
  };
}

function makePaymentRow(overrides: Partial<PaymentRow> = {}): PaymentRow {
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
    approved_at: '2026-04-27T01:00:00.000Z',
    easypay_provider: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(tossConfirmPayment).mockReset();
  vi.mocked(findOrderForConfirm).mockReset();
  vi.mocked(findPaymentByOrderId).mockReset();
  vi.mocked(confirmPaymentRpc).mockReset();
  vi.mocked(confirmPaymentRpc).mockResolvedValue({
    orderNumber: ORDER_NUMBER,
    status: 'paid',
  });
  vi.mocked(findPaymentByOrderId).mockResolvedValue(makePaymentRow());
});

describe('confirmOrder — 카드/계좌이체 정상 경로 (회귀)', () => {
  it("Toss method '카드' → method='card', easypayProvider=null", async () => {
    vi.mocked(findOrderForConfirm).mockResolvedValue(makeOrder({ payment_method: 'card' }));
    vi.mocked(tossConfirmPayment).mockResolvedValue(makeTossResponse({ method: '카드' }));

    const result = await confirmOrder(makeInput(), { userId: 'user-uuid-123' });

    expect(result.method).toBe('card');
    const rpcArgs = vi.mocked(confirmPaymentRpc).mock.calls[0][0] as ConfirmPaymentRpcParams;
    expect(rpcArgs.method).toBe('card');
    expect(rpcArgs.easypayProvider).toBeNull();
    expect(rpcArgs.webhookSecret).toBeNull();
  });

  it("Toss method '가상계좌' + virtualAccount.secret → method='transfer', secret 전달", async () => {
    vi.mocked(findOrderForConfirm).mockResolvedValue(
      makeOrder({ payment_method: 'transfer' }),
    );
    vi.mocked(tossConfirmPayment).mockResolvedValue(
      makeTossResponse({
        method: '가상계좌',
        virtualAccount: {
          accountNumber: '12345678901234',
          bank: '신한',
          dueDate: '2026-04-30T23:59:59',
          secret: VA_SECRET,
        },
      }),
    );

    await confirmOrder(makeInput(), { userId: 'user-uuid-123' });

    const rpcArgs = vi.mocked(confirmPaymentRpc).mock.calls[0][0] as ConfirmPaymentRpcParams;
    expect(rpcArgs.method).toBe('transfer');
    expect(rpcArgs.webhookSecret).toBe(VA_SECRET);
    expect(rpcArgs.easypayProvider).toBeNull();
  });
});

describe('confirmOrder — 간편결제 (BUG-115 PR1)', () => {
  it("Toss method='EASY_PAY' + easyPay.provider='KAKAOPAY' → easypay_provider='kakaopay'", async () => {
    vi.mocked(findOrderForConfirm).mockResolvedValue(makeOrder({ payment_method: 'card' }));
    vi.mocked(tossConfirmPayment).mockResolvedValue(
      makeTossResponse({
        method: 'EASY_PAY',
        easyPay: { provider: 'KAKAOPAY', amount: TOTAL_AMOUNT, discountAmount: 0 },
      } as Partial<TossConfirmResponse>),
    );

    await confirmOrder(makeInput(), { userId: 'user-uuid-123' });

    const rpcArgs = vi.mocked(confirmPaymentRpc).mock.calls[0][0] as ConfirmPaymentRpcParams;
    expect(rpcArgs.method).toBe('easypay');
    expect(rpcArgs.easypayProvider).toBe('kakaopay');
    expect(rpcArgs.webhookSecret).toBeNull();
  });

  it("Toss method='간편결제' + easyPay.provider='네이버페이' → easypay_provider='naverpay'", async () => {
    vi.mocked(findOrderForConfirm).mockResolvedValue(makeOrder({ payment_method: 'card' }));
    vi.mocked(tossConfirmPayment).mockResolvedValue(
      makeTossResponse({
        method: '간편결제',
        easyPay: { provider: '네이버페이' },
      } as Partial<TossConfirmResponse>),
    );

    await confirmOrder(makeInput(), { userId: 'user-uuid-123' });

    const rpcArgs = vi.mocked(confirmPaymentRpc).mock.calls[0][0] as ConfirmPaymentRpcParams;
    expect(rpcArgs.method).toBe('easypay');
    expect(rpcArgs.easypayProvider).toBe('naverpay');
  });

  it('9종 provider 모두 정상 매핑', async () => {
    const cases: Array<[string, string]> = [
      ['TOSSPAY', 'tosspay'],
      ['KAKAOPAY', 'kakaopay'],
      ['NAVERPAY', 'naverpay'],
      ['PAYCO', 'payco'],
      ['SAMSUNGPAY', 'samsungpay'],
      ['LPAY', 'lpay'],
      ['SSG', 'ssgpay'],
      ['APPLEPAY', 'applepay'],
      ['PINPAY', 'pinpay'],
    ];

    for (const [tossProvider, dbProvider] of cases) {
      vi.mocked(confirmPaymentRpc).mockClear();
      vi.mocked(findOrderForConfirm).mockResolvedValue(makeOrder({ payment_method: 'card' }));
      vi.mocked(tossConfirmPayment).mockResolvedValue(
        makeTossResponse({
          method: 'EASY_PAY',
          easyPay: { provider: tossProvider },
        } as Partial<TossConfirmResponse>),
      );

      await confirmOrder(makeInput(), { userId: 'user-uuid-123' });

      const rpcArgs = vi.mocked(confirmPaymentRpc).mock.calls[0][0] as ConfirmPaymentRpcParams;
      expect(rpcArgs.easypayProvider).toBe(dbProvider);
    }
  });

  it('EASY_PAY 응답인데 provider 누락 → easypay_provider_missing', async () => {
    vi.mocked(findOrderForConfirm).mockResolvedValue(makeOrder({ payment_method: 'card' }));
    vi.mocked(tossConfirmPayment).mockResolvedValue(
      makeTossResponse({
        method: 'EASY_PAY',
        easyPay: { amount: TOTAL_AMOUNT },
      } as Partial<TossConfirmResponse>),
    );

    await expect(
      confirmOrder(makeInput(), { userId: 'user-uuid-123' }),
    ).rejects.toMatchObject({
      name: 'PaymentServiceError',
      code: 'easypay_provider_missing',
    });
    expect(confirmPaymentRpc).not.toHaveBeenCalled();
  });

  it('EASY_PAY 응답 + provider 미지원 값 → easypay_provider_missing', async () => {
    vi.mocked(findOrderForConfirm).mockResolvedValue(makeOrder({ payment_method: 'card' }));
    vi.mocked(tossConfirmPayment).mockResolvedValue(
      makeTossResponse({
        method: 'EASY_PAY',
        easyPay: { provider: 'UNSUPPORTED_PAY' },
      } as Partial<TossConfirmResponse>),
    );

    await expect(
      confirmOrder(makeInput(), { userId: 'user-uuid-123' }),
    ).rejects.toMatchObject({ code: 'easypay_provider_missing' });
  });
});

describe('confirmOrder — method_mismatch 의미 변경 (BUG-115 PR1)', () => {
  it('order.payment_method=card 인데 Toss=easypay → 정상 진행 (비교 검증 제거)', async () => {
    vi.mocked(findOrderForConfirm).mockResolvedValue(makeOrder({ payment_method: 'card' }));
    vi.mocked(tossConfirmPayment).mockResolvedValue(
      makeTossResponse({
        method: 'EASY_PAY',
        easyPay: { provider: 'TOSSPAY' },
      } as Partial<TossConfirmResponse>),
    );

    await expect(
      confirmOrder(makeInput(), { userId: 'user-uuid-123' }),
    ).resolves.toMatchObject({ orderNumber: ORDER_NUMBER });

    const rpcArgs = vi.mocked(confirmPaymentRpc).mock.calls[0][0] as ConfirmPaymentRpcParams;
    expect(rpcArgs.method).toBe('easypay');
    expect(rpcArgs.easypayProvider).toBe('tosspay');
  });

  it('Toss method 미지원(MOBILE_PHONE) → method_mismatch (매핑 실패만 거부)', async () => {
    vi.mocked(findOrderForConfirm).mockResolvedValue(makeOrder({ payment_method: 'card' }));
    vi.mocked(tossConfirmPayment).mockResolvedValue(
      makeTossResponse({ method: 'MOBILE_PHONE' }),
    );

    await expect(
      confirmOrder(makeInput(), { userId: 'user-uuid-123' }),
    ).rejects.toMatchObject({
      name: 'PaymentServiceError',
      code: 'method_mismatch',
    });
    expect(confirmPaymentRpc).not.toHaveBeenCalled();
  });

  it('Toss method 누락 → method_mismatch', async () => {
    vi.mocked(findOrderForConfirm).mockResolvedValue(makeOrder({ payment_method: 'card' }));
    vi.mocked(tossConfirmPayment).mockResolvedValue(makeTossResponse({ method: undefined }));

    await expect(
      confirmOrder(makeInput(), { userId: 'user-uuid-123' }),
    ).rejects.toBeInstanceOf(PaymentServiceError);
  });
});
