import { beforeEach, describe, expect, it, vi } from 'vitest';

/* ── 의존 모듈 mock ────────────────────────────────────────────────────── */

const getSupabaseAdminMock = vi.fn();
vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => getSupabaseAdminMock(),
}));

const chargeBillingMock = vi.fn();
vi.mock('@/lib/payments/tossBillingClient', () => ({
  chargeBilling: (...args: unknown[]) => chargeBillingMock(...args),
  // chargeFirstCycle 가 import 하는 심볼들 — 본 테스트에선 미사용이나 export 필요.
  issueBillingAuthorization: vi.fn(),
}));

const fetchProductsMock = vi.fn();
vi.mock('@/lib/productsServer', () => ({
  fetchProducts: () => fetchProductsMock(),
}));

const fetchSiteSettingsMock = vi.fn();
vi.mock('@/lib/siteSettingsServer', () => ({
  fetchSiteSettings: () => fetchSiteSettingsMock(),
}));

const sendBillingFailureEmailMock = vi.fn();
vi.mock('@/lib/email/notifications', () => ({
  sendBillingFailureEmail: (...args: unknown[]) => sendBillingFailureEmailMock(...args),
}));

import { chargeRecurringCycle, BillingServiceError } from './billingService';

/* ── chainable supabase admin mock ─────────────────────────────────────── */

type BuilderResp = { data?: unknown; error?: unknown; count?: number };

/**
 * 테이블별 응답을 주입하는 chainable + thenable 빌더.
 * - .maybeSingle()/.single() → resp
 * - await builder (count 쿼리) → resp (thenable)
 * - .insert() → { error: null } (또는 주입)
 */
function makeBuilder(resp: BuilderResp, insertSpy?: ReturnType<typeof vi.fn>) {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'is', 'order', 'limit']) {
    b[m] = vi.fn(() => b);
  }
  b.maybeSingle = vi.fn(async () => resp);
  b.single = vi.fn(async () => resp);
  b.insert = insertSpy ?? vi.fn(async () => ({ error: null }));
  // count 쿼리(await builder)용 thenable
  b.then = (resolve: (v: BuilderResp) => unknown) => resolve(resp);
  return b;
}

const SUB_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = '11111111-2222-4333-8444-555555555555';

function baseSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: SUB_ID,
    user_id: USER_ID,
    product_slug: 'sunny-afternoon',
    product_name: '산뜻한 오후',
    product_volume: '200g',
    product_image_src: '/img.webp',
    cycle: '4주',
    status: 'active',
    next_delivery_at: '2026-06-01T00:00:00.000Z', // 과거 → 청구 대상
    billing_method_id: 'bm-1',
    unit_price: 18000,
    quantity: 1,
    ...overrides,
  };
}

/** from(table) 응답 + rpc 응답을 시나리오별로 구성. */
function setupAdmin(opts: {
  subscription?: BuilderResp;
  billingMethod?: BuilderResp;
  address?: BuilderResp;
  profile?: BuilderResp;
  failureInsert?: ReturnType<typeof vi.fn>;
  rpc?: Record<string, BuilderResp>;
}) {
  const failuresBuilder = makeBuilder({ count: 0 }, opts.failureInsert);
  const builders: Record<string, ReturnType<typeof makeBuilder>> = {
    subscriptions: makeBuilder(opts.subscription ?? { data: baseSubscription() }),
    billing_methods: makeBuilder(
      opts.billingMethod ?? { data: { id: 'bm-1', billing_key: 'bk', method: 'card' } },
    ),
    addresses: makeBuilder(
      opts.address ?? {
        data: { name: '수령인', phone: '010-1234-5678', zipcode: '12345', addr1: '서울', addr2: null },
      },
    ),
    profiles: makeBuilder(
      opts.profile ?? { data: { customer_key: 'ck', email: 'u@x.com', phone: '010-1234-5678' } },
    ),
    subscription_billing_failures: failuresBuilder,
  };

  const rpcResults = opts.rpc ?? {};
  const admin = {
    from: vi.fn((t: string) => builders[t]),
    /* .rpc(fn).single() (create/process) 와 await .rpc(fn) (pause) 둘 다 지원 — thenable + single. */
    rpc: vi.fn((fn: string) => {
      const resp = rpcResults[fn] ?? { data: null, error: null };
      return {
        single: async () => resp,
        then: (resolve: (v: BuilderResp) => unknown) => resolve(resp),
      };
    }),
  };
  getSupabaseAdminMock.mockReturnValue(admin);
  return { admin, failuresBuilder };
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchProductsMock.mockResolvedValue([
    { slug: 'sunny-afternoon', category: 'Coffee Bean' },
  ]);
  fetchSiteSettingsMock.mockResolvedValue({
    shipping: { enabled: true, free_threshold: 30000, base_fee: 3500 },
  });
});

