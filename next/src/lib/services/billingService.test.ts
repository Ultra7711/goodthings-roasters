/* ══════════════════════════════════════════════════════════════════════════
   billingService.test.ts — Phase 3-A 빌링 비즈 로직 단위 테스트 (S176)

   커버리지 (핵심):
   issueBillingMethod
   - profile_not_found
   - customer_key_mismatch
   - 정상 (첫 카드 → isDefault=true)
   - 정상 (두 번째 카드 → isDefault=false)
   - TossApiError → toss_authorization_failed
   chargeFirstCycle
   - order_not_found
   - order_not_pending
   - billing_method_not_found
   - duplicate_subscription
   - charge_not_done
   - 정상 (RPC 호출 + subscription_ids 반환)
   listBillingMethods
   - snake_case → camelCase 매핑 + billing_key 노출 X
   setDefaultBillingMethod
   - RPC 호출 + not_found → BillingServiceError

   Mock 전략:
   - vi.mock('@/lib/supabaseAdmin') — chained query stub + .rpc 지원
   - vi.mock('@/lib/payments/tossBillingClient') — issueBillingAuthorization, chargeBilling
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
    tossFetch: vi.fn(),
  };
});

vi.mock('@/lib/payments/tossBillingClient', () => ({
  issueBillingAuthorization: vi.fn(),
  chargeBilling: vi.fn(),
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: vi.fn(),
}));

import {
  issueBillingMethod,
  chargeFirstCycle,
  cleanupOrphanBillingMethods,
} from './billingService';
import {
  issueBillingAuthorization,
  chargeBilling,
} from '@/lib/payments/tossBillingClient';
import { TossApiError } from '@/lib/payments/tossClient';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const issueBillingAuthorizationMock = vi.mocked(issueBillingAuthorization);
const chargeBillingMock = vi.mocked(chargeBilling);
const getSupabaseAdminMock = vi.mocked(getSupabaseAdmin);

const USER_ID = '11111111-1111-1111-1111-111111111111';
const CUSTOMER_KEY = 'cus_22222222-2222-2222-2222-222222222222';
const BILLING_KEY = 'toss_billing_key_xyz';
const BILLING_METHOD_ID = '33333333-3333-3333-3333-333333333333';
const ORDER_ID = '44444444-4444-4444-4444-444444444444';
const ORDER_NUMBER = 'GT-20260507-00001';
const PAYMENT_KEY = 'toss_payment_key_abc';
const SUBSCRIPTION_ID = '55555555-5555-5555-5555-555555555555';

/* ── chained query stub ─────────────────────────────────────────────── */
type Stub = {
  from: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
};

/**
 * 호출 시 다음 응답을 큐로 받음. 호출 순서대로 .single/.maybeSingle 의 응답 반환.
 * .from('table_name') 호출 시 query 가 reset 되며 새 응답 큐 추적.
 */
