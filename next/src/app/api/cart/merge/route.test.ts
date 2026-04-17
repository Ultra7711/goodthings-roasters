/* ══════════════════════════════════════════════════════════════════════════
   route.test.ts — POST /api/cart/merge (Session 12)
   ══════════════════════════════════════════════════════════════════════════ */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/csrf', () => ({
  enforceSameOrigin: vi.fn(() => null),
}));
vi.mock('@/lib/auth/rateLimit', () => ({
  checkRateLimit: vi.fn(async () => null),
}));
vi.mock('@/lib/api/validate', () => ({
  parseBody: vi.fn(),
}));
vi.mock('@/lib/auth/getClaims', () => ({
  getClaims: vi.fn(),
}));
vi.mock('@/lib/services/cartService', () => ({
  mergeGuestCart: vi.fn(),
}));

import { POST } from './route';
import { enforceSameOrigin } from '@/lib/api/csrf';
import { checkRateLimit } from '@/lib/auth/rateLimit';
import { parseBody } from '@/lib/api/validate';
import { getClaims } from '@/lib/auth/getClaims';
import { mergeGuestCart } from '@/lib/services/cartService';

const enforceSameOriginMock = vi.mocked(enforceSameOrigin);
const checkRateLimitMock = vi.mocked(checkRateLimit);
const parseBodyMock = vi.mocked(parseBody);
const getClaimsMock = vi.mocked(getClaims);
const mergeMock = vi.mocked(mergeGuestCart);

const USER_ID = '11111111-1111-1111-1111-111111111111';
const VALID_INPUT = {
  items: [
    {
      productSlug: 's',
      volume: '200g',
      quantity: 1,
      itemType: 'normal' as const,
      subscriptionPeriod: null,
    },
  ],
};

function makeRequest(): Request {
  return new Request('https://goodthings-roasters.com/api/cart/merge', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      origin: 'https://goodthings-roasters.com',
    },
    body: JSON.stringify(VALID_INPUT),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  enforceSameOriginMock.mockReturnValue(null);
  checkRateLimitMock.mockResolvedValue(null);
  parseBodyMock.mockResolvedValue({
    success: true,
    data: { ...VALID_INPUT },
  } as Awaited<ReturnType<typeof parseBody>>);
  getClaimsMock.mockResolvedValue({
    userId: USER_ID,
    email: 'a@b.c',
  } as Awaited<ReturnType<typeof getClaims>>);
});

describe('POST /api/cart/merge', () => {
  it('미인증 → 401', async () => {
    getClaimsMock.mockResolvedValueOnce(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it('CSRF → 403', async () => {
    enforceSameOriginMock.mockReturnValueOnce(
      new Response('{}', { status: 403 }),
    );
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
  });

  it('성공 → 200 merged/skipped', async () => {
    mergeMock.mockResolvedValueOnce({ merged: 1, skipped: 0 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { merged: number; skipped: number } };
    expect(body.data).toEqual({ merged: 1, skipped: 0 });
    expect(mergeMock).toHaveBeenCalledWith(USER_ID, expect.objectContaining({
      items: expect.any(Array),
    }));
  });

  it('서비스 에러 → 500', async () => {
    mergeMock.mockRejectedValueOnce(new Error('db'));
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });
});
