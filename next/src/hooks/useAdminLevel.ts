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

/* USER_UPDATED 이벤트 (예: 관리자가 staff 승격 후 user_metadata refresh) 시 invalidate.
   SIGNED_OUT 은 useEffect 의 !user 분기가 처리. 별 listener 등록은 1회 (module scope). */
let authListenerSubscribed = false;
function ensureAuthInvalidationListener() {
  if (authListenerSubscribed) return;
  authListenerSubscribed = true;
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
      cached = null;
    }
  });
}

export function useAdminLevel(): AdminLevel | null {
  const { user } = useSupabaseSession();
  const [level, setLevel] = useState<AdminLevel | null>(() => {
    if (cached && user?.id === cached.userId) return cached.level;
    return null;
  });

  useEffect(() => {
    ensureAuthInvalidationListener();
    if (!user) {
      setLevel(null);
      cached = null;
      return;
    }
    if (cached && cached.userId === user.id) {
      setLevel(cached.level);
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
  }, [user]);

  return level;
}

/** 외부 트리거용 cache invalidator. 어드민이 권한 변경 직후 client 측에서 호출 가능. */
export function invalidateAdminLevelCache(): void {
  cached = null;
}
