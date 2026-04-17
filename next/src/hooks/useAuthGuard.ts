/* ══════════════════════════════════════════
   useAuthGuard
   보호 페이지(/mypage 등)용 클라이언트 사이드 인증 가드
   - useSupabaseSession 의 isLoading 완료 대기 (INITIAL_SESSION)
   - 미로그인 시 지정 경로로 리다이렉트

   ⚠️  보안 경계 아님 — UX 보조 도구
   실제 보안 경계는 서버 컴포넌트의 supabase.auth.getUser() (P1-2).
   이 훅은 쿠키 조작으로 우회 가능하므로 인가 결정에 사용하지 않는다.

   ADR-004 Step C-2: Zustand persist 구독 → Supabase session 구독으로 전환.
   INITIAL_SESSION 이벤트가 세션 원천이므로 별도 getSession() 안전망은 불필요.
   ══════════════════════════════════════════ */

'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';

type UseAuthGuardOptions = {
  /** 미로그인 시 이동할 경로 (기본 /login) */
  redirectTo?: string;
};

type UseAuthGuardReturn = {
  /** session 로딩 완료 여부 (INITIAL_SESSION 수신) */
  ready: boolean;
  /** 가드 통과 여부 (ready && isLoggedIn) */
  authorized: boolean;
  /**
   * 다음 로그아웃 감지 시의 기본 redirectTo 네비게이션을 1회 건너뛴다.
   * 호출 측(예: 로그아웃 핸들러)이 직접 router.replace(...)로 원하는 경로를
   * 지정하고 싶을 때 사용. 호출 순서는 bypassRedirect() → logout() → router.replace(...).
   */
  bypassRedirect: () => void;
};

export function useAuthGuard(
  options: UseAuthGuardOptions = {},
): UseAuthGuardReturn {
  const { redirectTo = '/login' } = options;
  const router = useRouter();
  const { isLoggedIn, isLoading } = useSupabaseSession();
  const ready = !isLoading;

  /* 리다이렉트 바이패스 플래그 — 호출 측이 직접 네비게이션을 책임질 때 set */
  const bypassRef = useRef(false);
  const bypassRedirect = useCallback(() => {
    bypassRef.current = true;
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn) {
      if (bypassRef.current) {
        /* 1회 소비 후 초기화 — 이후 재로그인·재로그아웃 사이클에서 기본 가드가 정상 동작 */
        bypassRef.current = false;
        return;
      }
      router.replace(redirectTo);
    }
  }, [ready, isLoggedIn, router, redirectTo]);

  return {
    ready,
    authorized: ready && isLoggedIn,
    bypassRedirect,
  };
}
