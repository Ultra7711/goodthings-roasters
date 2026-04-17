/* ══════════════════════════════════════════════════════════════════════════
   route.test.ts — POST /api/admin/orders/[orderNumber]/ship (Session 8-B B-2)

   커버리지:
   - 401 — x-admin-secret 누락
   - 404 — orderNumber 포맷 오류
   - 400 — body 검증 실패 (trackingNumber 빈 문자열)
   - 404 — orders 조회 결과 없음
   - 409 — RPC illegal_state:{current}
   - 200 — 정상 출고 + 배송 알림 훅 호출 확인
   ══════════════════════════════════════════════════════════════════════════ */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/adminAuth', () => ({
  isAdminRequest: vi.fn(),
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock('@/lib/email/notifications', () => ({
  sendShippingNotificationEmail: vi.fn(async () => undefined),
}));

import { POST } from './route';
import { isAdminRequest } from '@/lib/auth/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendShippingNotificationEmail } from '@/lib/email/notifications';

const isAdminRequestMock = vi.mocked(isAdminRequest);
const getSupabaseAdminMock = vi.mocked(getSupabaseAdmin);
const sendShippingMock = vi.mocked(sendShippingNotificationEmail);

function makeRequest(body: unknown, opts?: { withSecret?: boolean }): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts?.withSecret !== false) headers['x-admin-secret'] = 'secret';
  return new Request(
    'https://goodthings-roasters.com/api/admin/orders/GT-20260417-00001/ship',
    {
      method: 'POST',
      headers,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    },
  );
}

function makeParams(orderNumber: string) {
  return { params: Promise.resolve({ orderNumber }) };
}

type AdminStubOpts = {
  orderRow?: { id: string } | null;
  lookupError?: { code: string } | null;
  rpcError?: { message: string; code?: string } | null;
  rpcData?: unknown;
};

function makeAdminStub(opts: AdminStubOpts = {}) {
  const single = vi.fn(async () => ({
    data: opts.orderRow ?? { id: 'order-uuid-1' },
    error: opts.lookupError ?? null,
  }));
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const rpc = vi.fn(async () => ({
    data:
      opts.rpcData ??
      { order_number: 'GT-20260417-00001', shipped_at: '2026-04-17T12:00:00Z' },
    error: opts.rpcError ?? null,
  }));
  return { from, rpc } as unknown as ReturnType<typeof getSupabaseAdmin>;
}

describe('POST /api/admin/orders/[orderNumber]/ship', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdminRequestMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(makeAdminStub());
  });

  afterAll(() => {
    vi.resetAllMocks();
  });

  it('401 — x-admin-secret 불일치 시 unauthorized', async () => {
    isAdminRequestMock.mockReturnValueOnce(false);
    const res = await POST(
      makeRequest({ trackingNumber: '123456', carrier: 'CJ' }),
      makeParams('GT-20260417-00001'),
    );
    expect(res.status).toBe(401);
  });

  it('404 — orderNumber 포맷 오류', async () => {
    const res = await POST(
      makeRequest({ trackingNumber: '123456', carrier: 'CJ' }),
      makeParams('BAD-FORMAT'),
    );
    expect(res.status).toBe(404);
  });

  it('400 — trackingNumber 빈 문자열 validation_failed', async () => {
    const res = await POST(
      makeRequest({ trackingNumber: '  ', carrier: 'CJ' }),
      makeParams('GT-20260417-00001'),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('validation_failed');
  });

  it('404 — orders 조회 결과 없음', async () => {
    getSupabaseAdminMock.mockReturnValue(
      makeAdminStub({ orderRow: null, lookupError: { code: 'PGRST116' } }),
    );
    const res = await POST(
      makeRequest({ trackingNumber: '123456', carrier: 'CJ' }),
      makeParams('GT-20260417-00001'),
    );
    expect(res.status).toBe(404);
  });

  it('409 — RPC illegal_state:{current} conflict', async () => {
    getSupabaseAdminMock.mockReturnValue(
      makeAdminStub({
        rpcError: { message: 'illegal_state:pending', code: 'P0001' },
      }),
    );
    const res = await POST(
      makeRequest({ trackingNumber: '123456', carrier: 'CJ' }),
      makeParams('GT-20260417-00001'),
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string; detail?: string };
    expect(body.error).toBe('conflict');
    expect(body.detail).toBe('illegal_state:pending');
  });

  it('200 — 정상 출고 + 배송 알림 훅 호출', async () => {
    const res = await POST(
      makeRequest({ trackingNumber: '123456789012', carrier: 'CJ대한통운' }),
      makeParams('GT-20260417-00001'),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        orderNumber: string;
        shippedAt: string | null;
        trackingNumber: string;
        carrier: string;
      };
    };
    expect(body.data.orderNumber).toBe('GT-20260417-00001');
    expect(body.data.trackingNumber).toBe('123456789012');
    expect(body.data.carrier).toBe('CJ대한통운');
    expect(body.data.shippedAt).toBe('2026-04-17T12:00:00Z');

    expect(sendShippingMock).toHaveBeenCalledWith('GT-20260417-00001', {
      trackingNumber: '123456789012',
      carrier: 'CJ대한통운',
    });
  });

  it('400 — invalid_json body', async () => {
    const res = await POST(
      makeRequest('not-json'),
      makeParams('GT-20260417-00001'),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; detail?: string };
    expect(body.detail).toBe('invalid_json');
  });
});
