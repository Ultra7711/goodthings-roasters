/* ══════════════════════════════════════════
   auth/rateLimit — IP 기반 Rate Limiting (P3-2)

   라이브러리: @upstash/ratelimit + @upstash/redis
   전략: Sliding Window (IP 단위)

   프리셋:
   - auth_initiate : OAuth 시작 라우트 (10 req / 60s)
                     의도적 사용자 액션 — 엄격하게 제한
   - auth_callback : OAuth 콜백 라우트 (20 req / 60s)
                     IdP 리다이렉트 / 브라우저 재시도 감안 — 여유있게 제한
   - order_create  : 주문 생성 엔드포인트 (10 req / 60s)
                     중복 클릭/자동 재시도 방지 — auth_initiate 수준
   - payment_confirm: 결제 승인 엔드포인트 (10 req / 60s)
                     정상 재시도(뒤로가기·모바일 이중호출) 를 허용하되
                     브루트포스성 호출 차단. payments-flow.md §3.1 기준.
   - guest_pin     : 게스트 주문조회 PIN 검증 (5 req / 600s)
                     PIN 브루트포스 방어 — OWASP ASVS §6.6.3 준수 (느슨한 IP 단위)
   - account_delete: 회원 탈퇴 엔드포인트 (3 req / 900s)
                     비가역 작업 — 최엄격. 실수/오폭주 방지 + subscription_active
                     재시도 여유(해지 페이지 이동 후 재시도) 고려.

   개발 환경 패스스루:
   - UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN 미설정 시 rate limiting 비활성화.
   - 로컬 개발에서 Redis 없이 정상 동작 보장.
   ══════════════════════════════════════════ */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';
import { extractIp } from './logger';

/* ── 프리셋 정의 ── */
export type RateLimitPreset =
  | 'auth_initiate'
  | 'auth_callback'
  | 'order_create'
  | 'payment_confirm'
  | 'guest_pin'
  | 'account_delete';

const LIMITS: Record<RateLimitPreset, { requests: number; window: string }> = {
  auth_initiate: { requests: 10, window: '1 m' },
  auth_callback: { requests: 20, window: '1 m' },
  order_create: { requests: 10, window: '1 m' },
  payment_confirm: { requests: 10, window: '1 m' },
  /* 게스트 PIN: 10 분 윈도우로 넓혀 브루트포스 완화 */
  guest_pin: { requests: 5, window: '10 m' },
  /* 회원 탈퇴: 비가역 — 15 분 윈도우 3 회. 정기배송 해지 후 재시도 여유 확보 */
  account_delete: { requests: 3, window: '15 m' },
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

  const cached = _limiters.get(preset);
  if (cached) return cached;

  const { requests, window } = LIMITS[preset];
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window as Parameters<typeof Ratelimit.slidingWindow>[1]),
    prefix: `gtr_rl_${preset}`,
  });
  _limiters.set(preset, limiter);
  return limiter;
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
  /* Pass 1 H1: errors.ts 표준 코드 'rate_limited' 로 통일.
     OrderApiError.code 경로에서 CheckoutPage switch 가 동일 리터럴을 기대함. */
  return new NextResponse(
    JSON.stringify({ error: 'rate_limited', retryAfter }),
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
