/* ══════════════════════════════════════════
   auth/logger — OAuth 이벤트 구조화 로그 (P3-1a)

   Phase 2-F: console.log JSON → Vercel 로그에서 확인.
   Phase 3-B: Supabase auth_logs 테이블 INSERT로 교체 예정.

   PII 원칙:
   - 이메일은 반드시 maskEmail() 처리 후 전달할 것.
   - 원본 이메일·이름·전화번호를 로그에 직접 기록 금지.
   - 한국 개인정보보호법 §30 보존 기간:
       login.success         → 6개월
       login.failed / block  → 1년
       (Phase 3-B auth_logs pg_cron 정책에서 적용)
   ══════════════════════════════════════════ */

import type { AuthProvider } from './providers';

/* ── 이벤트 이름 ── */
export type AuthEventName =
  | 'oauth.login.success'
  | 'oauth.login.failed'
  | 'oauth.merge_blocked';

/* ── 로그 페이로드 ── */
export type AuthEventPayload = {
  /** 이벤트 이름 */
  event: AuthEventName;
  /** OAuth provider */
  provider: AuthProvider | 'unknown';
  /** 마스킹된 이메일 — 원본 이메일 절대 전달 금지 (PII) */
  emailMasked: string;
  outcome: 'success' | 'failed' | 'blocked';
  /** 세션 수립 성공 시 Supabase user.id */
  userId?: string;
  /** resolveAccountMerge 결정값 (allow_new / allow_same / allow_merge / block) */
  mergeAction?: string;
  /** 실패·블록 시 에러 코드 */
  errorCode?: string;
  /** 클라이언트 IP (Vercel: x-forwarded-for 첫 번째 값) */
  ip?: string;
  /** User-Agent 첫 120자 */
  userAgent?: string;
};

/**
 * OAuth 이벤트 구조화 로그 출력.
 *
 * `ts` 필드(ISO 8601)가 자동 추가됨.
 * undefined 필드는 JSON.stringify에 의해 자동 제외.
 */
export function logAuthEvent(payload: AuthEventPayload): void {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      ...payload,
    }),
  );
}

/**
 * 이메일 마스킹 — PII 최소화 (한국 개인정보보호법 §30).
 *
 * - 가상 이메일 (@kakao-oauth.internal / @naver-oauth.internal):
 *   PII 미포함이므로 변환 없이 그대로 반환.
 * - 일반 이메일: local part 첫 글자만 노출, 나머지 `***` 처리.
 *   user@example.com  → u***@example.com
 *   a@example.com     → a***@example.com
 *   user+tag@ex.com   → u***@ex.com
 * - 빈 문자열 / @ 없는 값: `***` 반환.
 */
export function maskEmail(email: string): string {
  if (!email) return '***';

  /* 가상 이메일 — OAuth 내부 식별자이며 PII 없음 */
  if (
    email.endsWith('@kakao-oauth.internal') ||
    email.endsWith('@naver-oauth.internal')
  ) {
    return email;
  }

  const atIdx = email.lastIndexOf('@');
  if (atIdx <= 0) return '***';

  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx); /* '@example.com' 포함 */

  return `${local[0]}***${domain}`;
}

/**
 * Request 헤더에서 클라이언트 IP 추출.
 * Vercel 환경: x-forwarded-for 첫 번째 값 사용.
 */
export function extractIp(request: Request): string | undefined {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    undefined
  );
}

/**
 * User-Agent 첫 120자 추출 (로그 볼륨 제한).
 */
export function extractUserAgent(request: Request): string | undefined {
  const ua = request.headers.get('user-agent');
  return ua ? ua.slice(0, 120) : undefined;
}
