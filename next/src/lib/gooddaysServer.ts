import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   lib/gooddaysServer.ts — gooddays_gallery 서버 fetch (S167 J-3)

   역할:
   - fetchGoodDaysGallery() — /gooddays SSR fetch (is_active=true, sort_order asc)
   - listGoodDaysGalleryAdmin() — 어드민 전체 (is_active 무관)

   설계:
   - server-only 격리.
   - cookies() 무관 anon 클라이언트 (RLS public SELECT 허용).
   - 'use cache' + cacheTag('gooddays-gallery') — 어드민 변경 시 revalidateTag.
   - 호출 실패 시 [] 반환 (graceful — /gooddays 빈 그리드 + placeholder).

   참조:
   - lib/bannersServer.ts (동일 패턴)
   - 036_gooddays_gallery.sql
   ══════════════════════════════════════════════════════════════════════════ */

import { cacheTag } from 'next/cache';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { GdImageWithBlur } from './gooddays';

/** revalidateTag 로 무효화. 어드민 actions 와 일치. */
export const GOODDAYS_CACHE_TAG = 'gooddays-gallery';

export type GoodDaysGalleryRow = GdImageWithBlur & {
  id: string;
  alt: string;
  sortOrder: number;
  isActive: boolean;
  featured: boolean;
};

let cachedClient: SupabaseClient | null = null;

function getAnonClient(): SupabaseClient {
  if (!cachedClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error(
        '[gooddaysServer] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 미설정',
      );
    }
    cachedClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedClient;
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
 * 빌드 타임 캐시 + revalidateTag 무효화.
 */
export async function fetchGoodDaysGallery(): Promise<GoodDaysGalleryRow[]> {
  'use cache';
  cacheTag(GOODDAYS_CACHE_TAG);

  const client = getAnonClient();
  const { data, error } = await client
    .from('gooddays_gallery')
    .select('id, url, alt, sort_order, is_active, featured, blur_data_url, width, height')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[fetchGoodDaysGallery] query failed', {
      code: error.code,
      message: error.message?.slice(0, 200),
    });
    return [];
  }
  return (data ?? []).map((row) => toRow(row as RawRow));
}

/**
 * /admin/gooddays 전체 목록 (is_active 무관). cache 미사용 — 어드민 항상 최신.
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
