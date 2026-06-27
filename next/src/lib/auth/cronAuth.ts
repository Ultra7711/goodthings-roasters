/* ══════════════════════════════════════════════════════════════════════════
   cronAuth.ts — 내부 cron/스케줄러 호출 인증 (R-1 · R-2b 확장)

   용도:
   - 스케줄러/운영자 트리거가 내부 빌링 엔드포인트를 호출할 때 공유 시크릿
     `process.env.CRON_SECRET` 을 timing-safe 비교한다. 두 헤더 경로 모두 수용:
       · x-cron-secret           — 운영자 수동 트리거(POST /api/billing/charge/recurring)
       · Authorization: Bearer … — Vercel Cron 표준(GET /api/billing/charge/run).
         Vercel Cron 은 커스텀 헤더를 주입할 수 없고 CRON_SECRET 설정 시 Bearer 를
         자동 주입하므로, 트리거 분리(외부 cron 교체)를 위해 둘 다 받는다.
   - 브라우저 세션이 아니므로 CSRF 예외 + 이 인증으로 대체.

   보안 (adminAuth.ts 동형):
   - timing-safe 비교 (timingSafeEqual) — 두 경로 동일 적용.
   - CRON_SECRET 미설정/빈 문자열 → 항상 거부 (fail-closed).
   - secret 로그 금지.
   ══════════════════════════════════════════════════════════════════════════ */

import { timingSafeEqual } from 'crypto';

/** 제공값을 기대 시크릿과 timing-safe 비교 (길이 누출 방지: 패딩 후 비교 + 길이 후위 검증). */
function timingSafeMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  const padded = Buffer.alloc(b.length, 0);
  a.copy(padded);
  try {
    return timingSafeEqual(padded, b) && a.length === b.length;
  } catch {
    return false;
  }
}

/**
 * `x-cron-secret` 또는 `Authorization: Bearer <secret>` 를 `CRON_SECRET` 과 timing-safe 비교.
 *
 * @returns true = 인증 통과 / false = 거부 (헤더 부재·미설정·불일치)
 */
export function isCronRequest(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || expected.length === 0) return false;

  /* 1) x-cron-secret (운영자 수동 트리거) */
  const xHeader = request.headers.get('x-cron-secret');
  if (xHeader && timingSafeMatch(xHeader, expected)) return true;

  /* 2) Authorization: Bearer <secret> (Vercel Cron 표준 자동주입) */
  const auth = request.headers.get('authorization');
  if (auth && auth.startsWith('Bearer ')) {
    if (timingSafeMatch(auth.slice(7), expected)) return true;
  }

  return false;
}
