import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/cronAuth', () => ({ isCronRequest: vi.fn() }));
vi.mock('@/lib/services/billingService', async () => {
  class BillingServiceError extends Error {
    readonly code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
  return { BillingServiceError, chargeRecurringCycle: vi.fn() };
});

import { POST } from './route';
import { isCronRequest } from '@/lib/auth/cronAuth';
import {
  chargeRecurringCycle,
  BillingServiceError,
} from '@/lib/services/billingService';

const isCronMock = vi.mocked(isCronRequest);
const chargeMock = vi.mocked(chargeRecurringCycle);

const SUB_ID = '550e8400-e29b-41d4-a716-446655440000';

function makeReq(
  body: unknown,
  { cron = true }: { cron?: boolean } = {},
): Request {
  return new Request('https://goodthings-roasters.com/api/billing/charge/recurring', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cron ? { 'x-cron-secret': 'secret' } : {}),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/billing/charge/recurring', () => {
  it('401 — cron 인증 실패 (fail-closed)', async () => {
    isCronMock.mockReturnValueOnce(false);
    const res = await POST(makeReq({ subscriptionId: SUB_ID }, { cron: false }));
    expect(res.status).toBe(401);
    expect(chargeMock).not.toHaveBeenCalled();
  });

  it('400 — subscriptionId 형식 위반', async () => {
    isCronMock.mockReturnValueOnce(true);
    const res = await POST(makeReq({ subscriptionId: 'not-uuid' }));
    expect(res.status).toBe(400);
  });

  it('400 — invalid json', async () => {
    isCronMock.mockReturnValueOnce(true);
    const res = await POST(makeReq('{bad'));
    expect(res.status).toBe(400);
  });

  it('404 — subscription_not_found', async () => {
    isCronMock.mockReturnValueOnce(true);
    chargeMock.mockRejectedValueOnce(
      new BillingServiceError('subscription_not_found' as never),
    );
    const res = await POST(makeReq({ subscriptionId: SUB_ID }));
    expect(res.status).toBe(404);
  });

  it('409 — already_charged_this_cycle (멱등)', async () => {
    isCronMock.mockReturnValueOnce(true);
    chargeMock.mockRejectedValueOnce(
      new BillingServiceError('already_charged_this_cycle' as never),
    );
    const res = await POST(makeReq({ subscriptionId: SUB_ID }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.detail).toBe('already_charged_this_cycle');
  });

  it('409 — no_default_address (청구 보류)', async () => {
    isCronMock.mockReturnValueOnce(true);
    chargeMock.mockRejectedValueOnce(
      new BillingServiceError('no_default_address' as never),
    );
    const res = await POST(makeReq({ subscriptionId: SUB_ID }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.detail).toBe('no_default_address');
  });

  it('402 — toss_charge_failed', async () => {
    isCronMock.mockReturnValueOnce(true);
    chargeMock.mockRejectedValueOnce(
      new BillingServiceError('toss_charge_failed' as never),
    );
    const res = await POST(makeReq({ subscriptionId: SUB_ID }));
    expect(res.status).toBe(402);
  });

  it('200 — 정상 회차 청구', async () => {
    isCronMock.mockReturnValueOnce(true);
    chargeMock.mockResolvedValueOnce({
      orderId: 'b2c3d4e5-6789-4def-ab12-3456789abcde',
      orderNumber: 'GT-20260628-00001',
      amount: 19000,
      nextDeliveryAt: '2026-07-12T00:00:00.000Z',
    });
    const res = await POST(makeReq({ subscriptionId: SUB_ID }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.orderNumber).toBe('GT-20260628-00001');
    expect(body.data.nextDeliveryAt).toBe('2026-07-12T00:00:00.000Z');
  });
});
