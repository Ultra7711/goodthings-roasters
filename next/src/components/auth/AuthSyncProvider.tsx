/* ══════════════════════════════════════════
   AuthSyncProvider  (ADR-004 Step C-4)
   Supabase 세션 이벤트 → cart 캐시 싱크 브리지.

   역할:
   - supabase.auth.onAuthStateChange 구독
   - 로그인(session 존재) + userId 신규:
     · mergeGuestCartToServer (게스트 localStorage 카트 흡수)
     · invalidateQueries(['cart']) — 서버 카트 재페치
   - SIGNED_OUT:
     · clearMergeFlag(prevUserId) — 재로그인 시 재-merge 가능
     · invalidateQueries(['cart']) — 게스트 모드 전환

   Session 17 하드닝:
   - H-2: prevUserIdRef 차이 비교로 merge RPC 중복 호출 방지
   - H-3: merge 실패 시 toast 로 사용자 피드백
   - M-1: promise 체인에 .catch — unhandled rejection 방지
   - M-2: 새로고침 후 첫 이벤트가 SIGNED_OUT 인 경우 대비 — supabase.auth.getSession 으로 복구
   - M-4: invalidateQueries 실패 로그
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { mergeGuestCartToServer, clearMergeFlag } from '@/lib/cartMerge';
import { CART_QUERY_KEY } from '@/hooks/useCart';
import { showToast } from '@/lib/toastStore';

type Props = { children: ReactNode };

export default function AuthSyncProvider({ children }: Props) {
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    /* M-2: 새로고침 후 SIGNED_OUT 이 첫 이벤트일 때를 대비해
       mount 시 현재 session 으로 prevUserIdRef 를 선(先) 복구. */
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user && !prevUserIdRef.current) {
        prevUserIdRef.current = data.session.user.id;
      }
    });

    const invalidateCart = () => {
      queryClient
        .invalidateQueries({ queryKey: CART_QUERY_KEY })
        .catch((err) => console.error('[AuthSync] cart invalidate failed', err));
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        const userId = session.user.id;
        /* H-2: 동일 userId 재이벤트(TOKEN_REFRESHED 등) 시 merge RPC 스킵.
           단, 첫 INITIAL_SESSION / SIGNED_IN 은 ref 가 null 또는 다른 id 이므로 통과. */
        if (prevUserIdRef.current === userId) {
          invalidateCart(); // 토큰 갱신 시에도 cart 최신화 보장
          return;
        }
        prevUserIdRef.current = userId;

        /* guest cart → DB 1회 흡수. merge 종료 후 ['cart'] invalidate →
           useCartQuery 가 서버 카트를 재페치. fire-and-forget. */
        mergeGuestCartToServer(userId)
          .then((result) => {
            if (result.status === 'error') {
              console.error('[AuthSync] cart merge failed', result.detail);
              showToast('장바구니 동기화에 실패했습니다. 새로고침 후 다시 시도해 주세요.');
            }
          })
          .catch((err) => {
            /* M-1: mergeGuestCartToServer 가 throw 하는 경로 방어 */
            console.error('[AuthSync] cart merge threw', err);
            showToast('장바구니 동기화 중 오류가 발생했습니다.');
          })
          .finally(invalidateCart);
      } else if (event === 'SIGNED_OUT') {
        const prevUserId = prevUserIdRef.current;
        if (prevUserId) clearMergeFlag(prevUserId);
        prevUserIdRef.current = null;
        /* 로그아웃 직후 queryFn 은 게스트 localStorage 를 읽도록 전환됨. */
        invalidateCart();
      }
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  return <>{children}</>;
}
