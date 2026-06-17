import 'server-only';
import { isPrerenderAbort } from './prerenderAbort';

/* ══════════════════════════════════════════════════════════════════════════
   lib/gooddaysServer.ts — gooddays_gallery 서버 fetch (S167 J-3)

   역할:
   - fetchGoodDaysGallery() — /gooddays SSR fetch (is_active=true, sort_order asc)
   - listGoodDaysGalleryAdmin() — 어드민 전체 (is_active 무관)

   설계 (S321 — 'use cache' 복원 · DEC-CACHE):
   - server-only 격리.
   - 'use cache' + cacheTag(GOODDAYS_CACHE_TAG) + cacheLife(revalidate 60s) —
     매 요청 DB 조회를 60초당 1회로 절감. admin actions 가 이미
     revalidateTag(GOODDAYS_CACHE_TAG, 'max') 호출 → 즉시 반영. 무효화 실패해도
     최대 60초 stale = 안전망. menuLikes/siteSettings 선례 답습.
   - cachedClient singleton 패턴 폐기 — dev HMR closure 회귀 차단.
   - global.fetch override 로 cache: 'no-store' 강제.
   - connection() 는 caller (/gooddays default export) 책임.
   - 호출 실패 시 [] 반환 (graceful — /gooddays 빈 그리드 + placeholder).

   참조:
   - lib/bannersServer.ts (S278 ground truth 패턴)
   - 036_gooddays_gallery.sql
   ══════════════════════════════════════════════════════════════════════════ */

import { cacheTag, cacheLife } from 'next/cache';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { GdImageWithBlur } from './gooddays';

/** revalidateTag 로 무효화 — 운영 일치 위해 export 보존. admin actions 호출. */
export const GOODDAYS_CACHE_TAG = 'gooddays-gallery';

export type GoodDaysGalleryRow = GdImageWithBlur & {
  id: string;
  alt: string;
  sortOrder: number;
  isActive: boolean;
  featured: boolean;
};

/* singleton 패턴 폐기 — dev HMR 회귀 차단 (S278 학습 #4). */
function getAnonClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      '[gooddaysServer] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 미설정',
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

type RawRow = {
  id: string;
  url: string;
  alt: string;
  sort_order: number;
  is_active: boolean;
  featured: boolean;
  blur_data_url: string;
  width: number;
  height: number;
};

function toRow(raw: RawRow): GoodDaysGalleryRow {
  return {
    id: raw.id,
    src: raw.url,
    alt: raw.alt,
    sortOrder: raw.sort_order,
    isActive: raw.is_active,
    featured: raw.featured,
    blurDataURL: raw.blur_data_url,
    width: raw.width,
    height: raw.height,
  };
}

/**
 * /gooddays SSR fetch — is_active = true 만, sort_order asc.
 * caller 페이지의 default export 에서 await connection() 호출 책임.
 */
export async function fetchGoodDaysGallery(): Promise<GoodDaysGalleryRow[]> {
  'use cache';
  cacheTag(GOODDAYS_CACHE_TAG);
  cacheLife({ revalidate: 60 });

  const client = getAnonClient();
  const { data, error } = await client
    .from('gooddays_gallery')
    .select('id, url, alt, sort_order, is_active, featured, blur_data_url, width, height')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    if (!isPrerenderAbort(error.message)) {
      console.error('[fetchGoodDaysGallery] query failed', {
        code: error.code,
        message: error.message?.slice(0, 200),
      });
    }
    return [];
  }
  return (data ?? []).map((row) => toRow(row as RawRow));
}

/**
 * /admin/gooddays 전체 목록 (is_active 무관). cache 미사용 — 어드민 항상 최신.
 * admin context 는 이미 cookies()/auth 로 dynamic.
 */
export async function listGoodDaysGalleryAdmin(): Promise<GoodDaysGalleryRow[]> {
  const client = getAnonClient();
  const { data, error } = await client
    .from('gooddays_gallery')
    .select('id, url, alt, sort_order, is_active, featured, blur_data_url, width, height')
    .order('sort_order', { ascending: true });

  if (error) {

    console.error('[listGoodDaysGalleryAdmin] query failed', {
      code: error.code,
      message: error.message?.slice(0, 200),
    });
    return [];
  }
  return (data ?? []).map((row) => toRow(row as RawRow));
}
