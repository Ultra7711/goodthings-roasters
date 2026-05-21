import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   lib/menuLikesServer.ts — menu_likes SSR snapshot (S245-P20 Phase 1)

   목적:
   페이지 첫 로딩 시 client fetch `/api/menu-likes` 가 도착하기 전까지 카드
   reorder + popularRank 배지 등장 등으로 점프 발생. SSR 시점에 미리 fetch
   하여 store hydrate → 첫 렌더부터 완성 상태.

   설계:
   - fetchMenuLikesCountsSnapshot — anon counts 집계 ('use cache' + cacheTag)
   - fetchUserMenuLikes — user-specific liked ID (no cache · cookies 의존)
   - fetchMenuLikesSnapshot — 위 둘 Promise.all 통합

   호출:
   - /menu/page.tsx (server component) — 통합 fetch → CafeMenuPage prop

   캐시 무효화:
   - 운영자/사용자 변경 시 revalidateTag('menu-likes') 호출 의무
   - admin/menu/actions.ts (delete) — 메뉴 삭제 시
   - /api/menu-likes/[menuId] POST/DELETE — 좋아요 토글 시 (필요 시 추후)

   참조:
   - lib/cafeMenuServer.ts (동일 패턴 — anon + cache · CAFE_MENU_CACHE_TAG)
   - app/api/menu-likes/route.ts (기존 client fetch 응답 형식 동일)
   ══════════════════════════════════════════════════════════════════════════ */

import { cacheTag } from 'next/cache';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { getClaims } from '@/lib/auth/getClaims';

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

/**
 * 로그인 사용자의 좋아요 ID 목록 — no cache (user-specific · cookies 의존).
 * 비로그인 = 빈 배열.
 */
export async function fetchUserMenuLikes(): Promise<string[]> {
  const claims = await getClaims();
  if (!claims) return [];

  const client = await createRouteHandlerClient();
  const { data, error } = await client
    .from('menu_likes')
    .select('menu_id')
    .eq('user_id', claims.userId);

  if (error) {
    console.error('[fetchUserMenuLikes] query failed', {
      code: error.code,
      message: error.message?.slice(0, 200),
    });
    return [];
  }
  return (data ?? []).map((r) => r.menu_id as string);
}

/**
 * SSR 통합 snapshot — server component 에서 단일 호출.
 * Promise.all 로 counts (cache) + user liked (no cache) 병렬.
 */
export async function fetchMenuLikesSnapshot(): Promise<{
  counts: Record<string, number>;
  liked: string[];
}> {
  const [counts, liked] = await Promise.all([
    fetchMenuLikesCountsSnapshot(),
    fetchUserMenuLikes(),
  ]);
  return { counts, liked };
}
