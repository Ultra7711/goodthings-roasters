/* ══════════════════════════════════════════════════════════════════════════
   getClaims.ts — 서버 컴포넌트 / Route Handler 전용 인증 유틸

   역할:
   - proxy.ts 가 매 요청마다 auth.getUser() 로 세션을 갱신·검증한 뒤,
     서버 컴포넌트에서 동일 요청 내 getUser() 를 재호출하면
     Supabase SSR 내부 캐시 히트로 추가 네트워크 비용 없이 claims 를 반환한다.
   - getSession() 은 로컬 복호화만 수행하여 조작에 취약 → 사용 금지.
   - 이 모듈이 유일한 서버 인증 진입점이 되어 패턴을 통일한다.

   사용처:
   - getClaims()   — nullable (비로그인 허용 페이지: 장바구니·홈 등)
   - requireAuth() — non-null 강제 (redirect('/login') 자동)

   참조:
   - docs/backend-architecture-plan.md §5.1 (getClaims 기반 전환)
   - docs/oauth-security-plan.md §P2 (서버 가드 전면 전환)
   ══════════════════════════════════════════════════════════════════════════ */

import { redirect } from 'next/navigation';
import { createRouteHandlerClient } from '@/lib/supabaseServer';

/* ── 타입 ─────────────────────────────────────────────────────────────── */

/** Supabase auth.getUser() → user 객체에서 추출한 필수 claims */
export type AuthClaims = {
  /** auth.users.id (UUID) — RLS auth.uid() 와 동일 */
  userId: string;
  /** 이메일 (synthetic 이메일 포함 가능) */
  email: string;
  /** user_metadata 전체 (full_name, provider, naver_id 등) */
  metadata: Record<string, unknown>;
};

/* ── getClaims — nullable ────────────────────────────────────────────── */

/**
 * 현재 요청의 인증 claims 를 반환한다. 비로그인 시 `null`.
 *
 * proxy.ts 가 이미 auth.getUser() 로 세션을 검증·갱신했으므로,
 * 여기서의 재호출은 Supabase SSR 내부 캐시 히트로 네트워크 비용이 없다.
 *
 * @example
 *   const claims = await getClaims();
 *   if (claims) { /* 로그인 유저 * / }
 */
export async function getClaims(): Promise<AuthClaims | null> {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return {
    userId: user.id,
    email: user.email ?? '',
    metadata: (user.user_metadata ?? {}) as Record<string, unknown>,
  };
}

/* ── requireAuth — redirect 강제 ─────────────────────────────────────── */

/**
 * 인증 필수 서버 컴포넌트 가드.
 * 비로그인 시 `/login` 으로 리다이렉트 (Next.js `redirect()` — throw).
 *
 * @example
 *   export default async function MyPage() {
 *     const claims = await requireAuth();
 *     // claims.userId 사용 가능 (non-null 보장)
 *   }
 */
export async function requireAuth(): Promise<AuthClaims> {
  const claims = await getClaims();
  if (!claims) {
    redirect('/login');
  }
  return claims;
}

/* ── RBAC: admin 가드 ────────────────────────────────────────────────── */

/**
 * 주어진 userId 가 admin 역할인지 DB 에 조회한다.
 * `public.is_admin(uuid)` RPC (SECURITY DEFINER STABLE) 를 호출 → RLS 우회.
 *
 * Route Handler / 서버 컴포넌트 공용. 비인증·비admin 시 `false`.
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const supabase = await createRouteHandlerClient();
  const { data, error } = await supabase.rpc('is_admin', { uid: userId });
  if (error) {
    /* PostgrestError 원본 전체 로깅 시 connection string 등 민감정보 노출 우려 — code/message 만 기록. */
    console.error('[isAdmin] rpc error', {
      code: error.code,
      message: error.message,
    });
    return false;
  }
  return data === true;
}

/** admin claims — AuthClaims + `role: 'admin'` 증거 */
export type AdminClaims = AuthClaims & { role: 'admin' };

/**
 * admin 필수 Route Handler 가드. 비인증 또는 비admin 시 `null` 반환.
 * 호출처는 `null` 이면 401/403 으로 응답.
 *
 * 서버 컴포넌트에서는 `requireAdminOrRedirect()` 사용.
 */
export async function getAdminClaims(): Promise<AdminClaims | null> {
  const claims = await getClaims();
  if (!claims) return null;
  const admin = await isAdmin(claims.userId);
  if (!admin) return null;
  return { ...claims, role: 'admin' };
}

/**
 * admin 필수 서버 컴포넌트 가드. 비인증 → `/login`, 비admin → `/` 리다이렉트.
 */
export async function requireAdminOrRedirect(): Promise<AdminClaims> {
  const claims = await getClaims();
  if (!claims) redirect('/login');
  const admin = await isAdmin(claims.userId);
  if (!admin) redirect('/');
  return { ...claims, role: 'admin' };
}
