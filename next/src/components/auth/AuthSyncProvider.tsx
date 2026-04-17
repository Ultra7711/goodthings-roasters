/* ══════════════════════════════════════════
   AuthSyncProvider  (ADR-004 Step C-4)
   Supabase 세션 이벤트 → cart 캐시 싱크 브리지.

   역할:
   - supabase.auth.onAuthStateChange 구독
   - 로그인(session 존재):
     · mergeGuestCartToServer (게스트 localStorage 카트 흡수)
     · queryClient.invalidateQueries(['cart']) — 서버 카트 재페치
   - SIGNED_OUT:
     · clearMergeFlag(prevUserId) — 재로그인 시 재-merge 가능하도록
     · invalidateQueries(['cart']) — 게스트 모드 전환

   ADR-004 Step C-4: useAuthStore 삭제 완료. Supabase session =
   단일 소스 (useSupabaseSession 훅). 이 프로바이더는 cart 싱크만 담당.
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { mergeGuestCartToServer, clearMergeFlag } from '@/lib/cartMerge';
import { CART_QUERY_KEY } from '@/hooks/useCart';

type Props = { children: ReactNode };

export default function AuthSyncProvider({ children }: Props) {
  const queryClient = useQueryClient();
  /* SIGNED_OUT 시점에서 직전 user id 를 복구하기 위한 ref.
     세션 이벤트가 로그아웃일 때는 session=null 이므로 별도 보관 필요. */
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        prevUserIdRef.current = session.user.id;

        /* guest cart → DB 1회 흡수. merge 종료 후 ['cart'] invalidate →
           useCartQuery 가 서버 카트를 재페치. fire-and-forget.
           merge 실패는 console.error 로 노출 — 사용자 toast 는 상위 레이어 결정. */
        void mergeGuestCartToServer(session.user.id)
          .then((result) => {
            if (result.status === 'error') {
              console.error('[AuthSync] cart merge failed', result.detail);
            }
          })
          .finally(() => {
            void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
          });
      } else if (event === 'SIGNED_OUT') {
        const prevUserId = prevUserIdRef.current;
        if (prevUserId) clearMergeFlag(prevUserId);
        prevUserIdRef.current = null;
        /* 로그아웃 직후 queryFn 은 게스트 localStorage 를 읽도록 전환됨.
           캐시는 비운 뒤 재페치하여 게스트 카트 복원. */
        void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
      }
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  return <>{children}</>;
}
