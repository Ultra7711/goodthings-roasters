/* ══════════════════════════════════════════
   auth/rateLimit — IP 기반 Rate Limiting (P3-2)

   라이브러리: @upstash/ratelimit + @upstash/redis
   전략: Sliding Window (IP 단위)

   프리셋:
   - auth_initiate : OAuth 시작 라우트 (10 req / 60s)
                     의도적 사용자 액션 — 엄격하게 제한
   - auth_callback : OAuth 콜백 라우트 (20 req / 60s)
                     IdP 리다이렉트 / 브라우저 재시도 감안 — 여유있게 제한

   개발 환경 패스스루:
   - UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN 미설정 시 rate limiting 비활성화.
   - 로컬 개발에서 Redis 없이 정상 동작 보장.
   ══════════════════════════════════════════ */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';
import { extractIp } from './logger';

/* ── 프리셋 정의 ── */
export type RateLimitPreset = 'auth_initiate' | 'auth_callback';

const LIMITS: Record<RateLimitPreset, { requests: number; window: string }> = {
  auth_initiate: { requests: 10, window: '1 m' },
  auth_callback: { requests: 20, window: '1 m' },
};

/* ── 모듈 수준 singleton (Next.js 워커 재사용) ── */
let _redis: Redis | null | undefined = undefined;

function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  _redis = url && token ? new Redis({ url, token }) : null;
  return _redis;
}

const _limiters = new Map<RateLimitPreset, Ratelimit>();

function getLimiter(preset: RateLimitPreset): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  if (!_limiters.has(preset)) {
    const { requests, window } = LIMITS[preset];
    _limiters.set(
      preset,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(requests, window as Parameters<typeof Ratelimit.slidingWindow>[1]),
        prefix: `gtr_rl_${preset}`,
      }),
    );
  }
  return _limiters.get(preset)!;
}

/* ══════════════════════════════════════════
   Public API
   ══════════════════════════════════════════ */

/**
 * 429 Too Many Requests 응답 빌드 (순수 함수).
 *
 * 반환 헤더:
 * - Retry-After: 재시도까지 남은 초 (최소 0)
 * - X-RateLimit-Limit / Remaining / Reset
 */
export function buildRateLimitResponse(
  limit: number,
  remaining: number,
  reset: number,
): NextResponse {
  const retryAfter = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
  return new NextResponse(
    JSON.stringify({ error: 'rate_limit_exceeded', retryAfter }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset': String(reset),
      },
    },
  );
}

/** @upstash/ratelimit 의 limit() 반환값 형태 (테스트 주입용) */
export type LimiterLike = {
  limit: (key: string) => Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
  }>;
};

/**
 * IP 기반 Rate Limit 검사 — 의존성 주입 버전 (테스트용).
 *
 * @param limiter null 이면 항상 통과 (개발 환경 패스스루)
 * @returns 한도 초과 시 429 NextResponse, 통과 시 null
 */
export async function checkRateLimitWith(
  request: Request,
  limiter: LimiterLike | null,
): Promise<NextResponse | null> {
  if (!limiter) return null;

  const ip = extractIp(request) ?? 'unknown';
  const { success, limit, remaining, reset } = await limiter.limit(ip);

  if (!success) {
    return buildRateLimitResponse(limit, remaining, reset);
  }
  return null;
}

/**
 * IP 기반 Rate Limit 검사.
 * 한도 초과 시 429 Response 반환, 통과 시 null 반환.
 *
 * 사용 예:
 * ```ts
 * const limited = await checkRateLimit(request, 'auth_initiate');
 * if (limited) return limited;
 * ```
 */
export async function checkRateLimit(
  request: Request,
  preset: RateLimitPreset,
): Promise<NextResponse | null> {
  return checkRateLimitWith(request, getLimiter(preset));
}
