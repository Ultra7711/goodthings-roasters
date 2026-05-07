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
  return {
    BillingServiceError,
    issueBillingMethod: vi.fn(),
  };
});

import { POST } from './route';
import { getClaims } from '@/lib/auth/getClaims';
import {
  issueBillingMethod,
  BillingServiceError,
} from '@/lib/services/billingService';

const getClaimsMock = vi.mocked(getClaims);
const issueBillingMethodMock = vi.mocked(issueBillingMethod);

const USER_ID = '11111111-1111-1111-1111-111111111111';
const CUSTOMER_KEY = 'cus_22222222-2222-2222-2222-222222222222';

function makePostRequest(body: unknown): Request {
  return new Request('https://goodthings-roasters.com/api/billing/authorizations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin: 'https://goodthings-roasters.com' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/billing/authorizations', () => {
  it('401 unauthorized', async () => {
    getClaimsMock.mockResolvedValueOnce(null);
    const res = await POST(makePostRequest({ authKey: 'k', customerKey: CUSTOMER_KEY }));
    expect(res.status).toBe(401);
  });

  it('400 invalid_json', async () => {
    getClaimsMock.mockResolvedValueOnce({ userId: USER_ID } as never);
    const res = await POST(makePostRequest('not-json'));
    expect(res.status).toBe(400);
  });

  it('400 validation_failed — customerKey 형식 위반', async () => {
    getClaimsMock.mockResolvedValueOnce({ userId: USER_ID } as never);
    const res = await POST(makePostRequest({ authKey: 'k', customerKey: 'bad customer key!' }));
    expect(res.status).toBe(400);
  });

  it('403 customer_key_mismatch', async () => {
    getClaimsMock.mockResolvedValueOnce({ userId: USER_ID } as never);
    issueBillingMethodMock.mockRejectedValueOnce(
      new BillingServiceError('customer_key_mismatch' as never),
    );
    const res = await POST(makePostRequest({ authKey: 'k', customerKey: CUSTOMER_KEY }));
    expect(res.status).toBe(403);
  });

  it('402 toss_authorization_failed', async () => {
    getClaimsMock.mockResolvedValueOnce({ userId: USER_ID } as never);
    issueBillingMethodMock.mockRejectedValueOnce(
      new BillingServiceError('toss_authorization_failed' as never),
    );
    const res = await POST(makePostRequest({ authKey: 'k', customerKey: CUSTOMER_KEY }));
    expect(res.status).toBe(402);
  });

  it('201 정상', async () => {
    getClaimsMock.mockResolvedValueOnce({ userId: USER_ID } as never);
    issueBillingMethodMock.mockResolvedValueOnce({
      billingMethodId: 'bm-123',
      isDefault: true,
    });
    const res = await POST(makePostRequest({ authKey: 'k', customerKey: CUSTOMER_KEY }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toEqual({ billingMethodId: 'bm-123', isDefault: true });
  });
});
