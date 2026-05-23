import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   lib/cafeMenuServer.ts — cafe_menu_items 도메인 서버 fetch (S213 Group F Phase 1)

   역할:
   - fetchCafeMenu() — 메인 사이트 SSR fetch (is_active=true, sort_order asc)

   설계:
   - server-only 격리.
   - cookies() 무관 anon 클라이언트 (RLS public SELECT 허용).
   - 'use cache' + cacheTag('cafe-menu') — 어드민 변경 시 revalidateTag.
   - 호출 실패 시 [] 반환 (graceful fallback — 메인 사이트 깨지지 않게).

   참조:
   - lib/productsServer.ts (동일 패턴)
   - 047_cafe_menu_schema.sql
   - types/cafeMenu.ts (mapCafeMenuRow)
   ══════════════════════════════════════════════════════════════════════════ */

import { cacheTag } from 'next/cache';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { mapCafeMenuRow, type CafeMenuItemRow } from '@/types/cafeMenu';
import type { CafeMenuItem } from './cafeMenu';

/** revalidateTag 로 무효화. 어드민 actions 와 일치. */
export const CAFE_MENU_CACHE_TAG = 'cafe-menu';

let cachedClient: SupabaseClient | null = null;

function getAnonClient(): SupabaseClient {
  if (!cachedClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error(
        '[cafeMenuServer] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 미설정',
      );
    }
    cachedClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedClient;
}

/**
 * 메인 사이트 SSR fetch — is_active=true 만, sort_order asc.
 * 빌드 타임 캐시 + revalidateTag 무효화.
 */
export async function fetchCafeMenu(): Promise<CafeMenuItem[]> {
  'use cache';
  cacheTag(CAFE_MENU_CACHE_TAG);

  const client = getAnonClient();
  const { data, error } = await client
    .from('cafe_menu_items')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[fetchCafeMenu] query failed', {
      code: error.code,
      message: error.message?.slice(0, 200),
    });
    return [];
  }
  if (!data) return [];

  return (data as CafeMenuItemRow[]).map(mapCafeMenuRow);
}

