import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/csrf', () => ({ enforceSameOrigin: vi.fn() }));
vi.mock('@/lib/auth/getClaims', () => ({ getClaims: vi.fn() }));
vi.mock('@/lib/auth/rateLimit', () => ({ checkRateLimit: vi.fn() }));
vi.mock('@/lib/repositories/subscriptionRepo', () => ({
  reattachSubscriptionBilling: vi.fn(),
  /* route 로직만 검증 — toSubscription 은 통과(billingStatus 전달 확인) */
  toSubscription: vi.fn((row: { id: string }, billingStatus?: string) => ({
    id: row.id,
    billingStatus,
  })),
}));

import { POST } from './route';
import { enforceSameOrigin } from '@/lib/api/csrf';
import { getClaims } from '@/lib/auth/getClaims';
import { checkRateLimit } from '@/lib/auth/rateLimit';
import {
  reattachSubscriptionBilling,
  toSubscription,
} from '@/lib/repositories/subscriptionRepo';

const sameOriginMock = vi.mocked(enforceSameOrigin);
const claimsMock = vi.mocked(getClaims);
const rateLimitMock = vi.mocked(checkRateLimit);
const reattachMock = vi.mocked(reattachSubscriptionBilling);
const toSubMock = vi.mocked(toSubscription);

const SUB_ID = '550e8400-e29b-41d4-a716-446655440000';
const BM_ID = 'b2c3d4e5-6789-4def-ab12-3456789abcde';
const USER_ID = 'a1111111-2222-4333-8444-555566667777';

function makeReq(body: unknown): Request {
  return new Request(
    `https://goodthings-roasters.com/api/subscriptions/${SUB_ID}/reattach-billing`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    },
  );
}

function ctx(id: string = SUB_ID) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  sameOriginMock.mockReturnValue(null);
  rateLimitMock.mockResolvedValue(null as never);
  claimsMock.mockResolvedValue({ userId: USER_ID } as never);
  reattachMock.mockResolvedValue({ id: SUB_ID } as never);
});

describe('POST /api/subscriptions/[id]/reattach-billing', () => {
  it('403 — same-origin 위반 시 그대로 반환', async () => {
    sameOriginMock.mockReturnValueOnce(
      new Response(null, { status: 403 }) as never,
    );
    const res = await POST(makeReq({ billingMethodId: BM_ID }), ctx());
    expect(res.status).toBe(403);
    expect(reattachMock).not.toHaveBeenCalled();
  });

  it('429 — rate limit 초과 시 그대로 반환', async () => {
    rateLimitMock.mockResolvedValueOnce(
      new Response(null, { status: 429 }) as never,
    );
    const res = await POST(makeReq({ billingMethodId: BM_ID }), ctx());
    expect(res.status).toBe(429);
    expect(reattachMock).not.toHaveBeenCalled();
  });

  it('401 — 미인증', async () => {
    claimsMock.mockResolvedValueOnce(null as never);
    const res = await POST(makeReq({ billingMethodId: BM_ID }), ctx());
    expect(res.status).toBe(401);
    expect(reattachMock).not.toHaveBeenCalled();
  });

  it('400 — subscription id 형식 위반', async () => {
    const res = await POST(makeReq({ billingMethodId: BM_ID }), ctx('not-uuid'));
    expect(res.status).toBe(400);
    expect(reattachMock).not.toHaveBeenCalled();
  });

  it('400 — invalid json', async () => {
    const res = await POST(makeReq('{bad'), ctx());
    expect(res.status).toBe(400);
  });

  it('400 — billingMethodId 누락/형식 위반', async () => {
    const res = await POST(makeReq({ billingMethodId: 'nope' }), ctx());
    expect(res.status).toBe(400);
    expect(reattachMock).not.toHaveBeenCalled();
  });

  it('200 — 재연결 성공 + billingStatus=ok', async () => {
    const res = await POST(makeReq({ billingMethodId: BM_ID }), ctx());
    expect(res.status).toBe(200);
    expect(reattachMock).toHaveBeenCalledWith(SUB_ID, BM_ID);
    expect(toSubMock).toHaveBeenCalledWith({ id: SUB_ID }, 'ok');
    const body = await res.json();
    expect(body.data.billingStatus).toBe('ok');
  });

  it('404 — subscription not found (RPC raise)', async () => {
    reattachMock.mockRejectedValueOnce(
      new Error('reattach_subscription_billing: subscription not found (x)'),
    );
    const res = await POST(makeReq({ billingMethodId: BM_ID }), ctx());
    expect(res.status).toBe(404);
  });

  it('404 — billing_method invalid (RPC raise)', async () => {
    reattachMock.mockRejectedValueOnce(
      new Error('reattach_subscription_billing: billing_method invalid (x)'),
    );
    const res = await POST(makeReq({ billingMethodId: BM_ID }), ctx());
    expect(res.status).toBe(404);
  });

  it('409 — not reattachable (cancelled/expired)', async () => {
    reattachMock.mockRejectedValueOnce(
      new Error('reattach_subscription_billing: not reattachable (x : cancelled)'),
    );
    const res = await POST(makeReq({ billingMethodId: BM_ID }), ctx());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.detail).toBe('not_reattachable');
  });

  it('500 — 예기치 못한 오류', async () => {
    reattachMock.mockRejectedValueOnce(new Error('boom'));
    const res = await POST(makeReq({ billingMethodId: BM_ID }), ctx());
    expect(res.status).toBe(500);
  });
});