describe('chargeRecurringCycle', () => {
  it('성공 — 회차 주문 생성 + 결제 + next_delivery 전진', async () => {
    setupAdmin({
      rpc: {
        create_recurring_order: {
          data: { order_id: 'o-1', order_number: 'GT-20260628-00001', total_amount: 21500 },
        },
        process_recurring_billing_charge: {
          data: { payment_id: 'p-1', next_delivery_at: '2026-07-26T00:00:00.000Z' },
        },
      },
    });
    chargeBillingMock.mockResolvedValueOnce({
      status: 'DONE',
      paymentKey: 'pk_test',
      totalAmount: 21500,
    });

    const result = await chargeRecurringCycle({ subscriptionId: SUB_ID });

    expect(result.orderNumber).toBe('GT-20260628-00001');
    expect(result.amount).toBe(21500);
    expect(result.nextDeliveryAt).toBe('2026-07-26T00:00:00.000Z');
    // 멱등키가 회차 식별 형태로 전달됐는지
    expect(chargeBillingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 21500,
        orderId: 'GT-20260628-00001',
        idempotencyKey: expect.stringContaining(`recurring-${SUB_ID}-`),
      }),
    );
  });

  it('배송지 없음 → 실패 기록 + no_default_address throw', async () => {
    const failureInsert = vi.fn(async () => ({ error: null }));
    setupAdmin({ address: { data: null }, failureInsert });

    await expect(chargeRecurringCycle({ subscriptionId: SUB_ID })).rejects.toMatchObject({
      code: 'no_default_address',
    });
    expect(failureInsert).toHaveBeenCalledWith(
      expect.objectContaining({ error_code: 'NO_DEFAULT_ADDRESS' }),
    );
    // 결제는 시도조차 안 함
    expect(chargeBillingMock).not.toHaveBeenCalled();
  });

  it('일시 실패(토스) → 실패 기록 + retry_at 채움 + toss_charge_failed', async () => {
    const failureInsert = vi.fn(
      async (_row: { error_code: string; retry_at: string | null }) => ({ error: null }),
    );
    const { admin } = setupAdmin({
      failureInsert,
      rpc: {
        create_recurring_order: {
          data: { order_id: 'o-1', order_number: 'GT-20260628-00002', total_amount: 21500 },
        },
      },
    });
    const { TossApiError } = await import('@/lib/payments/tossClient');
    chargeBillingMock.mockRejectedValueOnce(
      new TossApiError(402, 'PROVIDER_ERROR', '일시 오류'),
    );

    await expect(chargeRecurringCycle({ subscriptionId: SUB_ID })).rejects.toMatchObject({
      code: 'toss_charge_failed',
    });
    const arg = failureInsert.mock.calls[0][0] as { error_code: string; retry_at: string | null };
    expect(arg.error_code).toBe('PROVIDER_ERROR');
    expect(arg.retry_at).not.toBeNull(); // 일시 → 재시도 예정
    // R-3a: 일시 오류는 재시도 대기 → paused 전환 안 함
    const pauseCalls = (admin.rpc as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c) => c[0] === 'pause_subscription_for_billing',
    );
    expect(pauseCalls).toHaveLength(0);
    // R-3b: 일시 오류는 paused 아님 → 알림 미발송
    expect(sendBillingFailureEmailMock).not.toHaveBeenCalled();
  });

  it('영구 실패(토스) → 실패 기록 + retry_at null', async () => {
    const failureInsert = vi.fn(
      async (_row: { error_code: string; retry_at: string | null }) => ({ error: null }),
    );
    const { admin } = setupAdmin({
      failureInsert,
      rpc: {
        create_recurring_order: {
          data: { order_id: 'o-1', order_number: 'GT-20260628-00003', total_amount: 21500 },
        },
        pause_subscription_for_billing: { data: true }, // active→paused 전환됨
      },
    });
    const { TossApiError } = await import('@/lib/payments/tossClient');
    chargeBillingMock.mockRejectedValueOnce(
      new TossApiError(400, 'INVALID_STOPPED_CARD', '정지 카드'),
    );

    await expect(chargeRecurringCycle({ subscriptionId: SUB_ID })).rejects.toMatchObject({
      code: 'toss_charge_failed',
    });
    const arg = failureInsert.mock.calls[0][0] as { error_code: string; retry_at: string | null };
    expect(arg.error_code).toBe('INVALID_STOPPED_CARD');
    expect(arg.retry_at).toBeNull(); // 영구 → 재시도 안 함
    // R-3a: 영구 오류(retry_at null) → 구독 일시정지 호출
    expect(admin.rpc).toHaveBeenCalledWith('pause_subscription_for_billing', {
      p_subscription_id: SUB_ID,
    });
    // R-3b: paused 전환 시 재등록 유도 알림 발송
    expect(sendBillingFailureEmailMock).toHaveBeenCalledWith(SUB_ID);
  });

  it('비활성 구독 → subscription_not_active (결제 안 함)', async () => {
    setupAdmin({ subscription: { data: baseSubscription({ status: 'paused' }) } });
    await expect(chargeRecurringCycle({ subscriptionId: SUB_ID })).rejects.toMatchObject({
      code: 'subscription_not_active',
    });
    expect(chargeBillingMock).not.toHaveBeenCalled();
  });

  it('스냅샷 누락(unit_price null) → subscription_snapshot_missing', async () => {
    setupAdmin({ subscription: { data: baseSubscription({ unit_price: null }) } });
    await expect(chargeRecurringCycle({ subscriptionId: SUB_ID })).rejects.toMatchObject({
      code: 'subscription_snapshot_missing',
    });
  });

  it('토스 출금 성공 후 후처리 RPC 실패 → RPC_FAILED_AFTER_CHARGE 기록 + charge_post_process_failed (R-2a)', async () => {
    const failureInsert = vi.fn(async () => ({ error: null }));
    setupAdmin({
      failureInsert,
      rpc: {
        create_recurring_order: {
          data: { order_id: 'o-1', order_number: 'GT-20260628-00009', total_amount: 21500 },
        },
        // 후처리 RPC 실패 주입 (토스 출금은 이미 성공)
        process_recurring_billing_charge: { error: { message: 'deadlock detected' } },
      },
    });
    chargeBillingMock.mockResolvedValueOnce({
      status: 'DONE',
      paymentKey: 'pk_test',
      totalAmount: 21500,
    });

    await expect(chargeRecurringCycle({ subscriptionId: SUB_ID })).rejects.toMatchObject({
      code: 'charge_post_process_failed',
    });
    // 토스 출금됨 → dunning 큐에 기록되어 R-3 재시도가 같은 order 로 복구
    expect(failureInsert).toHaveBeenCalledWith(
      expect.objectContaining({ error_code: 'RPC_FAILED_AFTER_CHARGE' }),
    );
  });
});
