/* ══════════════════════════════════════════
   Account Merge Policy (P1-1 / ADR-001 §3.2)
   OAuth 로그인 시 동일 이메일 기존 계정과의 병합 가능 여부 판정.

   호출 지점:
   - Naver/Kakao 콜백:  verifyOtp **전** 호출 (block 시 단순 리다이렉트)
   - Google /auth/callback: exchangeCodeForSession **후** 호출
     (block 시 signOut + 리다이렉트, ADR-001 §6.4 참조)

   보안 경계:
   - block 결정 누락 시 이메일 탈취 공격(시나리오 A, ADR-001 §1.1) 가능
   - 가상 이메일(@*-oauth.internal)은 이메일 기반 병합에서 제외

   단순성 원칙:
   - 정책 판단만 중앙화. 실제 DB 변경(createUser / updateUserById)은 호출자 책임.
   - 이메일 조회는 listUsers + 클라이언트 필터 (초기 규모). 향후 RPC 최적화 TODO.
   ══════════════════════════════════════════ */

import type { SupabaseClient, User } from '@supabase/supabase-js';
import { addProviderTo, type AuthProvider } from './providers';

/* ── 입력 컨텍스트 ── */
export type MergeContext = {
  /** 정규화 이전 이메일(호출자가 trim) — 비교 시 toLowerCase 적용 */
  email: string;
  /** IdP가 이메일을 검증했는가 (Google:id_token.email_verified, Kakao:is_email_verified, Naver:항상 false) */
  emailVerified: boolean;
  /** 신규 로그인 provider */
  provider: AuthProvider;
  /**
   * 가상 이메일 여부 (예: kakao 비즈앱 미인증).
   * true 면 이메일 기반 기존 계정 조회를 스킵하고 provider_user_id 기반 로직만 수행.
   */
  isSynthetic: boolean;
};

/* ── 출력 결정 ── */
export type MergeDecision =
  /** 기존 계정 없음 — 호출자는 createUser 수행 */
  | { action: 'allow_new' }
  /** 동일 provider 재로그인 — 호출자는 createUser 에러 무시(존재하면 skip) */
  | { action: 'allow_same'; userId: string }
  /**
   * 자동 병합 허용 — 호출자는 updateUserById로 metadata.providers 업데이트.
   * promoteVerified=true 면 email_verified를 true로 승격.
   */
  | {
      action: 'allow_merge';
      userId: string;
      addProvider: AuthProvider;
      promoteVerified: boolean;
    }
  /** 병합 금지 — 호출자는 즉시 errRedirect (Google은 signOut 선행) */
  | {
      action: 'block';
      code: `account_conflict_${AuthProvider}` | 'account_conflict_unknown';
      existingProvider: AuthProvider;
    };

/* ══════════════════════════════════════════
   Public API
   ══════════════════════════════════════════ */

/**
 * 이메일 기준 기존 계정 조회 + ADR-001 §3.2 정책 적용.
 *
 * @param ctx 신규 로그인 컨텍스트
 * @param supabaseAdmin service_role 어드민 클라이언트 (서버 전용)
 */
export async function resolveAccountMerge(
  ctx: MergeContext,
  supabaseAdmin: SupabaseClient,
): Promise<MergeDecision> {
  // 가상 이메일은 이메일 기반 병합 대상 아님 (ADR §3.3)
  // — 호출자가 provider_user_id (naver_id / kakao_id) 기반 조회는 별도로 수행.
  if (ctx.isSynthetic) {
    return { action: 'allow_new' };
  }

  const existing = await findUserByEmail(ctx.email, supabaseAdmin);
  if (!existing) {
    return { action: 'allow_new' };
  }

  const existingProvider = readPrimaryProvider(existing);
  const existingVerified = readEmailVerified(existing);

  // 1. 동일 provider 재로그인 → allow_same
  if (existingProvider === ctx.provider) {
    return { action: 'allow_same', userId: existing.id };
  }

  // 2. 기존 검증 ✓ & 신규 미검증 → block
  //    (시나리오 A 방어: Naver 미검증 계정으로 Google/email 계정 탈취 불가)
  if (existingVerified && !ctx.emailVerified) {
    return blockDecision(existingProvider);
  }

  // 3. 양쪽 다 검증 → 자동 병합 (Google↔Kakao 비즈앱, email↔Google 등)
  if (existingVerified && ctx.emailVerified) {
    return {
      action: 'allow_merge',
      userId: existing.id,
      addProvider: ctx.provider,
      promoteVerified: false,
    };
  }

  // 4. 기존 미검증 & 신규 검증 → 병합 + email_verified 승격
  //    예: 기존 Naver(미검증) + 신규 Google(검증) → Google 검증으로 승격
  if (!existingVerified && ctx.emailVerified) {
    return {
      action: 'allow_merge',
      userId: existing.id,
      addProvider: ctx.provider,
      promoteVerified: true,
    };
  }

  // 5. 양쪽 다 미검증 & provider 다름 → 보수적으로 block
  //    (같은 provider 재로그인은 §1에서 이미 처리됨)
  return blockDecision(existingProvider);
}

