/* ══════════════════════════════════════════════════════════════════════════
   useAccountDeletion.test.ts — postAccountDelete result.kind 분기 검증

   대상: postAccountDelete (fetch adapter function)
   비대상: useMutation hook (React hook — DOM 환경 불필요)
   ══════════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { postAccountDelete } from '@/hooks/useAccountDeletion';

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(status: number, body?: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body ?? {}),
    }),
  );
}

function mockFetchNetworkError() {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network_error')));
}

/* ── 성공 ───────────────────────────────────────────────────────────────── */

describe('200 성공', () => {
  it('kind: success 반환', async () => {
    mockFetch(200);
    const result = await postAccountDelete();
    expect(result.kind).toBe('success');
  });
});

/* ── 409 분기 ────────────────────────────────────────────────────────────── */

describe('409 subscription_active', () => {
  it('detail=subscription_active → kind: subscription_active', async () => {
    mockFetch(409, { detail: 'subscription_active' });
    const result = await postAccountDelete();
    expect(result.kind).toBe('subscription_active');
  });

  it('detail 불일치 → kind: error', async () => {
    mockFetch(409, { detail: 'other_reason' });
    const result = await postAccountDelete();
    expect(result.kind).toBe('error');
  });

  it('body 없음 → kind: error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: () => Promise.reject(new Error('parse_error')),
      }),
    );
    const result = await postAccountDelete();
    expect(result.kind).toBe('error');
  });
});

/* ── 429 ────────────────────────────────────────────────────────────────── */

describe('429 rate_limited', () => {
  it('kind: rate_limited 반환', async () => {
    mockFetch(429);
    const result = await postAccountDelete();
    expect(result.kind).toBe('rate_limited');
  });
});

/* ── 기타 오류 ───────────────────────────────────────────────────────────── */

describe('500 서버 오류', () => {
  it('kind: error 반환', async () => {
    mockFetch(500);
    const result = await postAccountDelete();
    expect(result.kind).toBe('error');
  });
});

describe('네트워크 오류', () => {
  it('fetch throw → 상위로 전파 (mutateAsync caller 처리)', async () => {
    mockFetchNetworkError();
    await expect(postAccountDelete()).rejects.toThrow('network_error');
  });
});

/* ── 요청 형식 ───────────────────────────────────────────────────────────── */

describe('요청 본문', () => {
  it('confirm: "탈퇴" JSON body + POST method 전송', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await postAccountDelete();

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/account/delete');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ confirm: '탈퇴' });
  });
});
