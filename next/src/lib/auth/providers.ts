/* ══════════════════════════════════════════
   Auth Providers — 타입·상수 정의
   ADR-001 §3.1 IdP별 이메일 검증 신뢰 수준.
   ══════════════════════════════════════════ */

export type AuthProvider = 'google' | 'naver' | 'kakao' | 'email';

/** IdP별 이메일 검증 신뢰 수준 (ADR-001 §3.1) */
export type TrustLevel = 'high' | 'medium-high' | 'medium' | 'low';

/**
 * user_metadata.providers 배열에 새 provider 추가 (중복 방지).
 * 병합 허용 시(allow_merge) 호출자가 updateUserById로 적용.
 */
export function addProviderTo(
  list: AuthProvider[] | undefined,
  next: AuthProvider,
): AuthProvider[] {
  const base = Array.isArray(list) ? list : [];
  return base.includes(next) ? base : [...base, next];
}
