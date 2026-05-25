import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   lib/menuLikesServer.ts — menu_likes SSR snapshot (S245-P20 → S247 폴리싱 → S281-B 답습)

   목적:
   페이지 첫 로딩 시 카운트/popular 정렬 점프 회피용 SSR snapshot.
   S247 부터 user liked 는 client 분리 → /menu 페이지 dynamic 화 회피
   (cookies/auth 의존 제거 → 빌드 'use cache' 효력 회복).

   설계 (S281-B · 부분 banners 답습):
   - fetchMenuLikesCountsSnapshot — anon counts 집계 ('use cache' + cacheTag 유지)
   - 'use cache' **유지** 의도적 — 사용자 좋아요 count = stale 1회 수용 가능
     (다른 사용자의 좋아요 추가 직후 1회 stale OK · /api/menu-likes 가
      revalidateTag('menu-likes', 'max') 호출로 다음 요청 시 fresh).
   - 본인 좋아요는 client store optimistic update 로 즉시 반영 (caller 측).
   - 단 S278/S279-D 답습 = cachedClient singleton 폐기 + fetch:no-store override
     로 dev HMR closure / Supabase REST default cache 회귀 차단.

   캐시 무효화:
   - 운영자/사용자 변경 시 revalidateTag('menu-likes') 호출 의무
   - admin/menu/actions.ts (delete) — 메뉴 삭제 시
   - /api/menu-likes/[menuId] POST/DELETE — 좋아요 토글 시

   참조:
   - lib/cafeMenuServer.ts (S279-D 부 'use cache' 폐기 · 본 모듈은 의도적 carry)
   - app/api/menu-likes/route.ts (client liked fetch endpoint)
   ══════════════════════════════════════════════════════════════════════════ */

import { cacheTag } from 'next/cache';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const MENU_LIKES_CACHE_TAG = 'menu-likes';

/* singleton 패턴 폐기 — S278 학습 #4 답습. dev HMR 후 옛 client closure 가
   fetch override 누락 회귀 차단. */
function getAnonClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      '[menuLikesServer] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 미설정',
    );
  }
  /* Next.js 16 cacheComponents:true 환경에서 GET 요청 fetch 가 default cache
     잡혀 'use cache' invalidate 후에도 stale 가능성 차단. */
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input as RequestInfo, { ...(init as RequestInit), cache: 'no-store' }),
    },
  });
}

/**
 * Anon counts 집계 — 빌드 캐시. revalidateTag('menu-likes') 로 무효화.
 * menu_likes RLS public select 허용.
 * 'use cache' 유지 (S281-B 의도적 carry · stale 1회 수용).
 */
export async function fetchMenuLikesCountsSnapshot(): Promise<
  Record<string, number>
> {
  'use cache';
  cacheTag(MENU_LIKES_CACHE_TAG);

  const client = getAnonClient();
  const { data, error } = await client.from('menu_likes').select('menu_id');

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[fetchMenuLikesCountsSnapshot] query failed', {
      code: error.code,
      message: error.message?.slice(0, 200),
    });
    return {};
  }

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const id = row.menu_id as string;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}
