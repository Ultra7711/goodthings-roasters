/* ══════════════════════════════════════════════════════════════════════════
   route.test.ts — /api/cart GET·POST 단위 테스트 (Session 12)
   ══════════════════════════════════════════════════════════════════════════ */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

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
  addCartItem: vi.fn(),
}));
vi.mock('@/lib/repositories/cartRepo', () => ({
  listCartItems: vi.fn(),
}));

import { GET, POST } from './route';
import { enforceSameOrigin } from '@/lib/api/csrf';
import { checkRateLimit } from '@/lib/auth/rateLimit';
import { parseBody } from '@/lib/api/validate';
import { getClaims } from '@/lib/auth/getClaims';
import { addCartItem } from '@/lib/services/cartService';
import { listCartItems } from '@/lib/repositories/cartRepo';
import { OrderServiceError } from '@/lib/services/orderService';

const enforceSameOriginMock = vi.mocked(enforceSameOrigin);
const checkRateLimitMock = vi.mocked(checkRateLimit);
const parseBodyMock = vi.mocked(parseBody);
const getClaimsMock = vi.mocked(getClaims);
const addCartItemMock = vi.mocked(addCartItem);
const listCartItemsMock = vi.mocked(listCartItems);

const USER_ID = '11111111-1111-1111-1111-111111111111';
const VALID_INPUT = {
  productSlug: 'brazil-yellow-bourbon',
  volume: '200g',
  quantity: 2,
  itemType: 'normal' as const,
  subscriptionPeriod: null,
};

function makeRequest(): Request {
  return new Request('https://goodthings-roasters.com/api/cart', {
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

describe('GET /api/cart', () => {
  it('미인증 → 401', async () => {
    getClaimsMock.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('200 + items 배열', async () => {
    listCartItemsMock.mockResolvedValueOnce([]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { items: unknown[] } };
    expect(body.data.items).toEqual([]);
  });

  it('repo 오류 → 500', async () => {
    listCartItemsMock.mockRejectedValueOnce(new Error('db'));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe('POST /api/cart', () => {
  it('CSRF 차단 → 403', async () => {
    enforceSameOriginMock.mockReturnValueOnce(
      new Response('{}', { status: 403 }),
    );
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
    expect(addCartItemMock).not.toHaveBeenCalled();
  });

  it('Rate Limit → 429', async () => {
    checkRateLimitMock.mockResolvedValueOnce(
      new NextResponse('{}', { status: 429 }),
    );
    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
    expect(checkRateLimitMock).toHaveBeenCalledWith(
      expect.any(Request),
      'cart_write',
    );
  });

  it('미인증 → 401', async () => {
    getClaimsMock.mockResolvedValueOnce(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it('zod 실패 → 400', async () => {
    parseBodyMock.mockResolvedValueOnce({
      success: false,
      response: new Response('{}', { status: 400 }),
    } as Awaited<ReturnType<typeof parseBody>>);
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
  });

  it('201 — addCartItem 호출 + item 반환', async () => {
    addCartItemMock.mockResolvedValueOnce({
      id: 'row-1',
      user_id: USER_ID,
      product_slug: VALID_INPUT.productSlug,
      product_volume: VALID_INPUT.volume,
      quantity: VALID_INPUT.quantity,
      unit_price_snapshot: 12800,
      item_type: 'normal',
      subscription_period: null,
      created_at: '2026-04-17T00:00:00.000Z',
      updated_at: '2026-04-17T00:00:00.000Z',
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(201);
    expect(addCartItemMock).toHaveBeenCalledWith(USER_ID, expect.objectContaining({
      productSlug: VALID_INPUT.productSlug,
    }));
    const body = (await res.json()) as { data: { item: { id: string } } };
    expect(body.data.item.id).toBe('row-1');
  });

  it('product_not_found → 409 + detail', async () => {
    addCartItemMock.mockRejectedValueOnce(
      new OrderServiceError('product_not_found', 'nope'),
    );
    const res = await POST(makeRequest());
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string; detail?: string };
    expect(body.error).toBe('conflict');
    expect(body.detail).toBe('product_not_found');
  });

  it('subscription_not_allowed → 400 validation_failed', async () => {
    addCartItemMock.mockRejectedValueOnce(
      new OrderServiceError('subscription_not_allowed', 'x'),
    );
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; detail?: string };
    expect(body.error).toBe('validation_failed');
  });

  it('Postgres 23505 (unique_violation) → 409 cart_concurrent_update', async () => {
    addCartItemMock.mockRejectedValueOnce({
      code: '23505',
      message: 'duplicate key value violates unique constraint',
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string; detail?: string };
    expect(body.error).toBe('conflict');
    expect(body.detail).toBe('cart_concurrent_update');
  });

  it('일반 에러 → 500', async () => {
    addCartItemMock.mockRejectedValueOnce(new Error('db'));
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });
});
