import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   lib/productsServer.ts — products 도메인 서버 fetch (S211 Group E Phase 1)

   역할:
   - fetchProducts() — 메인 사이트 SSR fetch (is_active=true, sort_order asc)
   - fetchProductBySlug(slug) — PDP / 결제 / 카트 메타 조회
   - searchProducts(q) — 검색 결과 (S215 searchServer 통합 시 이관)
   - listProductsAdmin() — 어드민 전체 (is_active 무관)

   설계:
   - server-only 격리.
   - cookies() 무관 anon 클라이언트 (RLS public SELECT 허용).
   - 'use cache' + cacheTag('products') — 어드민 변경 시 revalidateTag.
   - 1 쿼리 nested select (`*, product_volumes(*), product_images(*),
     product_recipes(*)`) 로 N+1 회피.
   - 호출 실패 시 [] / null 반환 (graceful fallback — 메인 사이트 깨지지 않게).

   참조:
   - lib/cafeEventsServer.ts / lib/gooddaysServer.ts (동일 패턴)
   - 046_products_schema.sql
   - types/product.ts (mapProductRow)
   ══════════════════════════════════════════════════════════════════════════ */

import { cacheTag } from 'next/cache';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  mapAdminProductListItem,
  mapProductRow,
  type AdminProductListItem,
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

/**
 * 검색 결과 — name / note_tags / note_tags_en / description ilike OR.
 * pg_trgm GIN 인덱스로 wildcard pattern matching 가속됨 (046 스키마).
 * S215 통합 시 searchServer 로 이관 + ranking 강화 예정.
 */
export async function searchProducts(query: string): Promise<Product[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  const client = getAnonClient();
  // ilike OR escape — 사용자 입력에서 % / , / 공백 안전 처리
  const safe = trimmed.replace(/[,%]/g, ' ');
  const pattern = `%${safe}%`;

  const { data, error } = await client
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('is_active', true)
    .or(
      `name.ilike.${pattern},note_tags.ilike.${pattern},note_tags_en.ilike.${pattern},description.ilike.${pattern}`,
    )
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[searchProducts] query failed', {
      queryLen: trimmed.length,
      code: error.code,
      message: error.message?.slice(0, 200),
    });
    return [];
  }
  if (!data) return [];

  return (data as ProductWithRelationsRow[]).map(mapProductRow);
}

/**
 * 어드민 전체 목록 (is_active 무관) — UI Product 매핑.
 * cache 미사용 (어드민 항상 최신). 정렬: sort_order asc → updated_at desc.
 *
 * settings 페이지 등 기존 Product[] 형태가 필요한 곳에서 사용.
 * /admin/products 목록 페이지는 listAdminProductsLite() 사용.
 */
export async function listProductsAdmin(): Promise<Product[]> {
  const client = getAnonClient();
  const { data, error } = await client
    .from('products')
    .select(PRODUCT_SELECT)
    .order('sort_order', { ascending: true })
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[listProductsAdmin] query failed', {
      code: error.code,
      message: error.message?.slice(0, 200),
    });
    return [];
  }
  if (!data) return [];

  return (data as ProductWithRelationsRow[]).map(mapProductRow);
}

/**
 * /admin/products 목록 페이지 전용 (S218).
 * AdminProductListItem 반환 — id / is_active / sort_order / updated_at +
 * 썸네일 (product_images sort_order 가장 낮은 1건).
 *
 * products RLS (046) = `is_active=true OR is_admin(auth.uid())` 이므로
 * is_active=false 행을 보려면 admin 세션 쿠키 필요 → createRouteHandlerClient
 * 사용. ordersServer.fetchAdminOrders 동일 패턴.
 */
export async function listAdminProductsLite(): Promise<AdminProductListItem[]> {
  const { createRouteHandlerClient } = await import('@/lib/supabaseServer');
  const client = await createRouteHandlerClient();
  const { data, error } = await client
    .from('products')
    .select(PRODUCT_SELECT)
    .order('sort_order', { ascending: true })
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[listAdminProductsLite] query failed', {
      code: error.code,
      message: error.message?.slice(0, 200),
    });
    return [];
  }
  if (!data) return [];

  return (data as ProductWithRelationsRow[]).map(mapAdminProductListItem);
}

/**
 * /admin/products/[slug]/edit 상세 편집 페이지 전용 (S218).
 * raw row (with relations) 반환 — id / is_active / sort_order / product_images.id
 * 등 admin 편집에 필요한 메타 + 이미지 reorder UI 에서 image.id 사용.
 *
 * admin RLS 통과 → is_active=false 도 fetch. cache 미사용.
 */
export async function fetchAdminProductRawBySlug(
  slug: string,
): Promise<ProductWithRelationsRow | null> {
  const { createRouteHandlerClient } = await import('@/lib/supabaseServer');
  const client = await createRouteHandlerClient();
  const { data, error } = await client
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    console.error('[fetchAdminProductRawBySlug] query failed', {
      slug,
      code: error.code,
      message: error.message?.slice(0, 200),
    });
    return null;
  }
  if (!data) return null;

  return data as ProductWithRelationsRow;
}
