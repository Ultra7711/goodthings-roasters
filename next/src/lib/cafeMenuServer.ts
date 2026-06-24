import 'server-only';
import { isPrerenderAbort } from './prerenderAbort';

/* ══════════════════════════════════════════════════════════════════════════
   lib/cafeMenuServer.ts — cafe_menu_items 도메인 서버 fetch (S213 Group F Phase 1)

   역할:
   - fetchCafeMenu() — 메인 사이트 SSR fetch (is_active=true, sort_order asc)

   설계 (S321 — 'use cache' 복원 · DEC-CACHE):
   - server-only 격리.
   - 'use cache' + cacheTag(CAFE_MENU_CACHE_TAG) + cacheLife(revalidate 60s) —
     매 요청 DB 조회를 60초당 1회로 절감. admin actions 가 이미
     revalidateTag(CAFE_MENU_CACHE_TAG, 'max') 호출 → 즉시 반영. 무효화 실패해도
     최대 60초 stale = 안전망. menuLikes/siteSettings 선례 답습.
   - cachedClient singleton 패턴 폐기 — dev HMR closure 회귀 차단.
   - global.fetch override 로 cache: 'no-store' 강제.
   - connection() 는 caller (SSR 페이지 default export) 책임 — CafeMenuSection
     은 이미 connection() 호출 (S278). /menu 등 추가 caller 도 동일 책임.
   - 호출 실패 시 [] 반환 (graceful fallback — 메인 사이트 깨지지 않게).

   참조:
   - lib/bannersServer.ts (S278 ground truth 패턴)
   - 047_cafe_menu_schema.sql
   - types/cafeMenu.ts (mapCafeMenuRow)
   ══════════════════════════════════════════════════════════════════════════ */

import { cacheTag, cacheLife } from 'next/cache';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { mapCafeMenuRow, type CafeMenuItemRow } from '@/types/cafeMenu';
import type { CafeMenuItem } from './cafeMenu';

/** revalidateTag 로 무효화 — 운영 일치 위해 export 보존. admin actions 호출. */
export const CAFE_MENU_CACHE_TAG = 'cafe-menu';

/* singleton 패턴 폐기 — dev HMR 회귀 차단 (S278 학습 #4). */
function getAnonClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      '[cafeMenuServer] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 미설정',
    );
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input as RequestInfo, { ...(init as RequestInit), cache: 'no-store' }),
    },
  });
}

/**
 * 메인 사이트 SSR fetch — is_active=true 만, sort_order asc.
 * caller 페이지의 default export 에서 await connection() 호출 책임.
 */
export async function fetchCafeMenu(): Promise<CafeMenuItem[]> {
  'use cache';
  cacheTag(CAFE_MENU_CACHE_TAG);
  cacheLife({ revalidate: 60 });

  const client = getAnonClient();
  const { data, error } = await client
    .from('cafe_menu_items')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    if (!isPrerenderAbort(error.message)) {
      console.error('[fetchCafeMenu] query failed', {
        code: error.code,
        message: error.message?.slice(0, 200),
      });
    }
    return [];
  }
  if (!data) return [];

  /* S331: NEW 자동 만료 — 한 번 캡처한 now 로 전 row 일관 판정.
     'use cache'(cacheLife 60s) 라 이 값은 최대 60초 캐시 → 만료 반영 최대 60초+ 지연(허용).
     .map(mapCafeMenuRow) 직접 전달 금지 — Array index 가 nowMs 자리로 들어가 판정이 깨짐. */
  const now = Date.now();
  return (data as CafeMenuItemRow[]).map((row) => mapCafeMenuRow(row, now));
}
