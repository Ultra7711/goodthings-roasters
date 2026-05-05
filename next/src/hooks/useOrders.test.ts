/* ══════════════════════════════════════════════════════════════════════════
   useOrders.test.ts — fetchOrders fetch adapter 검증

   대상: fetchOrders (fetch adapter function), ORDERS_QUERY_KEY
   비대상: useOrdersQuery hook (React hook — DOM 환경 불필요)
   ══════════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchOrders, ORDERS_QUERY_KEY } from '@/hooks/useOrders';
import type { Order } from '@/types/order';

afterEach(() => {
  vi.restoreAllMocks();
});

const STUB: Order[] = [
  {
    number: 'GT-20260506-00001',
    date: '2026.05.06',
    name: '에티오피아 예가체프',
    detail: '200g',
    price: '18,000원',
    priceNum: 18000,
    status: '배송중',
    items: [],
  },
];

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    }),
  );
}

/* ── query key ───────────────────────────────────────────────────────────── */

describe('ORDERS_QUERY_KEY', () => {
  it("['orders'] 튜플", () => {
    expect(ORDERS_QUERY_KEY).toEqual(['orders']);
  });
});

/* ── fetchOrders ─────────────────────────────────────────────────────────── */

describe('fetchOrders', () => {
  it('200 성공 — data 배열 반환', async () => {
    mockFetch(200, { data: STUB });
    const result = await fetchOrders();
    expect(result).toEqual(STUB);
  });

  it('data 없는 envelope → 빈 배열 반환', async () => {
    mockFetch(200, {});
    const result = await fetchOrders();
    expect(result).toEqual([]);
  });

  it('data: null → 빈 배열 반환', async () => {
    mockFetch(200, { data: null });
    const result = await fetchOrders();
    expect(result).toEqual([]);
  });

  it('401 오류 → throw', async () => {
    mockFetch(401, {});
    await expect(fetchOrders()).rejects.toThrow('orders_fetch_401');
  });

  it('500 오류 → throw', async () => {
    mockFetch(500, {});
    await expect(fetchOrders()).rejects.toThrow('orders_fetch_500');
  });

  it('네트워크 오류 → 전파', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(fetchOrders()).rejects.toThrow('offline');
  });

  it('/api/orders same-origin credentials 요청', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [] }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await fetchOrders();

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/orders');
    expect(init.credentials).toBe('same-origin');
  });
});
