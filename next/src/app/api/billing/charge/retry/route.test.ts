import { beforeEach, describe, expect, it, vi } from 'vitest';

/* ── 의존 모듈 mock ────────────────────────────────────────────────────── */

const isCronMock = vi.fn();
vi.mock('@/lib/auth/cronAuth', () => ({
  isCronRequest: () => isCronMock(),
}));

const getSupabaseAdminMock = vi.fn();
vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => getSupabaseAdminMock(),
}));

const chargeMock = vi.fn();
vi.mock('@/lib/services/billingService', async (orig) => {
  const actual = await orig<typeof import('@/lib/services/billingService')>();
  return {
    ...actual,
    chargeRecurringCycle: (...args: unknown[]) => chargeMock(...args),
  };
});

import { GET } from './route';
import { BillingServiceError } from '@/lib/services/billingService';

/* subscription_billing_failures 조회 빌더 — select→lte→is→order→limit(await). */
function makeAdmin(resp: { data: Array<{ subscription_id: string }> | null; error: unknown }) {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'lte', 'is', 'order']) b[m] = vi.fn(() => b);
  b.limit = vi.fn(() => Promise.resolve(resp));
  return { from: vi.fn(() => b) };
}

function makeReq(): Request {
  return new Request('https://x.test/api/billing/charge/retry', { method: 'GET' });
}

const okResult = { orderId: 'o', orderNumber: 'GT-x', amount: 17500, nextDeliveryAt: 'd' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/billing/charge/retry', () => {
  it('인증 실패 → 401', async () => {
    isCronMock.mockReturnValue(false);
    expect((await GET(makeReq())).status).toBe(401);
  });

  it('미해결 실패 재시도 — 구독 단위 dedup 후 재청구', async () => {
    isCronMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(
      makeAdmin({
        data: [
          { subscription_id: 's1' },
          { subscription_id: 's1' }, // 같은 구독 중복 실패 행
          { subscription_id: 's2' },
        ],
        error: null,
      }),
    );
    chargeMock.mockResolvedValue(okResult);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.recovered).toBe(2); // s1·s2 dedup
    expect(body.data.total).toBe(2);
    expect(chargeMock).toHaveBeenCalledTimes(2);
  });

  it('재실패 격리 + stillFailing 집계', async () => {
    isCronMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(
      makeAdmin({ data: [{ subscription_id: 's1' }, { subscription_id: 's2' }], error: null }),
    );
    chargeMock
      .mockResolvedValueOnce(okResult)
      .mockRejectedValueOnce(new BillingServiceError('toss_charge_failed'));

    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.data.recovered).toBe(1);
    expect(body.data.stillFailing).toBe(1);
    expect(chargeMock).toHaveBeenCalledTimes(2); // 격리
  });

  it('멱등/보류는 skip 집계', async () => {
    isCronMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(
      makeAdmin({ data: [{ subscription_id: 's1' }], error: null }),
    );
    chargeMock.mockRejectedValueOnce(new BillingServiceError('already_charged_this_cycle'));

    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.data.skipped).toBe(1);
    expect(body.data.recovered).toBe(0);
    expect(body.data.stillFailing).toBe(0);
  });

  it('빈 재시도 큐 → recovered 0', async () => {
    isCronMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(makeAdmin({ data: [], error: null }));

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    expect((await res.json()).data.total).toBe(0);
  });

  it('실패 큐 조회 실패 → 500', async () => {
    isCronMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(makeAdmin({ data: null, error: { message: 'db down' } }));
    expect((await GET(makeReq())).status).toBe(500);
  });
});
