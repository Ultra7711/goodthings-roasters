import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/getClaims', () => ({ getClaims: vi.fn() }));
vi.mock('@/lib/services/billingService', () => ({ listBillingMethods: vi.fn() }));

import { GET } from './route';
import { getClaims } from '@/lib/auth/getClaims';
import { listBillingMethods } from '@/lib/services/billingService';

const getClaimsMock = vi.mocked(getClaims);
const listBillingMethodsMock = vi.mocked(listBillingMethods);

const USER_ID = '11111111-1111-1111-1111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/billing/methods', () => {
  it('401 unauthorized', async () => {
    getClaimsMock.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('200 — methods 배열 응답 (billing_key 노출 X)', async () => {
    getClaimsMock.mockResolvedValueOnce({ userId: USER_ID } as never);
    listBillingMethodsMock.mockResolvedValueOnce([
      {
        id: 'bm-1',
        method: 'card',
        cardCompany: '11',
        cardNumberMasked: '****-****-****-1234',
        bankName: null,
        accountNumberMasked: null,
        isDefault: true,
        expiresAt: null,
        registeredAt: '2026-05-07T12:00:00+00:00',
      },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.methods).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain('billing_key');
  });

  it('500 — service 예외', async () => {
    getClaimsMock.mockResolvedValueOnce({ userId: USER_ID } as never);
    listBillingMethodsMock.mockRejectedValueOnce(new Error('db'));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
