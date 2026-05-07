import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/csrf', () => ({ enforceSameOrigin: vi.fn(() => null) }));
vi.mock('@/lib/auth/rateLimit', () => ({ checkRateLimit: vi.fn(async () => null) }));
vi.mock('@/lib/auth/getClaims', () => ({ getClaims: vi.fn() }));
vi.mock('@/lib/services/billingService', async () => {
  class BillingServiceError extends Error {
    readonly code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
  return { BillingServiceError, chargeFirstCycle: vi.fn() };
});

import { POST } from './route';
import { getClaims } from '@/lib/auth/getClaims';
import { chargeFirstCycle, BillingServiceError } from '@/lib/services/billingService';

const getClaimsMock = vi.mocked(getClaims);
const chargeFirstCycleMock = vi.mocked(chargeFirstCycle);

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const ORDER_ID = 'b2c3d4e5-6789-4def-ab12-3456789abcde';
const BILLING_METHOD_ID = 'a1b2c3d4-5678-4abc-9def-123456789012';

function makePostRequest(body: unknown): Request {
  return new Request('https://goodthings-roasters.com/api/billing/charge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin: 'https://goodthings-roasters.com' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/billing/charge', () => {
  it('401 unauthorized', async () => {
    getClaimsMock.mockResolvedValueOnce(null);
    const res = await POST(
      makePostRequest({ orderId: ORDER_ID, billingMethodId: BILLING_METHOD_ID }),
    );
    expect(res.status).toBe(401);
  });

  it('400 validation_failed — orderId 형식 위반', async () => {
    getClaimsMock.mockResolvedValueOnce({ userId: USER_ID } as never);
    const res = await POST(
      makePostRequest({ orderId: 'not-uuid', billingMethodId: BILLING_METHOD_ID }),
    );
    expect(res.status).toBe(400);
  });

  it('404 order_not_found', async () => {
    getClaimsMock.mockResolvedValueOnce({ userId: USER_ID } as never);
    chargeFirstCycleMock.mockRejectedValueOnce(
      new BillingServiceError('order_not_found' as never),
    );
    const res = await POST(
      makePostRequest({ orderId: ORDER_ID, billingMethodId: BILLING_METHOD_ID }),
    );
    expect(res.status).toBe(404);
  });

  it('409 duplicate_subscription', async () => {
    getClaimsMock.mockResolvedValueOnce({ userId: USER_ID } as never);
    chargeFirstCycleMock.mockRejectedValueOnce(
      new BillingServiceError('duplicate_subscription' as never),
    );
    const res = await POST(
      makePostRequest({ orderId: ORDER_ID, billingMethodId: BILLING_METHOD_ID }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.detail).toBe('duplicate_subscription');
  });

  it('402 charge_not_done', async () => {
    getClaimsMock.mockResolvedValueOnce({ userId: USER_ID } as never);
    chargeFirstCycleMock.mockRejectedValueOnce(
      new BillingServiceError('charge_not_done' as never),
    );
    const res = await POST(
      makePostRequest({ orderId: ORDER_ID, billingMethodId: BILLING_METHOD_ID }),
    );
    expect(res.status).toBe(402);
  });

  it('200 정상', async () => {
    getClaimsMock.mockResolvedValueOnce({ userId: USER_ID } as never);
    chargeFirstCycleMock.mockResolvedValueOnce({
      paymentKey: 'pk_test',
      status: 'DONE',
      subscriptionIds: ['sub-1'],
    });
    const res = await POST(
      makePostRequest({ orderId: ORDER_ID, billingMethodId: BILLING_METHOD_ID }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.paymentKey).toBe('pk_test');
    expect(body.data.subscriptionIds).toEqual(['sub-1']);
  });
});
