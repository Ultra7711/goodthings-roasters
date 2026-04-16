/* ══════════════════════════════════════════
   auth/rateLimit 유닛 테스트 (P3-2)

   커버리지:
   - buildRateLimitResponse: 429 상태·헤더·JSON 바디·retryAfter 음수 방어
   - checkRateLimitWith: null/통과/초과 분기 + IP 추출 전달
   ══════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';
import { buildRateLimitResponse, checkRateLimitWith } from './rateLimit';

/* ══════════════════════════════════════════
   buildRateLimitResponse
   ══════════════════════════════════════════ */

describe('buildRateLimitResponse', () => {
  const RESET_FUTURE = Date.now() + 30_000; /* 30초 후 */

  it('429 상태 코드', () => {
    expect(buildRateLimitResponse(10, 0, RESET_FUTURE).status).toBe(429);
  });

  it('Content-Type: application/json', () => {
    const res = buildRateLimitResponse(10, 0, RESET_FUTURE);
    expect(res.headers.get('Content-Type')).toBe('application/json');
  });

  it('X-RateLimit-* 헤더 포함', () => {
    const res = buildRateLimitResponse(10, 0, RESET_FUTURE);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(res.headers.get('X-RateLimit-Reset')).toBe(String(RESET_FUTURE));
  });

  it('Retry-After 헤더 — 양수 정수', () => {
    const res = buildRateLimitResponse(10, 0, RESET_FUTURE);
    const retryAfter = Number(res.headers.get('Retry-After'));
    expect(retryAfter).toBeGreaterThan(0);
    expect(Number.isInteger(retryAfter)).toBe(true);
  });

  it('reset 이 과거 시점이면 retryAfter = 0 (음수 방어)', () => {
    const RESET_PAST = Date.now() - 1000;
    const res = buildRateLimitResponse(10, 0, RESET_PAST);
    expect(Number(res.headers.get('Retry-After'))).toBe(0);
  });

  it('JSON 바디 — error: rate_limited + retryAfter 숫자', async () => {
    const res = buildRateLimitResponse(10, 0, RESET_FUTURE);
    const body = await res.json() as { error: string; retryAfter: number };
    expect(body.error).toBe('rate_limited');
    expect(typeof body.retryAfter).toBe('number');
    expect(body.retryAfter).toBeGreaterThanOrEqual(0);
  });

  it('remaining 값이 헤더에 정확히 반영', () => {
    const res = buildRateLimitResponse(20, 5, RESET_FUTURE);
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('5');
  });
});

/* ══════════════════════════════════════════
   checkRateLimitWith
   ══════════════════════════════════════════ */

describe('checkRateLimitWith', () => {
  const RESET = Date.now() + 60_000;

  function makeReq(ip?: string): Request {
    const headers: Record<string, string> = ip
      ? { 'x-forwarded-for': ip }
      : {};
    return new Request('https://example.com', { headers });
  }

  function makeLimiter(success: boolean) {
    return {
      limit: async (_key: string) => ({
        success,
        limit: 10,
        remaining: success ? 9 : 0,
        reset: RESET,
      }),
    };
  }

  it('limiter=null → null (패스스루)', async () => {
    const res = await checkRateLimitWith(makeReq('1.2.3.4'), null);
    expect(res).toBeNull();
  });

  it('한도 내 (success: true) → null', async () => {
    const res = await checkRateLimitWith(makeReq('1.2.3.4'), makeLimiter(true));
    expect(res).toBeNull();
  });

  it('한도 초과 (success: false) → 429', async () => {
    const res = await checkRateLimitWith(makeReq('1.2.3.4'), makeLimiter(false));
    expect(res?.status).toBe(429);
  });

  it('IP 헤더 없으면 unknown 키로 limiter 호출', async () => {
    let capturedKey: string | undefined;
    const limiter = {
      limit: async (key: string) => {
        capturedKey = key;
        return { success: true, limit: 10, remaining: 9, reset: RESET };
      },
    };
    await checkRateLimitWith(makeReq(), limiter);
    expect(capturedKey).toBe('unknown');
  });

  it('x-forwarded-for 마지막 IP 를 limiter 에 전달 (Pass 1 H-3: Vercel edge 신뢰 IP)', async () => {
    let capturedKey: string | undefined;
    const limiter = {
      limit: async (key: string) => {
        capturedKey = key;
        return { success: true, limit: 10, remaining: 9, reset: RESET };
      },
    };
    await checkRateLimitWith(makeReq('5.6.7.8, 9.9.9.9'), limiter);
    expect(capturedKey).toBe('9.9.9.9');
  });

  it('한도 초과 응답에 X-RateLimit-Remaining: 0 포함', async () => {
    const res = await checkRateLimitWith(makeReq('1.2.3.4'), makeLimiter(false));
    expect(res?.headers.get('X-RateLimit-Remaining')).toBe('0');
  });
});