function makeAdminStub(): {
  stub: Stub;
  pushSingle: (data: unknown, error?: unknown) => void;
  pushMaybeSingle: (data: unknown, error?: unknown) => void;
  pushSelectResult: (data: unknown, error?: unknown, count?: number) => void;
  pushRpc: (data: unknown, error?: unknown) => void;
} {
  const stub = {} as Stub;

  const singleQueue: Array<{ data: unknown; error: unknown }> = [];
  const maybeSingleQueue: Array<{ data: unknown; error: unknown }> = [];
  const selectQueue: Array<{ data: unknown; error: unknown; count?: number }> = [];
  const rpcQueue: Array<{ data: unknown; error: unknown }> = [];

  stub.from = vi.fn(() => stub);
  stub.insert = vi.fn(() => stub);
  stub.update = vi.fn(() => stub);
  stub.eq = vi.fn(() => stub);
  stub.is = vi.fn(() => stub);
  stub.order = vi.fn(() => stub);
  stub.limit = vi.fn(() => stub);
  stub.single = vi.fn(() => Promise.resolve(singleQueue.shift() ?? { data: null, error: null }));
  stub.maybeSingle = vi.fn(() =>
    Promise.resolve(maybeSingleQueue.shift() ?? { data: null, error: null }),
  );
  stub.rpc = vi.fn(() => {
    const wrapped = {
      single: vi.fn(() =>
        Promise.resolve(rpcQueue.shift() ?? { data: null, error: null }),
      ),
      then: (resolve: (v: unknown) => unknown) =>
        resolve(rpcQueue.shift() ?? { data: null, error: null }),
    };
    return wrapped;
  });

  // select 는 head:true count 옵션 분기 — 기본은 chain 반환, count 옵션 시 즉시 응답
  stub.select = vi.fn(
    (_cols?: string, opts?: { count?: string; head?: boolean }) => {
      if (opts?.head) {
        // count chain — .eq().is() 후 thenable 로 응답 (terminal)
        const countStub = {
          eq: vi.fn(() => countStub),
          is: vi.fn(() => {
            const r = selectQueue.shift() ?? { data: null, error: null, count: 0 };
            return Promise.resolve({
              data: r.data,
              error: r.error,
              count: r.count ?? 0,
            });
          }),
        };
        return countStub;
      }
      return stub;
    },
  );

  return {
    stub,
    pushSingle: (data, error = null) => singleQueue.push({ data, error }),
    pushMaybeSingle: (data, error = null) => maybeSingleQueue.push({ data, error }),
    pushSelectResult: (data, error = null, count) =>
      selectQueue.push({ data, error, count }),
    pushRpc: (data, error = null) => rpcQueue.push({ data, error }),
  };
}

let admin: ReturnType<typeof makeAdminStub>;

beforeEach(() => {
  vi.clearAllMocks();
  admin = makeAdminStub();
  getSupabaseAdminMock.mockReturnValue(admin.stub as never);
});

/* ════════════════════════════════════════════════════════════════════════
   issueBillingMethod
   ════════════════════════════════════════════════════════════════════════ */

describe('issueBillingMethod', () => {
  it('profile 없으면 profile_not_found', async () => {
    admin.pushMaybeSingle(null);

    await expect(
      issueBillingMethod({
        authKey: 'auth-key',
        customerKey: CUSTOMER_KEY,
        userId: USER_ID,
      }),
    ).rejects.toMatchObject({ code: 'profile_not_found' });
  });

  it('customer_key 불일치 시 customer_key_mismatch', async () => {
    admin.pushMaybeSingle({ customer_key: 'different_key' });

    await expect(
      issueBillingMethod({
        authKey: 'auth-key',
        customerKey: CUSTOMER_KEY,
        userId: USER_ID,
      }),
    ).rejects.toMatchObject({ code: 'customer_key_mismatch' });
  });

  it('첫 카드 INSERT → isDefault=true', async () => {
    // profile lookup
    admin.pushMaybeSingle({ customer_key: CUSTOMER_KEY });
    // count 응답 (첫 카드 = 0)
    admin.pushSelectResult(null, null, 0);
    // INSERT 응답
    admin.pushSingle({ id: BILLING_METHOD_ID });

    issueBillingAuthorizationMock.mockResolvedValueOnce({
      mId: 'merchant_test',
      customerKey: CUSTOMER_KEY,
      authenticatedAt: '2026-05-07T12:00:00+09:00',
      method: '카드',
      billingKey: BILLING_KEY,
      card: {
        issuerCode: '11',
        acquirerCode: '11',
        number: '1234123412341234',
        cardType: '신용',
        ownerType: '개인',
      },
    });

    const result = await issueBillingMethod({
      authKey: 'auth-key',
      customerKey: CUSTOMER_KEY,
      userId: USER_ID,
    });

    expect(result).toEqual({ billingMethodId: BILLING_METHOD_ID, isDefault: true });
    expect(admin.stub.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_ID,
        billing_key: BILLING_KEY,
        method: 'card',
        card_company: '11',
        card_number_masked: '****-****-****-1234',
        is_default: true,
      }),
    );
  });

  it('두 번째 카드 INSERT → isDefault=false', async () => {
    admin.pushMaybeSingle({ customer_key: CUSTOMER_KEY });
    admin.pushSelectResult(null, null, 1); // 기존 1개 있음
    admin.pushSingle({ id: BILLING_METHOD_ID });

    issueBillingAuthorizationMock.mockResolvedValueOnce({
      mId: 'merchant_test',
      customerKey: CUSTOMER_KEY,
      authenticatedAt: '2026-05-07T12:00:00+09:00',
      method: '카드',
      billingKey: BILLING_KEY,
      card: {
        issuerCode: '11',
        acquirerCode: '11',
        number: '1234123412341234',
        cardType: '신용',
        ownerType: '개인',
      },
    });

    const result = await issueBillingMethod({
      authKey: 'auth-key',
      customerKey: CUSTOMER_KEY,
      userId: USER_ID,
    });

    expect(result.isDefault).toBe(false);
  });

  it('TossApiError → toss_authorization_failed', async () => {
    admin.pushMaybeSingle({ customer_key: CUSTOMER_KEY });
    issueBillingAuthorizationMock.mockRejectedValueOnce(
      new TossApiError(400, 'INVALID_AUTH_KEY', 'authKey expired'),
    );

    await expect(
      issueBillingMethod({
        authKey: 'expired',
        customerKey: CUSTOMER_KEY,
        userId: USER_ID,
      }),
    ).rejects.toMatchObject({ code: 'toss_authorization_failed' });
  });
});

