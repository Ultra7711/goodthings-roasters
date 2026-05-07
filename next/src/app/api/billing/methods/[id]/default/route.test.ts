import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/csrf', () => ({ enforceSameOrigin: vi.fn(() => null) }));
vi.mock('@/lib/auth/rateLimit', () => ({ checkRateLimit: vi.fn(async () => null) }));
vi.mock('@/lib/auth/getClaims', () => ({ getClaims: vi.fn() }));
vi.mock('@/lib/services/billingService', () => {
  class BillingServiceError extends Error {
    readonly code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
  return { BillingServiceError, setDefaultBillingMethod: vi.fn() };
});

import { POST } from './route';
import { getClaims } from '@/lib/auth/getClaims';
import {
  setDefaultBillingMethod,
  BillingServiceError,
} from '@/lib/services/billingService';

const getClaimsMock = vi.mocked(getClaims);
const setDefaultMock = vi.mocked(setDefaultBillingMethod);

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const BM_ID = 'a1b2c3d4-5678-4abc-9def-123456789012';

function makeReq(): Request {
  return new Request(
    `https://goodthings-roasters.com/api/billing/methods/${BM_ID}/default`,
    {
      method: 'POST',
      headers: { origin: 'https://goodthings-roasters.com' },
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/billing/methods/[id]/default', () => {
  it('401 unauthorized', async () => {
    getClaimsMock.mockResolvedValueOnce(null);
    const res = await POST(makeReq(), { params: Promise.resolve({ id: BM_ID }) });
    expect(res.status).toBe(401);
  });

  it('404 billing_method_not_found', async () => {
    getClaimsMock.mockResolvedValueOnce({ userId: USER_ID } as never);
    setDefaultMock.mockRejectedValueOnce(
      new BillingServiceError('billing_method_not_found' as never),
    );
    const res = await POST(makeReq(), { params: Promise.resolve({ id: BM_ID }) });
    expect(res.status).toBe(404);
  });

  it('200 정상', async () => {
    getClaimsMock.mockResolvedValueOnce({ userId: USER_ID } as never);
    setDefaultMock.mockResolvedValueOnce(undefined);
    const res = await POST(makeReq(), { params: Promise.resolve({ id: BM_ID }) });
    expect(res.status).toBe(200);
  });
});
