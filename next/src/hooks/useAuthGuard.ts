/* ══════════════════════════════════════════
   useAuthGuard
   보호 페이지(/mypage 등)용 클라이언트 사이드 인증 가드
   - Zustand persist 하이드레이션 완료 대기
   - 미로그인 시 지정 경로로 리다이렉트

   ⚠️  보안 경계 아님 — UX 보조 도구
   실제 보안 경계는 서버 컴포넌트의 supabase.auth.getUser() (P1-2).
   이 훅은 localStorage 조작으로 우회 가능하므로 인가 결정에 사용하지 않는다.
   ══════════════════════════════════════════ */

'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';

type UseAuthGuardOptions = {
  /** 미로그인 시 이동할 경로 (기본 /login) */
  redirectTo?: string;
};

type UseAuthGuardReturn = {
  /** persist 하이드레이션 완료 여부 */
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

/* ── Zustand persist 하이드레이션 상태 구독 ──
   useSyncExternalStore를 사용해 하이드레이션 완료 여부를 리액트 상태로 노출.
   SSR/prerender 환경에서는 getServerSnapshot이 항상 false를 반환하므로
   persist API 접근 오류 없이 안전하다.

   unsubscribe 계약 방어:
   onFinishHydration의 반환 값 타입이 zustand 버전에 따라 변동 가능하므로
   실제 함수일 때만 React에 전달하고, 아니면 no-op을 반환해 메모리 누수/런타임
   예외를 예방한다. */
const NOOP = () => {};
const subscribeHydration = (callback: () => void): (() => void) => {
  const unsubscribe = useAuthStore.persist.onFinishHydration(callback);
  return typeof unsubscribe === 'function' ? unsubscribe : NOOP;
};
const getHydrationSnapshot = () => useAuthStore.persist.hasHydrated();
const getHydrationServerSnapshot = () => false;

export function useAuthGuard(
  options: UseAuthGuardOptions = {},
): UseAuthGuardReturn {
  const { redirectTo = '/login' } = options;
  const router = useRouter();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  const ready = useSyncExternalStore(
    subscribeHydration,
    getHydrationSnapshot,
    getHydrationServerSnapshot,
  );

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
      /* P0-4: Zustand가 미로그인으로 판정할 때 Supabase 세션을 직접 확인.
         OAuth 콜백이 verifyOtp로 세션 쿠키를 주입했으나(P0-3) AuthSyncProvider의
         onAuthStateChange가 아직 Zustand를 업데이트하지 못한 경우를 대비한 안전망. */
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          router.replace(redirectTo);
        }
        // session 있으면 AuthSyncProvider가 곧 Zustand를 동기화 — 리다이렉트 생략
      });
    }
  }, [ready, isLoggedIn, router, redirectTo]);

  return {
    ready,
    authorized: ready && isLoggedIn,
    bypassRedirect,
  };
}
