/* ══════════════════════════════════════════════════════════════════════════
   dispatch.test.ts — dispatchOrder 비즈니스 로직 unit test (S166 PR-1)

   커버리지:
   - validation_failed — orderNumber 포맷 오류 / trackingNumber 빈 문자열
   - not_found — orders 조회 결과 없음
   - illegal_state — RPC illegal_state:{current}
   - invalid_tracking — RPC invalid_tracking
   - server_error — RPC 기타 에러
   - ok — 정상 출고 + 배송 알림 메일 호출
   ══════════════════════════════════════════════════════════════════════════ */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock('@/lib/email/notifications', () => ({
  sendShippingNotificationEmail: vi.fn(async () => undefined),
}));

import { dispatchOrder } from './dispatch';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendShippingNotificationEmail } from '@/lib/email/notifications';

const getSupabaseAdminMock = vi.mocked(getSupabaseAdmin);
const sendShippingMock = vi.mocked(sendShippingNotificationEmail);

type AdminStubOpts = {
  orderRow?: { id: string } | null;
  lookupError?: { code: string } | null;
  rpcError?: { message: string; code?: string } | null;
  rpcData?: unknown;
};

function makeAdminStub(opts: AdminStubOpts = {}) {
  const maybeSingle = vi.fn(async () => ({
    data: opts.orderRow ?? { id: 'order-uuid-1' },
    error: opts.lookupError ?? null,
  }));
  const eq = vi.fn(() => ({ maybeSingle }));
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

const VALID_INPUT = {
  orderNumber: 'GT-20260417-00001',
  trackingNumber: '123456789012',
  carrier: 'CJ대한통운',
};

describe('dispatchOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseAdminMock.mockReturnValue(makeAdminStub());
  });

  afterAll(() => {
    vi.resetAllMocks();
  });

  it('validation_failed — orderNumber 포맷 오류', async () => {
    const result = await dispatchOrder({ ...VALID_INPUT, orderNumber: 'BAD' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('validation_failed');
    }
  });

  it('validation_failed — trackingNumber 빈 문자열', async () => {
    const result = await dispatchOrder({ ...VALID_INPUT, trackingNumber: '   ' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('validation_failed');
    }
  });

  it('not_found — orders 조회 결과 없음', async () => {
    getSupabaseAdminMock.mockReturnValue(
      makeAdminStub({ orderRow: null, lookupError: { code: 'PGRST116' } }),
    );
    const result = await dispatchOrder(VALID_INPUT);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('not_found');
    }
  });

  it('illegal_state — RPC illegal_state:{current}', async () => {
    getSupabaseAdminMock.mockReturnValue(
      makeAdminStub({
        rpcError: { message: 'illegal_state:pending', code: 'P0001' },
      }),
    );
    const result = await dispatchOrder(VALID_INPUT);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('illegal_state');
      expect(result.detail).toBe('pending');
    }
  });

  it('invalid_tracking — RPC invalid_tracking', async () => {
    getSupabaseAdminMock.mockReturnValue(
      makeAdminStub({
        rpcError: { message: 'invalid_tracking', code: 'P0001' },
      }),
    );
    const result = await dispatchOrder(VALID_INPUT);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('invalid_tracking');
    }
  });

  it('not_found — RPC order_not_found', async () => {
    getSupabaseAdminMock.mockReturnValue(
      makeAdminStub({
        rpcError: { message: 'order_not_found', code: 'P0001' },
      }),
    );
    const result = await dispatchOrder(VALID_INPUT);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('not_found');
    }
  });

  it('server_error — RPC 기타 에러', async () => {
    getSupabaseAdminMock.mockReturnValue(
      makeAdminStub({
        rpcError: { message: 'unexpected db error', code: 'XX000' },
      }),
    );
    const result = await dispatchOrder(VALID_INPUT);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('server_error');
    }
  });

  it('ok — 정상 출고 + 배송 알림 메일 호출', async () => {
    const result = await dispatchOrder(VALID_INPUT);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.orderNumber).toBe('GT-20260417-00001');
      expect(result.data.trackingNumber).toBe('123456789012');
      expect(result.data.carrier).toBe('CJ대한통운');
      expect(result.data.shippedAt).toBe('2026-04-17T12:00:00Z');
    }
    expect(sendShippingMock).toHaveBeenCalledWith('GT-20260417-00001', {
      trackingNumber: '123456789012',
      carrier: 'CJ대한통운',
    });
  });
});
