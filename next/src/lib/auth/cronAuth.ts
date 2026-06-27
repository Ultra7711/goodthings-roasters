/* ══════════════════════════════════════════════════════════════════════════
   cronAuth.ts — 내부 cron/스케줄러 호출 인증 (R-1)

   용도:
   - pg_cron(R-2) 또는 운영자 수동 트리거가 `POST /api/billing/charge/recurring`
     같은 내부 엔드포인트를 호출할 때 `x-cron-secret` 헤더를 `process.env.CRON_SECRET`
     와 timing-safe 비교한다. 브라우저 세션이 아니므로 CSRF 예외 + 이 인증으로 대체.

   보안 (adminAuth.ts 동형):
   - timing-safe 비교 (timingSafeEqual).
   - CRON_SECRET 미설정/빈 문자열 → 항상 거부 (fail-closed).
   - secret 로그 금지.
   ══════════════════════════════════════════════════════════════════════════ */

import { timingSafeEqual } from 'crypto';

/**
 * x-cron-secret 헤더를 `CRON_SECRET` 환경변수와 timing-safe 비교.
 *
 * @returns true = 인증 통과 / false = 거부 (헤더 부재·미설정·길이 불일치·불일치)
 */
export function isCronRequest(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || expected.length === 0) return false;

  const provided = request.headers.get('x-cron-secret');
  if (!provided) return false;

  /* 길이 누출 방지: 동일 길이 버퍼 패딩 후 비교, 길이 일치는 후위 검증 (adminAuth 패턴). */
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  const padded = Buffer.alloc(b.length, 0);
  a.copy(padded);

  try {
    const equal = timingSafeEqual(padded, b);
    return equal && a.length === b.length;
  } catch {
    return false;
  }
}
