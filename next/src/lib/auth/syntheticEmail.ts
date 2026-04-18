/* ══════════════════════════════════════════
   Synthetic Email — 이메일 미제공 OAuth 가상 이메일 판별
   ADR-001 §3.3, §6.2.

   용도:
   - Kakao 비즈앱 미인증: kakao_{id}@kakao-oauth.internal
   - Naver 이메일 스코프 미동의(향후): naver_{id}@naver-oauth.internal

   가상 이메일은 이메일 기반 계정 병합 대상에서 제외하고(ADR §3.3),
   UI에서도 실제 이메일로 표시하지 않는다.
   ══════════════════════════════════════════ */

/** 가상 이메일 서픽스 — 실도메인과 충돌 방지용 internal TLD */
export const SYNTHETIC_EMAIL_SUFFIX = '-oauth.internal';

/** 이메일 문자열이 가상 이메일 패턴인지 검사 */
export function isSyntheticEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.endsWith(SYNTHETIC_EMAIL_SUFFIX);
}

/** provider별 가상 이메일 생성 */
export function buildSyntheticEmail(
  provider: 'kakao' | 'naver',
  providerUserId: string,
): string {
  return `${provider}_${providerUserId}@${provider}${SYNTHETIC_EMAIL_SUFFIX}`;
}
