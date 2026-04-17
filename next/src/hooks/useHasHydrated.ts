/* ══════════════════════════════════════════
   useHasHydrated — Zustand persist 하이드레이션 완료 감지

   BUG-003 응급 패치 (ADR-004 Step A).
   persist store 는 localStorage 로딩 후에만 서버 상태와 일치하므로,
   hydration 완료 전까지 해당 값에 기반한 UI 렌더를 억제해야 한다.

   useSyncExternalStore 기반 — React 18 concurrent safe.
   SSR 에서는 항상 false 반환.

   사용:
     const hydrated = useHasHydrated(useAuthStore, useCartStore);
     if (!hydrated) return <Skeleton />;

   Step B (Session 15) 에서 TanStack Query + useSupabaseSession 으로
   대체되며 이 훅도 함께 제거 예정.
   ══════════════════════════════════════════ */

'use client';

import { useSyncExternalStore } from 'react';

type PersistApi = {
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (fn: () => void) => unknown;
  };
};

const NOOP = () => {};

function subscribeAll(stores: PersistApi[]) {
  return (callback: () => void) => {
    const unsubs = stores.map((s) => {
      const u = s.persist.onFinishHydration(callback);
      return typeof u === 'function' ? (u as () => void) : NOOP;
    });
    return () => unsubs.forEach((u) => u());
  };
}

/**
 * 전달한 persist store 가 모두 hydration 을 마쳤는지 반환.
 * SSR/초기 클라이언트 렌더에서는 false.
 */
export function useHasHydrated(...stores: PersistApi[]): boolean {
  return useSyncExternalStore(
    subscribeAll(stores),
    () => stores.every((s) => s.persist.hasHydrated()),
    () => false,
  );
}
