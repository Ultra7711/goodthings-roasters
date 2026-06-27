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

/* subscriptions 조회 빌더 — select→eq→not→lte→order→limit(await). */
function makeAdmin(resp: { data: Array<{ id: string }> | null; error: unknown }) {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'not', 'lte', 'order']) b[m] = vi.fn(() => b);
  b.limit = vi.fn(() => Promise.resolve(resp));
  return { from: vi.fn(() => b) };
}

function makeReq(): Request {
  return new Request('https://x.test/api/billing/charge/run', { method: 'GET' });
}

const okResult = { orderId: 'o', orderNumber: 'GT-x', amount: 17500, nextDeliveryAt: 'd' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/billing/charge/run', () => {
  it('인증 실패 → 401', async () => {
    isCronMock.mockReturnValue(false);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('정상 순회 — 모두 성공', async () => {
    isCronMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(
      makeAdmin({ data: [{ id: 's1' }, { id: 's2' }], error: null }),
    );
    chargeMock.mockResolvedValue(okResult);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.charged).toBe(2);
    expect(body.data.failed).toBe(0);
    expect(body.data.total).toBe(2);
  });

  it('부분 실패 격리 — 1건 실패해도 나머지 진행, 200', async () => {
    isCronMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(
      makeAdmin({ data: [{ id: 's1' }, { id: 's2' }, { id: 's3' }], error: null }),
    );
    chargeMock
      .mockResolvedValueOnce(okResult)
      .mockRejectedValueOnce(new BillingServiceError('toss_charge_failed'))
      .mockResolvedValueOnce(okResult);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.charged).toBe(2);
    expect(body.data.failed).toBe(1);
    // 격리 — 실패 후에도 전부 시도
    expect(chargeMock).toHaveBeenCalledTimes(3);
  });

  it('멱등/보류는 skip 집계 (already_charged·no_default_address)', async () => {
    isCronMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(
      makeAdmin({ data: [{ id: 's1' }, { id: 's2' }], error: null }),
    );
    chargeMock
      .mockRejectedValueOnce(new BillingServiceError('already_charged_this_cycle'))
      .mockRejectedValueOnce(new BillingServiceError('no_default_address'));

    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.data.skipped).toBe(2);
    expect(body.data.failed).toBe(0);
    expect(body.data.charged).toBe(0);
  });

  it('도래 구독 없음 → charged 0', async () => {
    isCronMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(makeAdmin({ data: [], error: null }));

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.charged).toBe(0);
    expect(body.data.total).toBe(0);
  });

  it('구독 조회 실패 → 500', async () => {
    isCronMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(
      makeAdmin({ data: null, error: { message: 'db down' } }),
    );

    const res = await GET(makeReq());
    expect(res.status).toBe(500);
  });
});