/* ════════════════════════════════════════════════════════════════════════
   chargeFirstCycle
   ════════════════════════════════════════════════════════════════════════ */

describe('chargeFirstCycle', () => {
  function pushOrderLookup(order: unknown) {
    admin.pushMaybeSingle(order);
  }
  function pushBillingMethodLookup(method: unknown) {
    admin.pushMaybeSingle(method);
  }
  function pushProfileLookup(profile: unknown) {
    admin.pushMaybeSingle(profile);
  }

  const ORDER_OK = {
    id: ORDER_ID,
    order_number: ORDER_NUMBER,
    user_id: USER_ID,
    status: 'pending',
    total_amount: 30000,
    order_items: [
      {
        product_slug: 'refreshing-afternoon',
        product_name: '산뜻한 오후',
        product_volume: '200g',
        product_image_src: '/images/products/x.webp',
        item_type: 'subscription',
        subscription_period: '4주',
      },
    ],
  };

  const BILLING_METHOD_OK = {
    id: BILLING_METHOD_ID,
    billing_key: BILLING_KEY,
    user_id: USER_ID,
  };

  it('order 없으면 order_not_found', async () => {
    pushOrderLookup(null);
    await expect(
      chargeFirstCycle({ orderId: ORDER_ID, userId: USER_ID, billingMethodId: BILLING_METHOD_ID }),
    ).rejects.toMatchObject({ code: 'order_not_found' });
  });

  it('order status≠pending 이면 order_not_pending', async () => {
    pushOrderLookup({ ...ORDER_OK, status: 'paid' });
    await expect(
      chargeFirstCycle({ orderId: ORDER_ID, userId: USER_ID, billingMethodId: BILLING_METHOD_ID }),
    ).rejects.toMatchObject({ code: 'order_not_pending' });
  });

  it('billing_method 없으면 billing_method_not_found', async () => {
    pushOrderLookup(ORDER_OK);
    pushBillingMethodLookup(null);
    await expect(
      chargeFirstCycle({ orderId: ORDER_ID, userId: USER_ID, billingMethodId: BILLING_METHOD_ID }),
    ).rejects.toMatchObject({ code: 'billing_method_not_found' });
  });

  it('subscription item 없으면 no_subscription_items', async () => {
    pushOrderLookup({
      ...ORDER_OK,
      order_items: [
        { ...ORDER_OK.order_items[0], item_type: 'one_time', subscription_period: null },
      ],
    });
    pushBillingMethodLookup(BILLING_METHOD_OK);
    pushProfileLookup({ customer_key: CUSTOMER_KEY });
    await expect(
      chargeFirstCycle({ orderId: ORDER_ID, userId: USER_ID, billingMethodId: BILLING_METHOD_ID }),
    ).rejects.toMatchObject({ code: 'no_subscription_items' });
  });

  it('사전 중복 검증 — 기존 active 있으면 duplicate_subscription', async () => {
    pushOrderLookup(ORDER_OK);
    pushBillingMethodLookup(BILLING_METHOD_OK);
    pushProfileLookup({ customer_key: CUSTOMER_KEY });
    // 사전 중복 SELECT 결과 = 기존 row
    admin.pushMaybeSingle({ id: 'existing-sub-id' });

    await expect(
      chargeFirstCycle({ orderId: ORDER_ID, userId: USER_ID, billingMethodId: BILLING_METHOD_ID }),
    ).rejects.toMatchObject({ code: 'duplicate_subscription' });
  });

  it('Toss status≠DONE 이면 charge_not_done', async () => {
    pushOrderLookup(ORDER_OK);
    pushBillingMethodLookup(BILLING_METHOD_OK);
    pushProfileLookup({ customer_key: CUSTOMER_KEY });
    admin.pushMaybeSingle(null); // 사전 중복 X

    chargeBillingMock.mockResolvedValueOnce({
      paymentKey: PAYMENT_KEY,
      orderId: ORDER_NUMBER,
      status: 'ABORTED',
      totalAmount: 30000,
      balanceAmount: 0,
      approvedAt: null,
    });

    await expect(
      chargeFirstCycle({ orderId: ORDER_ID, userId: USER_ID, billingMethodId: BILLING_METHOD_ID }),
    ).rejects.toMatchObject({ code: 'charge_not_done' });
  });

  it('정상 흐름 — RPC 호출 + subscription_ids 반환', async () => {
    pushOrderLookup(ORDER_OK);
    pushBillingMethodLookup(BILLING_METHOD_OK);
    pushProfileLookup({ customer_key: CUSTOMER_KEY });
    admin.pushMaybeSingle(null); // 사전 중복 X

    chargeBillingMock.mockResolvedValueOnce({
      paymentKey: PAYMENT_KEY,
      orderId: ORDER_NUMBER,
      status: 'DONE',
      totalAmount: 30000,
      balanceAmount: 30000,
      approvedAt: '2026-05-07T12:00:00+09:00',
    });

    admin.pushRpc({ subscription_ids: [SUBSCRIPTION_ID] });

    const result = await chargeFirstCycle({
      orderId: ORDER_ID,
      userId: USER_ID,
      billingMethodId: BILLING_METHOD_ID,
    });

    expect(result).toEqual({
      paymentKey: PAYMENT_KEY,
      status: 'DONE',
      subscriptionIds: [SUBSCRIPTION_ID],
    });
    expect(admin.stub.rpc).toHaveBeenCalledWith(
      'process_billing_charge_success',
      expect.objectContaining({
        p_order_id: ORDER_ID,
        p_billing_method_id: BILLING_METHOD_ID,
        p_payment_key: PAYMENT_KEY,
        p_total_amount: 30000,
      }),
    );
    /* B(S341): 첫 결제 성공 후 orphan 정리 호출 — 방금 카드(keep) 보호 */
    expect(admin.stub.rpc).toHaveBeenCalledWith('cleanup_orphan_billing_methods', {
      p_user_id: USER_ID,
      p_keep_id: BILLING_METHOD_ID,
    });
  });
});

/* ════════════════════════════════════════════════════════════════════════
   cleanupOrphanBillingMethods (B · S341)
   ════════════════════════════════════════════════════════════════════════ */

describe('cleanupOrphanBillingMethods', () => {
  it('RPC 를 (user_id, keep_id) 인자로 호출한다', async () => {
    admin.pushRpc(2); // 2개 정리됨 (returns int)
    await cleanupOrphanBillingMethods(USER_ID, BILLING_METHOD_ID);
    expect(admin.stub.rpc).toHaveBeenCalledWith('cleanup_orphan_billing_methods', {
      p_user_id: USER_ID,
      p_keep_id: BILLING_METHOD_ID,
    });
  });

  it('RPC 에러여도 throw 하지 않는다 (fire-and-forget — 결제 흐름 보호)', async () => {
    admin.pushRpc(null, { code: 'XX000', message: 'boom' });
    await expect(
      cleanupOrphanBillingMethods(USER_ID, BILLING_METHOD_ID),
    ).resolves.toBeUndefined();
  });
});

