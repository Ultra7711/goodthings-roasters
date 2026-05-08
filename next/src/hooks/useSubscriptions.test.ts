/* ══════════════════════════════════════════════════════════════════════════
   useSubscriptions.test.ts — fetchSubscriptions fetch adapter 검증

   대상: fetchSubscriptions (fetch adapter function), SUBSCRIPTIONS_QUERY_KEY
   비대상: useMutation hooks (React hook — DOM 환경 불필요)
   ══════════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  fetchSubscriptions,
  SUBSCRIPTIONS_QUERY_KEY,
} from '@/hooks/useSubscriptions';
import type { Subscription } from '@/types/subscription';

afterEach(() => {
  vi.restoreAllMocks();
});

const STUB: Subscription[] = [
  {
    id: 'sub-1',
    slug: 'ethiopia-yirgacheffe',
    name: '에티오피아 예가체프',
    volume: '200g',
    cycle: '2주',
    status: 'active',
    nextDate: '2026.05.20',
    imageUrl: null,
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

describe('SUBSCRIPTIONS_QUERY_KEY', () => {
  it("['subscriptions'] 튜플", () => {
    expect(SUBSCRIPTIONS_QUERY_KEY).toEqual(['subscriptions']);
  });
});

/* ── fetchSubscriptions ──────────────────────────────────────────────────── */

describe('fetchSubscriptions', () => {
  it('200 성공 — data 배열 반환', async () => {
    mockFetch(200, { data: STUB });
    const result = await fetchSubscriptions();
    expect(result).toEqual(STUB);
  });

  it('data 없는 envelope → 빈 배열 반환', async () => {
    mockFetch(200, {});
    const result = await fetchSubscriptions();
    expect(result).toEqual([]);
  });

  it('data: null → 빈 배열 반환', async () => {
    mockFetch(200, { data: null });
    const result = await fetchSubscriptions();
    expect(result).toEqual([]);
  });

  it('401 오류 → throw', async () => {
    mockFetch(401, {});
    await expect(fetchSubscriptions()).rejects.toThrow('subscriptions_fetch_401');
  });

  it('500 오류 → throw', async () => {
    mockFetch(500, {});
    await expect(fetchSubscriptions()).rejects.toThrow('subscriptions_fetch_500');
  });

  it('네트워크 오류 → 전파', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(fetchSubscriptions()).rejects.toThrow('offline');
  });

  it('/api/subscriptions same-origin credentials 요청', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [] }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await fetchSubscriptions();

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/subscriptions');
    expect(init.credentials).toBe('same-origin');
  });
});
