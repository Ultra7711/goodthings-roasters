import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   lib/menuLikesServer.ts — menu_likes SSR snapshot (S245-P20 → S247 폴리싱)

   목적:
   페이지 첫 로딩 시 카운트/popular 정렬 점프 회피용 SSR snapshot.
   S247 부터 user liked 는 client 분리 → /menu 페이지 dynamic 화 회피
   (cookies/auth 의존 제거 → 빌드 'use cache' 효력 회복).

   설계:
   - fetchMenuLikesCountsSnapshot — anon counts 집계 ('use cache' + cacheTag)
   - user liked 는 client menuLikesStore.fetchMyMenuLikes 가 /api/menu-likes 호출

   캐시 무효화:
   - 운영자/사용자 변경 시 revalidateTag('menu-likes') 호출 의무
   - admin/menu/actions.ts (delete) — 메뉴 삭제 시

   참조:
   - lib/cafeMenuServer.ts (동일 패턴 — anon + cache · CAFE_MENU_CACHE_TAG)
   - app/api/menu-likes/route.ts (client liked fetch endpoint)
   ══════════════════════════════════════════════════════════════════════════ */

import { cacheTag } from 'next/cache';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const MENU_LIKES_CACHE_TAG = 'menu-likes';

let cachedAnonClient: SupabaseClient | null = null;

function getAnonClient(): SupabaseClient {
  if (!cachedAnonClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error(
        '[menuLikesServer] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 미설정',
      );
    }
    cachedAnonClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedAnonClient;
}

/**
 * Anon counts 집계 — 빌드 캐시. revalidateTag('menu-likes') 로 무효화.
 * menu_likes RLS public select 허용.
 */
export async function fetchMenuLikesCountsSnapshot(): Promise<
  Record<string, number>
> {
  'use cache';
  cacheTag(MENU_LIKES_CACHE_TAG);

  const client = getAnonClient();
  const { data, error } = await client.from('menu_likes').select('menu_id');

  if (error) {
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
