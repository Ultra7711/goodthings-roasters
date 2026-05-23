import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   lib/productsServer.ts — products 도메인 B2C 서버 fetch (S211 Group E Phase 1)

   역할 (B2C only — S227 DEC-16 분리):
   - fetchProducts() — 메인 사이트 SSR fetch (is_active=true, sort_order asc)
   - fetchProductBySlug(slug) — PDP / 결제 / 카트 메타 조회

   S259: searchProducts(q) 폐기 — dead code (caller 0건). 실제 검색은
   lib/searchServer.fetchSearchIndex + client engine.ts 매칭으로 처리됨.

   admin variant (listProductsAdmin / listAdminProductsLite /
   fetchAdminProductRawBySlug) 는 lib/admin/productsServer.ts 분리 (ADR-009).

   설계:
   - server-only 격리.
   - cookies() 무관 anon 클라이언트 (RLS public SELECT 허용).
   - 'use cache' + cacheTag('products') — 어드민 변경 시 revalidateTag.
   - 1 쿼리 nested select (`*, product_volumes(*), product_images(*),
     product_recipes(*)`) 로 N+1 회피.
   - 호출 실패 시 [] / null 반환 (graceful fallback — 메인 사이트 깨지지 않게).

   참조:
   - lib/cafeEventsServer.ts / lib/gooddaysServer.ts (동일 패턴)
   - lib/admin/productsServer.ts (admin variant)
   - 046_products_schema.sql
   - types/product.ts (mapProductRow)
   ══════════════════════════════════════════════════════════════════════════ */

import { cacheTag } from 'next/cache';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  mapProductRow,
  type ProductWithRelationsRow,
} from '@/types/product';
import type { Product } from './products';

/** revalidateTag 로 무효화. 어드민 actions 와 일치. */
export const PRODUCTS_CACHE_TAG = 'products';

/** 1 쿼리 nested select 절 — fetch* 공통 사용 */
const PRODUCT_SELECT =
  '*, product_volumes(*), product_images(*), product_recipes(*)';

let cachedClient: SupabaseClient | null = null;

function getAnonClient(): SupabaseClient {
  if (!cachedClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error(
        '[productsServer] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 미설정',
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
export async function fetchProducts(): Promise<Product[]> {
  'use cache';
  cacheTag(PRODUCTS_CACHE_TAG);

  const client = getAnonClient();
  const { data, error } = await client
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[fetchProducts] query failed', {
      code: error.code,
      message: error.message?.slice(0, 200),
    });
    return [];
  }
  if (!data) return [];

  return (data as ProductWithRelationsRow[]).map(mapProductRow);
}

/**
 * PDP / 카트 / 결제 prefill 용 단건 조회.
 * is_active=false 인 경우에도 slug 매칭 시 반환 (어드민 미리보기·소급 카트 보호).
 */
export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  'use cache';
  cacheTag(PRODUCTS_CACHE_TAG);

  const client = getAnonClient();
  const { data, error } = await client
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    console.error('[fetchProductBySlug] query failed', {
      slug,
      code: error.code,
      message: error.message?.slice(0, 200),
    });
    return null;
  }
  if (!data) return null;

  return mapProductRow(data as ProductWithRelationsRow);
}

