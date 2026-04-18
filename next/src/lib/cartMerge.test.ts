/* ══════════════════════════════════════════════════════════════════════════
   cartMerge.test.ts — guest cart merge 클라이언트 헬퍼 (ADR-004 Step B)
   mergeGuestCartToServer(userId) — guestCart 를 내부에서 읽고 성공 시 clear.
   ══════════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CartItem } from '@/types/cart';

const guestStore: { items: CartItem[] } = { items: [] };

vi.mock('@/lib/guestCart', () => ({
  readGuestCart: () => guestStore.items,
  writeGuestCart: (items: CartItem[]) => {
    guestStore.items = items;
  },
  clearGuestCart: () => {
    guestStore.items = [];
  },
}));

import {
  toMergePayload,
  mergeGuestCartToServer,
  clearMergeFlag,
} from './cartMerge';

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: '1',
    slug: 'haenggwa',
    name: '행과',
    price: '18,000원',
    priceNum: 18000,
    qty: 2,
    color: '#ECEAE6',
    image: null,
    type: 'normal',
    period: null,
    category: '원두',
    volume: '200g',
    ...overrides,
  };
}

class MemorySessionStorage {
  private store = new Map<string, string>();
  getItem(k: string) {
    return this.store.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.store.set(k, v);
  }
  removeItem(k: string) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
}

beforeEach(() => {
  guestStore.items = [];
  const storage = new MemorySessionStorage();
  vi.stubGlobal('window', { sessionStorage: storage });
  vi.restoreAllMocks();
});

describe('toMergePayload', () => {
  it('converts CartItems to CartMergeInput shape', () => {
    const out = toMergePayload([
      makeItem(),
      makeItem({ id: '2', slug: 'yeonhwa', volume: '1kg', qty: 3 }),
    ]);
    expect(out).toEqual({
      items: [
        {
          productSlug: 'haenggwa',
          volume: '200g',
          quantity: 2,
          itemType: 'normal',
          subscriptionPeriod: null,
        },
        {
          productSlug: 'yeonhwa',
          volume: '1kg',
          quantity: 3,
          itemType: 'normal',
          subscriptionPeriod: null,
        },
      ],
    });
  });

  it('passes subscription period when itemType is subscription', () => {
    const out = toMergePayload([
      makeItem({ type: 'subscription', period: '2주' }),
    ]);
    expect(out?.items[0]).toMatchObject({
      itemType: 'subscription',
      subscriptionPeriod: '2주',
    });
  });

  it('clears period when itemType is normal even if stored', () => {
    const out = toMergePayload([makeItem({ type: 'normal', period: '2주' })]);
    expect(out?.items[0].subscriptionPeriod).toBeNull();
  });

  it('skips items with missing volume', () => {
    const out = toMergePayload([
      makeItem({ volume: null }),
      makeItem({ id: '2', slug: 'x' }),
    ]);
    expect(out?.items.length).toBe(1);
  });

  it('clamps quantity to [1,99]', () => {
    const out = toMergePayload([
      makeItem({ qty: 999 }),
      makeItem({ id: '2', slug: 'x', qty: 0 }),
    ]);
    expect(out?.items).toEqual([
      expect.objectContaining({ quantity: 99 }),
    ]);
  });

  it('returns null when no valid items', () => {
    expect(toMergePayload([])).toBeNull();
    expect(toMergePayload([makeItem({ volume: null })])).toBeNull();
  });
});

describe('mergeGuestCartToServer', () => {
  it('POSTs /api/cart/merge and clears guest cart on 200', async () => {
    guestStore.items = [makeItem()];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { merged: 2, skipped: 0 } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await mergeGuestCartToServer(USER_ID);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/cart/merge',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
      }),
    );
    expect(guestStore.items).toEqual([]);
    expect(result).toEqual({ status: 'ok', merged: 2, skipped: 0 });
  });

  it('skips API call when no items, sets flag', async () => {
    guestStore.items = [];
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await mergeGuestCartToServer(USER_ID);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'skipped', reason: 'no-items' });

    const second = await mergeGuestCartToServer(USER_ID);
    expect(second).toEqual({ status: 'skipped', reason: 'already-merged' });
  });

  it('does not POST twice for same user (flag)', async () => {
    guestStore.items = [makeItem()];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { merged: 1, skipped: 0 } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await mergeGuestCartToServer(USER_ID);
    guestStore.items = [makeItem()];
    await mergeGuestCartToServer(USER_ID);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not set flag on HTTP error → retries on next call', async () => {
    guestStore.items = [makeItem()];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { merged: 1, skipped: 0 } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const r1 = await mergeGuestCartToServer(USER_ID);
    expect(r1).toEqual({ status: 'error', detail: 'http_500' });

    const r2 = await mergeGuestCartToServer(USER_ID);
    expect(r2.status).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns error on fetch throw without setting flag', async () => {
    guestStore.items = [makeItem()];
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await mergeGuestCartToServer(USER_ID);
    expect(result).toEqual({ status: 'error', detail: 'network down' });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { merged: 1, skipped: 0 } }),
    });
    const retry = await mergeGuestCartToServer(USER_ID);
    expect(retry.status).toBe('ok');
  });

  it('uses per-user flag key (different user = independent retry)', async () => {
    guestStore.items = [makeItem()];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { merged: 1, skipped: 0 } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const USER_B = 'b1ffbc99-9c0b-4ef8-bb6d-6bb9bd380a22';
    await mergeGuestCartToServer(USER_ID);
    guestStore.items = [makeItem()];
    await mergeGuestCartToServer(USER_B);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('clearMergeFlag', () => {
  it('removes flag so next call re-executes', async () => {
    guestStore.items = [makeItem()];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { merged: 1, skipped: 0 } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await mergeGuestCartToServer(USER_ID);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    clearMergeFlag(USER_ID);
    guestStore.items = [makeItem()];
    await mergeGuestCartToServer(USER_ID);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
