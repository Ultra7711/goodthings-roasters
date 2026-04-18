/* ══════════════════════════════════════════════════════════════════════════
   email/rateLimit.ts — 토큰버킷 rate limiter

   사양: docs/email-infrastructure.md §7

   - Capacity = RESEND_RPS (default 5 · Context7 재검증)
   - Refill rate = capacity per 1초
   - 프로세스 내부 싱글톤 (Vercel 서버리스 인스턴스당 독립)
   - 다인스턴스 전역 큐는 Phase H (email_outbox + pg_cron) 로 보강

   2026-04-17 Pass 1 수정 (code-review H-1 / ts M-5 / security M-4):
     기존 재귀 `acquire()` → `while` 루프로 전환. 재귀는 토큰 고갈 burst 상황에서
     Promise chain 이 누적되어 이벤트 루프에 압박을 주고, 최대 대기 상한이 없어
     요청이 서버리스 타임아웃(10초)을 넘길 수 있다. 상한 초과 시 즉시 throw 하여
     호출 측이 재시도·폴백을 명시적으로 결정하도록 한다.
   ════════════════════════════════════════════════════════════════════════ */

export type TokenBucket = {
  acquire: () => Promise<void>;
};

/**
 * acquire() 최대 대기 시간 (ms).
 * capacity=5 기준 (1 토큰 ≈ 200ms) 25회 = 5초. Vercel 10초 타임아웃 보수 마진.
 */
const MAX_WAIT_MS = 5000;

export function createTokenBucket(capacity: number): TokenBucket {
  if (!Number.isFinite(capacity) || capacity <= 0) {
    throw new Error(`[email] token bucket capacity must be > 0 (got ${capacity})`);
  }

  let tokens = capacity;
  let lastRefill = Date.now();

  function refill(): void {
    const now = Date.now();
    const elapsedSec = (now - lastRefill) / 1000;
    if (elapsedSec <= 0) return;
    const refilled = Math.floor(elapsedSec * capacity);
    if (refilled <= 0) return;
    tokens = Math.min(capacity, tokens + refilled);
    lastRefill = now;
  }

  async function acquire(): Promise<void> {
    // 다음 refill 시각까지 대기 (1 토큰 = 1/capacity 초, 최소 1ms)
    const waitMs = Math.max(1, Math.ceil((1 / capacity) * 1000));
    const deadline = Date.now() + MAX_WAIT_MS;

    while (true) {
      refill();
      if (tokens > 0) {
        tokens -= 1;
        return;
      }
      if (Date.now() >= deadline) {
        throw new Error(
          `[email] rate limiter wait exceeded ${MAX_WAIT_MS}ms ` +
            `(capacity=${capacity}/sec). Caller should back off or enqueue.`,
        );
      }
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  return { acquire };
}
