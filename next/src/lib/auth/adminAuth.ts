/* ══════════════════════════════════════════════════════════════════════════
   adminAuth.ts — 어드민 API 키 검증 (Session 8-B B-2)

   용도:
   - 어드민 UI 가 아직 구현되지 않은 단계에서 운영자가 curl/스크립트로
     `POST /api/admin/orders/{orderNumber}/ship` 같은 엔드포인트를 호출할 때
     `x-admin-secret` 헤더 값을 `process.env.ADMIN_API_SECRET` 와 비교한다.

   보안:
   - timing-safe 비교 (timingSafeEqual) — 문자열 비교는 타이밍 공격에 취약.
   - ADMIN_API_SECRET 미설정(=undefined) 또는 빈 문자열이면 항상 거부 (fail-closed).
   - 본 모듈은 service_role 수준 권한을 개방하므로 secret 로그 금지.

   향후:
   - Supabase Auth 어드민 role 도입 시 이 유틸은 fallback/CI 테스트용으로만 유지.
   ══════════════════════════════════════════════════════════════════════════ */

import { timingSafeEqual } from 'crypto';

/**
 * x-admin-secret 헤더를 `ADMIN_API_SECRET` 환경변수와 timing-safe 비교.
 *
 * @returns true = 인증 통과 / false = 거부 (헤더 부재·미설정·길이 불일치·불일치)
 */
export function isAdminRequest(request: Request): boolean {
  const expected = process.env.ADMIN_API_SECRET;
  if (!expected || expected.length === 0) return false;

  const provided = request.headers.get('x-admin-secret');
  if (!provided) return false;

  /* timingSafeEqual 는 두 버퍼 길이가 동일해야 비교 가능 — 길이 불일치는 즉시 false.
     (길이 자체로 타이밍이 새는 것은 불가피하나 문자 단위 early-exit 보다 안전) */
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;

  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
