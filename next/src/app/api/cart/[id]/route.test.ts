/* ══════════════════════════════════════════════════════════════════════════
   route.test.ts — /api/cart/[id] PATCH·DELETE (Session 12)
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
vi.mock('@/lib/repositories/cartRepo', () => ({
  updateCartItemQuantity: vi.fn(),
  deleteCartItem: vi.fn(),
}));

import { PATCH, DELETE } from './route';
import { enforceSameOrigin } from '@/lib/api/csrf';
import { checkRateLimit } from '@/lib/auth/rateLimit';
import { parseBody } from '@/lib/api/validate';
import { getClaims } from '@/lib/auth/getClaims';
import {
  updateCartItemQuantity,
  deleteCartItem,
} from '@/lib/repositories/cartRepo';

const enforceSameOriginMock = vi.mocked(enforceSameOrigin);
const checkRateLimitMock = vi.mocked(checkRateLimit);
const parseBodyMock = vi.mocked(parseBody);
const getClaimsMock = vi.mocked(getClaims);
const updateMock = vi.mocked(updateCartItemQuantity);
const deleteMock = vi.mocked(deleteCartItem);

const VALID_ID = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';

function makeRequest(method: 'PATCH' | 'DELETE'): Request {
  return new Request(`https://goodthings-roasters.com/api/cart/${VALID_ID}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      origin: 'https://goodthings-roasters.com',
    },
    body: method === 'PATCH' ? JSON.stringify({ quantity: 3 }) : undefined,
  });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  enforceSameOriginMock.mockReturnValue(null);
  checkRateLimitMock.mockResolvedValue(null);
  parseBodyMock.mockResolvedValue({
    success: true,
    data: { quantity: 3 },
  } as Awaited<ReturnType<typeof parseBody>>);
  getClaimsMock.mockResolvedValue({
    userId: 'u',
    email: 'e',
  } as Awaited<ReturnType<typeof getClaims>>);
});

describe('PATCH /api/cart/[id]', () => {
  it('미인증 → 401', async () => {
    getClaimsMock.mockResolvedValueOnce(null);
    const res = await PATCH(makeRequest('PATCH'), ctx(VALID_ID));
    expect(res.status).toBe(401);
  });

  it('비 UUID → 404', async () => {
    const res = await PATCH(makeRequest('PATCH'), ctx('not-a-uuid'));
    expect(res.status).toBe(404);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('repo null → 404', async () => {
    updateMock.mockResolvedValueOnce(null);
    const res = await PATCH(makeRequest('PATCH'), ctx(VALID_ID));
    expect(res.status).toBe(404);
  });

  it('성공 → 200', async () => {
    updateMock.mockResolvedValueOnce({
      id: VALID_ID,
      user_id: 'u',
      product_slug: 's',
      product_volume: '200g',
      quantity: 3,
      unit_price_snapshot: 100,
      item_type: 'normal',
      subscription_period: null,
      created_at: '',
      updated_at: '',
    });
    const res = await PATCH(makeRequest('PATCH'), ctx(VALID_ID));
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith(VALID_ID, 3);
  });
});

describe('DELETE /api/cart/[id]', () => {
  it('비 UUID → 404', async () => {
    const res = await DELETE(makeRequest('DELETE'), ctx('nope'));
    expect(res.status).toBe(404);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('repo false → 404', async () => {
    deleteMock.mockResolvedValueOnce(false);
    const res = await DELETE(makeRequest('DELETE'), ctx(VALID_ID));
    expect(res.status).toBe(404);
  });

  it('성공 → 200 deleted=true', async () => {
    deleteMock.mockResolvedValueOnce(true);
    const res = await DELETE(makeRequest('DELETE'), ctx(VALID_ID));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { deleted: boolean } };
    expect(body.data.deleted).toBe(true);
  });
});