/**
 * allow_merge 결정 시 기존 user_metadata에 적용할 업데이트 오브젝트 생성.
 * 호출자는 `supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata })`로 적용.
 */
export function buildMergeMetadata(
  currentMetadata: Record<string, unknown> | undefined | null,
  decision: Extract<MergeDecision, { action: 'allow_merge' }>,
): Record<string, unknown> {
  const current = currentMetadata ?? {};
  const currentProviders = Array.isArray(current.providers)
    ? (current.providers as AuthProvider[])
    : undefined;
  const nextProviders = addProviderTo(currentProviders, decision.addProvider);

  const merged: Record<string, unknown> = {
    ...current,
    providers: nextProviders,
  };
  if (decision.promoteVerified) {
    merged.email_verified = true;
  }
  return merged;
}

/* ══════════════════════════════════════════
   Internal helpers
   ══════════════════════════════════════════ */

/** 보수적 block 결정 생성 — 에러 코드는 `account_conflict_{existing}` */
function blockDecision(
  existingProvider: AuthProvider,
): Extract<MergeDecision, { action: 'block' }> {
  return {
    action: 'block',
    code: `account_conflict_${existingProvider}` as const,
    existingProvider,
  };
}

/**
 * Supabase auth.users에서 이메일 일치 유저 1건 조회.
 *
 * 구현 주의:
 * - Supabase Admin JS v2는 email 필터 직접 지원이 없어 listUsers + 클라이언트 필터 사용.
 * - 이메일 비교는 case-insensitive (auth.users 저장 시점에 lowercase 정규화되지만 방어).
 * - 페이지네이션 안전장치: 최대 10페이지(≈2000명)까지 탐색. 초과 시 null 반환.
 *   (향후 Phase 3에서 SQL RPC로 최적화 예정 — TODO)
 */
async function findUserByEmail(
  email: string,
  supabaseAdmin: SupabaseClient,
): Promise<User | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const perPage = 200;
  const maxPages = 10;

  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error || !data?.users) break;

    const found = data.users.find(
      (u) => typeof u.email === 'string' && u.email.toLowerCase() === normalized,
    );
    if (found) return found;

    if (data.users.length < perPage) break; // 마지막 페이지
  }
  return null;
}

/**
 * user_metadata에서 주 provider 추출.
 * - providers 배열이 있으면 첫 요소 (가장 오래된 가입 provider)
 * - provider 문자열 fallback
 * - Google OAuth 네이티브 플로우는 user_metadata 에 `provider` 키 없이
 *   Google raw profile(iss, sub, provider_id 등)만 채움 → iss 시그니처로 탐지
 * - 모두 없으면 'email' (Supabase 기본 signUp 플로우)
 */
function readPrimaryProvider(user: User): AuthProvider {
  const meta = user.user_metadata ?? {};
  const providers = meta.providers;
  if (Array.isArray(providers) && providers.length > 0) {
    const first = providers[0];
    if (isAuthProvider(first)) return first;
  }
  const single = meta.provider;
  if (isAuthProvider(single)) return single;
  // Google OAuth 네이티브 플로우 탐지 — id_token 의 iss 클레임이 그대로 남음
  if (meta.iss === 'https://accounts.google.com') return 'google';
  return 'email';
}

/**
 * 이메일 검증 여부 읽기.
 * - user_metadata.email_verified (우리가 명시적으로 기록) 우선
 * - 없으면 Supabase email_confirmed_at 여부로 fallback (이메일 가입 flow)
 */
function readEmailVerified(user: User): boolean {
  const meta = user.user_metadata ?? {};
  const metaVerified = meta.email_verified;
  if (typeof metaVerified === 'boolean') return metaVerified;
  return user.email_confirmed_at != null;
}

function isAuthProvider(value: unknown): value is AuthProvider {
  return (
    value === 'google' || value === 'naver' || value === 'kakao' || value === 'email'
  );
}
