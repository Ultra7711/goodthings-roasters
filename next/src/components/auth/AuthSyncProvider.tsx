/* ══════════════════════════════════════════
   AuthSyncProvider  (P0-2)
   Supabase 세션 ↔ Zustand 동기화 브리지.

   역할:
   - supabase.auth.onAuthStateChange 구독
   - SIGNED_IN / INITIAL_SESSION / TOKEN_REFRESHED → Zustand setUser
   - SIGNED_OUT → Zustand clearUser
   - 그 외 이벤트는 무시

   배치: 루트 layout.tsx (body 직계 자식)
   → 모든 OAuth 완료 경로(Naver·Kakao magic link, Google /auth/callback)에서
     세션이 수립되는 즉시 Zustand가 동기화된다.

   아키텍처 원칙 (3-tier separation):
   - Zustand: UI 힌트 (헤더 라벨, 가드 UX)  ← 이 브리지가 채움
   - Supabase Session: 세션 원천
   - Server + RLS: 보안 경계 (getUser() — P1-2에서 추가)
   ══════════════════════════════════════════ */

'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAuthStore, useCartStore } from '@/lib/store';
import type { User } from '@/types/auth';
import { mergeGuestCartToServer, clearMergeFlag } from '@/lib/cartMerge';

type Props = { children: ReactNode };

/** Supabase User → 로컬 User 타입 변환 */
function mapUser(supabaseUser: SupabaseUser): User {
  const meta = supabaseUser.user_metadata ?? {};
  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? '',
    // Naver/Kakao 콜백이 full_name으로 저장, Google은 name도 사용
    name:
      (meta.full_name as string | undefined) ??
      (meta.name as string | undefined) ??
      supabaseUser.email?.split('@')[0] ??
      '',
  };
}

export default function AuthSyncProvider({ children }: Props) {
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // store 접근은 훅이 아닌 getState()로 — 렌더 사이클 밖 안전
      const { setUser, clearUser } = useAuthStore.getState();

      if (session?.user) {
        // SIGNED_IN · INITIAL_SESSION · TOKEN_REFRESHED 모두 포함
        setUser(mapUser(session.user));

        /* guest cart → DB 1회 흡수. sessionStorage 플래그로 중복 방지.
         * fire-and-forget: auth 동기화 블로킹 금지, 실패는 플래그 미설정으로 재시도. */
        const { items, clearCart } = useCartStore.getState();
        void mergeGuestCartToServer(session.user.id, items, clearCart);
      } else if (event === 'SIGNED_OUT') {
        // 명시적 로그아웃 시에만 clearUser 호출 (cart 비움 포함)
        const prevUserId = useAuthStore.getState().user?.id;
        if (prevUserId) clearMergeFlag(prevUserId);
        clearUser();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return <>{children}</>;
}
