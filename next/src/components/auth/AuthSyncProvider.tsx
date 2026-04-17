/* ══════════════════════════════════════════
   AuthSyncProvider  (P0-2 · ADR-004 Step B)
   Supabase 세션 ↔ Zustand 동기화 브리지 + ['cart'] 캐시 invalidate.

   역할:
   - supabase.auth.onAuthStateChange 구독
   - SIGNED_IN / INITIAL_SESSION / TOKEN_REFRESHED → Zustand setUser
     + mergeGuestCartToServer (게스트 localStorage 카트 흡수)
     + queryClient.invalidateQueries(['cart']) — 서버 카트 재페치
   - SIGNED_OUT → clearUser + invalidateQueries(['cart']) — 게스트 모드 전환

   아키텍처 원칙 (3-tier separation):
   - Zustand: UI 힌트 (헤더 라벨, 가드 UX)  ← 이 브리지가 채움
   - Supabase Session: 세션 원천
   - Server + RLS: 보안 경계
   - TanStack Query ['cart']: 장바구니 단일 소스 (ADR-004 Step B)
   ══════════════════════════════════════════ */

'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import type { User } from '@/types/auth';
import { mergeGuestCartToServer, clearMergeFlag } from '@/lib/cartMerge';
import { CART_QUERY_KEY } from '@/hooks/useCart';

type Props = { children: ReactNode };

function mapUser(supabaseUser: SupabaseUser): User {
  const meta = supabaseUser.user_metadata ?? {};
  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? '',
    name:
      (meta.full_name as string | undefined) ??
      (meta.name as string | undefined) ??
      supabaseUser.email?.split('@')[0] ??
      '',
  };
}

export default function AuthSyncProvider({ children }: Props) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const { setUser, clearUser } = useAuthStore.getState();

      if (session?.user) {
        setUser(mapUser(session.user));

        /* guest cart → DB 1회 흡수. merge 종료 후 ['cart'] invalidate →
           useCartQuery 가 서버 카트를 재페치. fire-and-forget. */
        void mergeGuestCartToServer(session.user.id).finally(() => {
          void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
        });
      } else if (event === 'SIGNED_OUT') {
        const prevUserId = useAuthStore.getState().user?.id;
        if (prevUserId) clearMergeFlag(prevUserId);
        clearUser();
        /* 로그아웃 직후 queryFn 은 게스트 localStorage 를 읽도록 전환됨.
           캐시는 비운 뒤 재페치하여 게스트 카트 복원. */
        void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
      }
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  return <>{children}</>;
}
