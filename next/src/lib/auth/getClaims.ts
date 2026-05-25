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

/** S232: admin 권한 단계 — 'owner' (관리자) | 'staff' (운영자). */
export type AdminLevel = 'owner' | 'staff';

/**
 * admin claims — AuthClaims + role + UI 표시용 프로필 데이터.
 * S124: profiles.display_name + profiles.title 통합 (어드민 사이드바·환영 헤더 표시용).
 * S232: profiles.admin_level (owner/staff) 추가 — 권한 분기 UI/액션 가드 공용.
 */
export type AdminClaims = AuthClaims & {
  role: 'admin';
  adminLevel: AdminLevel;
  displayName: string | null;
  title: string | null;
};

/**
 * admin 필수 Route Handler 가드. 비인증 또는 비admin 시 `null` 반환.
 * 호출처는 `null` 이면 401/403 으로 응답.
 *
 * S124: profiles.display_name + profiles.title 도 함께 fetch (UI 표시용).
 * S232: profiles.admin_level 도 함께 fetch (권한 분기용).
 *
 * S282-P3: JWT app_metadata.admin_level fast-path —
 *   마이그 074 의 custom_access_token_hook 이 발급한 JWT 안 admin_level 직독.
 *   일반 사용자 95% = app_metadata.admin_level undefined → RPC + SELECT skip (-300~600ms).
 *   admin = SELECT 1회만 (is_admin RPC skip).
 *   Hook 미적용 환경 fallback = 기존 is_admin RPC + profile select (backward compat 1~2주).
 *   Security: JWT 변조 = Supabase 서명 검증으로 차단 · 실제 권한 검증은 server action RLS 로 backup.
 */
export async function getAdminClaims(): Promise<AdminClaims | null> {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const claims: AuthClaims = {
    userId: user.id,
    email: user.email ?? '',
    metadata: (user.user_metadata ?? {}) as Record<string, unknown>,
  };

  /* ── S282-P3 fast-path: JWT 안 app_metadata.admin_level 직독 ─────────────
     Supabase JS SDK 의 user.app_metadata 는 auth.users 테이블 값 (Hook claim 과 별개 source).
     Hook 결과 = session.access_token decode 의 payload.app_metadata.admin_level.
     owner/staff 외 값은 무시 (security). */
  let hookAdminLevel: 'owner' | 'staff' | undefined;
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    const parts = session.access_token.split('.');
    if (parts.length >= 2) {
      try {
        const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(
          Buffer.from(b64, 'base64').toString('utf8'),
        ) as { app_metadata?: { admin_level?: string } };
        const claim = payload.app_metadata?.admin_level;
        if (claim === 'owner' || claim === 'staff') {
          hookAdminLevel = claim;
        }
      } catch {
        /* JWT decode 실패 = fallback (방어) */
      }
    }
  }
  if (hookAdminLevel === 'owner' || hookAdminLevel === 'staff') {
    /* admin 사용자: profile SELECT 만 (display_name, title) — is_admin RPC + admin_level SELECT skip */
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('display_name, title')
      .eq('id', claims.userId)
      .maybeSingle();
    if (profileErr) {
      console.warn('[getAdminClaims] profile fetch failed (fast-path) — forcing re-auth', {
        code: profileErr.code,
        message: profileErr.message,
      });
      return null;
    }
    return {
      ...claims,
      role: 'admin',
      adminLevel: hookAdminLevel,
      displayName: profile?.display_name ?? null,
      title: profile?.title ?? null,
    };
  }

  /* ── Hook 미적용 / 일반 사용자 분기 ──────────────────────────────────
     JWT 안 admin_level 없음 = 두 경우:
       (1) 일반 사용자 — admin_level 자체 NULL (95%)
       (2) Hook 미적용 admin 사용자 — backward compat fallback (1~2주 carry · 모두 적용 후 RPC 제거)
     fallback: is_admin RPC + profile select (기존 동작). */
  const [adminRes, profileRes] = await Promise.all([
    supabase.rpc('is_admin', { uid: claims.userId }),
    supabase
      .from('profiles')
      .select('display_name, title, admin_level')
      .eq('id', claims.userId)
      .maybeSingle(),
  ]);

  if (adminRes.error) {
    console.error('[getAdminClaims] is_admin error (fallback)', {
      code: adminRes.error.code,
      message: adminRes.error.message,
    });
    return null;
  }
  if (adminRes.data !== true) return null;

  if (profileRes.error) {
    /* S255-A HIGH-5: profile fetch 실패 시 'staff' fallback 은 owner 가 의도치
       않게 권한을 잃는 운영 위험. is_admin RPC 는 이미 통과한 상태이므로
       null 반환하여 재로그인을 유도. */
    console.warn('[getAdminClaims] profile fetch failed (fallback) — forcing re-auth', {
      code: profileRes.error.code,
      message: profileRes.error.message,
    });
    return null;
  }

  const adminLevel: AdminLevel =
    profileRes.data?.admin_level === 'owner' ? 'owner' : 'staff';

  return {
    ...claims,
    role: 'admin',
    adminLevel,
    displayName: profileRes.data?.display_name ?? null,
    title: profileRes.data?.title ?? null,
  };
}

/**
 * admin 필수 서버 컴포넌트 가드. 비인증·비admin → `/admin/login` 리다이렉트.
 * S124: 어드민 영역은 메인 사이트 `/login` 이 아닌 `/admin/login` 으로 보냄.
 */
export async function requireAdminOrRedirect(): Promise<AdminClaims> {
  const adminClaims = await getAdminClaims();
  if (!adminClaims) redirect('/admin/login');
  return adminClaims;
}

/* ── owner (관리자) 가드 — S232 ───────────────────────────────────────
   민감 액션 (CSV 내보내기 · 영구 삭제 · 사용자 권한 변경 · 사이트 설정) 전용.
   ──────────────────────────────────────────────────────────────────── */

/**
 * admin owner 필수 Route Handler 가드. owner 가 아니면 `null` 반환.
 * 호출처는 `null` 이면 'unauthorized' 응답.
 */
export async function getAdminOwnerClaims(): Promise<AdminClaims | null> {
  const adminClaims = await getAdminClaims();
  if (!adminClaims) return null;
  if (adminClaims.adminLevel !== 'owner') return null;
  return adminClaims;
}
