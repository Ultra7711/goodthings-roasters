/* ══════════════════════════════════════════
   useAdminLevel — client 측 admin 등급 fetch (S264 H-2)

   설계:
   - is_admin RPC + profiles.admin_level fetch 결합 (getAdminClaims 답습)
   - userId 별 모듈 스코프 cache → 동일 세션 안에서 중복 fetch 차단
   - admin 아니면 null · admin 이면 'owner' | 'staff'
   - onAuthStateChange (SIGNED_IN / USER_UPDATED / SIGNED_OUT) listener →
     권한 부여/회수 직후 cache invalidate (code-reviewer HIGH fix)

   사용처:
   - MobileNavDrawer 의 displayName 라벨 ("관리자" / "운영자")
   - 향후 admin UI hint 가 필요한 다른 client 영역
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSupabaseSession } from './useSupabaseSession';
import type { AdminLevel } from '@/lib/auth/getClaims';

let cached: { userId: string; level: AdminLevel | null } | null = null;

/* invalidate 메커니즘 3종 (모두 module scope · 1회 등록):
   1. supabase onAuthStateChange USER_UPDATED / TOKEN_REFRESHED — user_metadata 변경 시
   2. window focus / visibilitychange — 다른 탭에서 admin 권한 부여 후 복귀 시 (95% 케이스)
   3. invalidateAdminLevelCache() — 외부 trigger (admin 액션 직후 client 측 호출 가능)
   refresh 트리거: cached=null 후 모든 subscriber 의 setState 호출 → useEffect 재 fetch. */
const refreshListeners = new Set<() => void>();

function notifyRefresh() {
  cached = null;
  refreshListeners.forEach((l) => l());
}

let invalidationListenersSubscribed = false;
function ensureInvalidationListeners() {
  if (invalidationListenersSubscribed) return;
  invalidationListenersSubscribed = true;
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
      notifyRefresh();
    }
  });
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', notifyRefresh);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') notifyRefresh();
    });
  }
}

export function useAdminLevel(): AdminLevel | null {
  const { user } = useSupabaseSession();
  const [level, setLevel] = useState<AdminLevel | null>(() => {
    if (cached && user?.id === cached.userId) return cached.level;
    return null;
  });
  /* refresh trigger — focus/visibilitychange/auth 이벤트 시 module level notifyRefresh 호출 →
     이 setter 가 의존성으로 useEffect 재 fetch 트리거. */
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const listener = () => setRefreshTick((t) => t + 1);
    refreshListeners.add(listener);
    return () => {
      refreshListeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    ensureInvalidationListeners();
    // user state sync — user 변경 시 admin level 동기 (의도된 setState in effect)
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!user) {
      setLevel(null);
      cached = null;
      return;
    }
    if (cached && cached.userId === user.id) {
      setLevel(cached.level);
      return;
    }
    /* eslint-enable react-hooks/set-state-in-effect */

    /* ── S282-P3 fast-path: JWT app_metadata.admin_level 직독 (마이그 074 Hook 적용 시) ──
       owner/staff 매치 시 RPC + profile SELECT skip (-300~600ms client-side).
       일반 사용자 = undefined → fallback (기존 RPC) 동작. */
    const appMetadata = (user.app_metadata ?? {}) as Record<string, unknown>;
    const hookAdminLevel = appMetadata.admin_level;
    if (hookAdminLevel === 'owner' || hookAdminLevel === 'staff') {
      cached = { userId: user.id, level: hookAdminLevel };
      setLevel(hookAdminLevel);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data: isAdminData, error: rpcErr } = await supabase.rpc('is_admin', {
          uid: user.id,
        });
        if (cancelled) return;
        if (rpcErr || isAdminData !== true) {
          cached = { userId: user.id, level: null };
          setLevel(null);
          return;
        }
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('admin_level')
          .eq('id', user.id)
          .maybeSingle();
        if (cancelled) return;
        if (profileErr) {
          cached = { userId: user.id, level: null };
          setLevel(null);
          return;
        }
        const lvl: AdminLevel = profile?.admin_level === 'owner' ? 'owner' : 'staff';
        cached = { userId: user.id, level: lvl };
        setLevel(lvl);
      } catch {
        if (cancelled) return;
        cached = { userId: user.id, level: null };
        setLevel(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, refreshTick]);

  return level;
}

/** 외부 트리거용 cache invalidator. 어드민이 권한 변경 직후 client 측에서 호출 가능. */
export function invalidateAdminLevelCache(): void {
  notifyRefresh();
}
