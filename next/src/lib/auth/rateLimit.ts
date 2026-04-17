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
  | 'payment_confirm_reject'
  | 'guest_pin'
  | 'account_delete'
  | 'cart_write';

const LIMITS: Record<RateLimitPreset, { requests: number; window: string }> = {
  auth_initiate: { requests: 10, window: '1 m' },
  auth_callback: { requests: 20, window: '1 m' },
  order_create: { requests: 10, window: '1 m' },
  payment_confirm: { requests: 10, window: '1 m' },
  /* Session 8 보안 #1: Carding RL (확정안 B + C 부분, docs/payments-security-hardening.md §2).
     Toss 카드 거절 코드 반복 전용 — 5 req / 10 min. 총량 상한은 payment_confirm 이 담당. */
  payment_confirm_reject: { requests: 5, window: '10 m' },
  /* 게스트 PIN: 10 분 윈도우로 넓혀 브루트포스 완화 */
  guest_pin: { requests: 5, window: '10 m' },
  /* 회원 탈퇴: 비가역 — 15 분 윈도우 3 회. 정기배송 해지 후 재시도 여유 확보 */
  account_delete: { requests: 3, window: '15 m' },
  /* 카트 쓰기(POST/PATCH/DELETE/merge): 분당 60회. 사용자 UI 조작 수준 빈도 허용 + 봇 차단. */
  cart_write: { requests: 60, window: '1 m' },
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
  /* 동일 값(retryAfter) 을 JSON 바디와 Retry-After 헤더에 재사용하여 body/header
     정합성을 담보 (M-9). Math.max(0, ...) 로 시계 드리프트·지연 도착 시 음수 방어. */
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

/* ══════════════════════════════════════════
   Carding RL — payment_confirm_reject preset (Session 8 보안 #1)
   ══════════════════════════════════════════ */

/**
 * Carding 카운트 키 빌더 — `{ip}:{userIdOrGuest}` (확정 D1).
 *
 * - 로그인: user_id 기준 (세션 하이재킹 + IP 변경 시에도 추적).
 * - 게스트: IP 단독 (guest 는 고유 식별자 없음 → IP 를 게스트 버킷으로).
 *
 * sessionId 는 복잡도 대비 이득 작아 미사용.
 *
 * 테스트 주입용으로 export — 다른 호출처는 기존 `check/record` 래퍼만 사용할 것.
 */
export function buildCardingKey(request: Request, userId: string | null): string {
  const ip = extractIp(request) ?? 'unknown';
  return `${ip}:${userId ?? 'guest'}`;
}

/**
 * Carding Rate Limit 선검사 — confirm 플로우 진입 직전에 호출.
 *
 * - 한도 초과 시 429 `too_many_card_attempts` 반환.
 * - `CARDING_LIMIT_ENABLED !== 'true'` 이면 dry-run: 카운트는 올라가지만 차단 없음.
 * - Redis 미설정 환경 (개발/로컬) 은 항상 통과.
 *
 * @returns 차단 시 NextResponse, 통과 시 null
 */
export async function checkCardingLimit(
  request: Request,
  userId: string | null,
): Promise<NextResponse | null> {
  return checkCardingLimitWith(
    request,
    userId,
    getLimiter('payment_confirm_reject'),
    process.env.CARDING_LIMIT_ENABLED === 'true',
  );
}

/**
 * `checkCardingLimit` 의 DI 변형 — 테스트 전용.
 *
 * @param limiter null 이면 항상 통과 (Redis 미설정 환경 모사)
 * @param enforceEnabled false 면 dry-run (카운트만 올라가고 차단 안 함)
 */
export async function checkCardingLimitWith(
  request: Request,
  userId: string | null,
  limiter: LimiterLike | null,
  enforceEnabled: boolean,
): Promise<NextResponse | null> {
  if (!limiter) return null;

  const key = buildCardingKey(request, userId);
  const { success, limit, remaining, reset } = await limiter.limit(key);

  if (!success && enforceEnabled) {
    const retryAfter = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
    return new NextResponse(
      JSON.stringify({ error: 'too_many_card_attempts', retryAfter }),
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
  return null;
}

/**
 * Carding 공격 시그널 카운트 증분 — Toss 가 카드 거절 코드를 반환한 시점에 호출.
 *
 * - `isCardRejectionCode(tossCode)` true 인 경우에만 incr.
 * - 결과는 버림 (이후 호출의 `checkCardingLimit` 이 동일 키를 조회해 판정).
 * - Redis 미설정 환경은 no-op.
 *
 * 이 함수는 "공격 시그널 기록" 책임만 — 429 반환은 다음 confirm 시도의
 * `checkCardingLimit` 이 담당한다.
 */
export async function recordCardingAttempt(
  request: Request,
  userId: string | null,
  tossCode: string | null | undefined,
): Promise<void> {
  const { isCardRejectionCode } = await import('@/lib/payments/tossErrorCodes');
  if (!isCardRejectionCode(tossCode)) return;
  await recordCardingAttemptWith(
    request,
    userId,
    getLimiter('payment_confirm_reject'),
  );
}

/**
 * `recordCardingAttempt` 의 DI 변형 — 테스트 전용.
 *
 * `isCardRejectionCode` 필터링은 호출자 책임. 이 함수는 순수하게 한 번
 * `limiter.limit(key)` 를 호출해 카운트만 증분한다.
 */
export async function recordCardingAttemptWith(
  request: Request,
  userId: string | null,
  limiter: LimiterLike | null,
): Promise<void> {
  if (!limiter) return;
  const key = buildCardingKey(request, userId);
  /* limit() 결과값은 신경쓰지 않는다 — 증분만 목적. */
  await limiter.limit(key);
}
