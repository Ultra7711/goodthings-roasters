/* ══════════════════════════════════════════
   auth/rateLimit 유닛 테스트 (P3-2)

   커버리지:
   - buildRateLimitResponse: 429 상태·헤더·JSON 바디·retryAfter 음수 방어
   - checkRateLimitWith: null/통과/초과 분기 + IP 추출 전달
   ══════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';
import {
  buildCardingKey,
  buildRateLimitResponse,
  checkCardingLimitWith,
  checkRateLimitWith,
  recordCardingAttemptWith,
} from './rateLimit';

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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

/* ══════════════════════════════════════════
   Carding RL — Session 8 보안 #1
   (docs/payments-security-hardening.md §2)
   ══════════════════════════════════════════ */

describe('buildCardingKey', () => {
  function makeReq(ip?: string): Request {
    const headers: Record<string, string> = ip ? { 'x-forwarded-for': ip } : {};
    return new Request('https://example.com', { headers });
  }

  it('로그인 유저: `{ip}:{userId}` 형태', () => {
    expect(buildCardingKey(makeReq('1.2.3.4'), 'user-uuid-123')).toBe(
      '1.2.3.4:user-uuid-123',
    );
  });

  it('게스트: userId=null → `{ip}:guest`', () => {
    expect(buildCardingKey(makeReq('1.2.3.4'), null)).toBe('1.2.3.4:guest');
  });

  it('IP 헤더 없음 → `unknown:guest` (IP 폴백)', () => {
    expect(buildCardingKey(makeReq(), null)).toBe('unknown:guest');
  });

  it('x-forwarded-for 체인: 마지막 IP 사용 (edge 신뢰)', () => {
    expect(
      buildCardingKey(makeReq('5.6.7.8, 9.9.9.9'), 'user-uuid-123'),
    ).toBe('9.9.9.9:user-uuid-123');
  });
});

describe('checkCardingLimitWith', () => {
  const RESET = Date.now() + 600_000; /* 10 분 */

  function makeReq(ip = '1.2.3.4'): Request {
    return new Request('https://example.com', {
      headers: { 'x-forwarded-for': ip },
    });
  }

  function makeLimiter(success: boolean, capturedKeys?: string[]) {
    return {
      limit: async (key: string) => {
        capturedKeys?.push(key);
        return {
          success,
          limit: 5,
          remaining: success ? 4 : 0,
          reset: RESET,
        };
      },
    };
  }

  it('limiter=null → null (Redis 미설정 패스스루)', async () => {
    const res = await checkCardingLimitWith(makeReq(), 'u1', null, true);
    expect(res).toBeNull();
  });

  it('한도 내 (success: true) → null (enforce 여부 무관)', async () => {
    const res = await checkCardingLimitWith(
      makeReq(),
      'u1',
      makeLimiter(true),
      true,
    );
    expect(res).toBeNull();
  });

  it('한도 초과 + enforce=true → 429 too_many_card_attempts', async () => {
    const res = await checkCardingLimitWith(
      makeReq(),
      'u1',
      makeLimiter(false),
      true,
    );
    expect(res?.status).toBe(429);
    const body = (await res!.json()) as { error: string; retryAfter: number };
    expect(body.error).toBe('too_many_card_attempts');
    expect(typeof body.retryAfter).toBe('number');
    expect(body.retryAfter).toBeGreaterThanOrEqual(0);
  });

  it('한도 초과 + enforce=false (dry-run) → null (카운트만 올라가고 차단 없음)', async () => {
    const captured: string[] = [];
    const res = await checkCardingLimitWith(
      makeReq(),
      'u1',
      makeLimiter(false, captured),
      false,
    );
    expect(res).toBeNull();
    /* dry-run 이어도 limit() 는 호출되어야 함 (카운트 증분) */
    expect(captured).toEqual(['1.2.3.4:u1']);
  });

  it('userId 로 키 빌드 — 로그인 유저와 게스트가 다른 버킷', async () => {
    const captured: string[] = [];
    const limiter = makeLimiter(true, captured);
    await checkCardingLimitWith(makeReq(), 'user-uuid-123', limiter, true);
    await checkCardingLimitWith(makeReq(), null, limiter, true);
    expect(captured).toEqual([
      '1.2.3.4:user-uuid-123',
      '1.2.3.4:guest',
    ]);
  });

  it('429 응답에 Retry-After 헤더 포함', async () => {
    const res = await checkCardingLimitWith(
      makeReq(),
      'u1',
      makeLimiter(false),
      true,
    );
    expect(res?.headers.get('Retry-After')).not.toBeNull();
    expect(Number(res!.headers.get('Retry-After'))).toBeGreaterThanOrEqual(0);
    expect(res?.headers.get('X-RateLimit-Limit')).toBe('5');
    expect(res?.headers.get('X-RateLimit-Remaining')).toBe('0');
  });
});

describe('recordCardingAttemptWith', () => {
  function makeReq(ip = '1.2.3.4'): Request {
    return new Request('https://example.com', {
      headers: { 'x-forwarded-for': ip },
    });
  }

  it('limiter=null → no-op (Redis 미설정)', async () => {
    /* throw 하지 않음을 검증 */
    await expect(
      recordCardingAttemptWith(makeReq(), 'u1', null),
    ).resolves.toBeUndefined();
  });

  it('limiter 제공 시 buildCardingKey 로 limit() 1회 호출 (증분)', async () => {
    const captured: string[] = [];
    const limiter = {
      limit: async (key: string) => {
        captured.push(key);
        return { success: true, limit: 5, remaining: 4, reset: Date.now() + 1000 };
      },
    };
    await recordCardingAttemptWith(makeReq(), 'user-uuid-123', limiter);
    expect(captured).toEqual(['1.2.3.4:user-uuid-123']);
  });

  it('게스트(userId=null) → `{ip}:guest` 키로 증분', async () => {
    const captured: string[] = [];
    const limiter = {
      limit: async (key: string) => {
        captured.push(key);
        return { success: true, limit: 5, remaining: 4, reset: Date.now() + 1000 };
      },
    };
    await recordCardingAttemptWith(makeReq(), null, limiter);
    expect(captured).toEqual(['1.2.3.4:guest']);
  });
});
