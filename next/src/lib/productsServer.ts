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

   설계 (S321 — 'use cache' 복원 · DEC-CACHE):
   - server-only 격리.
   - 'use cache' + cacheTag(PRODUCTS_CACHE_TAG) + cacheLife(revalidate 60s) —
     매 요청 DB 조회를 60초당 1회로 절감 (Vercel Active CPU · Supabase 요청수 ·
     응답속도 개선). admin actions 가 이미 revalidateTag(PRODUCTS_CACHE_TAG, 'max')
     호출 → 즉시 반영. 무효화 실패해도 cacheLife 로 최대 60초 stale = 안전망.
     menuLikes/siteSettings 선례 답습 (caller connection() · no-store override 공존).
   - cachedClient singleton 패턴 폐기 — dev HMR 후 옛 client closure 가 fetch
     override 누락 회귀 발견 (S278 학습 #4).
   - global.fetch override 로 cache: 'no-store' 강제 — Next.js 16 cacheComponents
     환경에서 Supabase REST GET 이 default cache 잡히는 회귀 차단 (S278 학습 #5/6).
   - 1 쿼리 nested select (`*, product_volumes(*), product_images(*),
     product_recipes(*)`) 로 N+1 회피.
   - 호출 실패 시 [] / null 반환 (graceful fallback — 메인 사이트 깨지지 않게).

   connection() 책임 분리 (banners 와 차이 — DEC-S279-D-1):
   - banners (S278 bannersServer.ts) = helper 안 await connection() 호출
     · generateStaticParams 같은 build-time caller 없음 → 안전
   - 3-domain (products / cafe-menu / gooddays) = caller 측 책임
     · /shop/[slug]/generateStaticParams (build-time · HTTP request 없음) 가
       fetchProducts 호출 → helper 안 connection() 호출 시 build error
     · 해결: helper connection() 제거 + SSR 페이지 default export caller 가
       명시적 await connection() 호출 (5 페이지 모두 적용)
     · generateStaticParams 는 fetchAllProductSlugs() lightweight variant 사용
   - S280-B 부 banners 도 caller 측 책임으로 통일 (ADR-010).

   참조:
   - lib/bannersServer.ts (S278 ground truth 패턴)
   - lib/admin/productsServer.ts (admin variant)
   - 046_products_schema.sql
   - types/product.ts (mapProductRow)
   ══════════════════════════════════════════════════════════════════════════ */

import { cacheTag, cacheLife } from 'next/cache';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  mapProductRow,
  type ProductWithRelationsRow,
} from '@/types/product';
import type { Product } from './products';
import { isPrerenderAbort } from './prerenderAbort';

/** revalidateTag 로 무효화 — 운영 일치 위해 export 보존. admin actions 호출. */
export const PRODUCTS_CACHE_TAG = 'products';

/** 1 쿼리 nested select 절 — fetch* 공통 사용 */
const PRODUCT_SELECT =
  '*, product_volumes(*), product_images(*), product_recipes(*)';

/* singleton 패턴 폐기 — dev HMR 후 옛 client 가 closure 로 잡혀 fetch override
   적용 안 되는 회귀 발견 (S278). 매 호출 새 createClient (Supabase JS 인스턴스 비용 미미). */
function getAnonClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      '[productsServer] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 미설정',
    );
  }
  /* Next.js 16 cacheComponents:true 환경에서 GET 요청 fetch 가 default cache
     잡혀 운영자 변경 후 메인 stale. Supabase REST 요청 = GET 형태 → 명시적
     cache: 'no-store' 강제로 매 호출 fresh fetch 보장. */
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
 * caller 페이지의 default export 에서 await connection() 호출 책임
 * (generateStaticParams 같은 build-time caller 와 분리).
 */
export async function fetchProducts(): Promise<Product[]> {
  'use cache';
  cacheTag(PRODUCTS_CACHE_TAG);
  cacheLife({ revalidate: 60 });

  const client = getAnonClient();
  const { data, error } = await client
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    if (!isPrerenderAbort(error.message)) {
      console.error('[fetchProducts] query failed', {
        code: error.code,
        message: error.message?.slice(0, 200),
      });
    }
    return [];
  }
  if (!data) return [];

  return (data as ProductWithRelationsRow[]).map(mapProductRow);
}

/**
 * PDP / 카트 / 결제 prefill 용 단건 조회.
 * is_active=false 인 경우에도 slug 매칭 시 반환 (어드민 미리보기·소급 카트 보호).
 * caller 페이지의 default export 에서 await connection() 호출 책임.
 */
export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  'use cache';
  cacheTag(PRODUCTS_CACHE_TAG);
  cacheLife({ revalidate: 60 });

  const client = getAnonClient();
  const { data, error } = await client
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    if (!isPrerenderAbort(error.message)) {
      console.error('[fetchProductBySlug] query failed', {
        slug,
        code: error.code,
        message: error.message?.slice(0, 200),
      });
    }
    return null;
  }
  if (!data) return null;

  return mapProductRow(data as ProductWithRelationsRow);
}

/**
 * /shop/[slug] generateStaticParams 전용 — slug 만 lightweight fetch.
 * connection() 미사용 (build-time generateStaticParams 안전).
 * runtime SSR caller 는 fetchProducts/fetchProductBySlug 사용.
 */
export async function fetchAllProductSlugs(): Promise<string[]> {
  'use cache';
  cacheTag(PRODUCTS_CACHE_TAG);
  cacheLife({ revalidate: 60 });

  const client = getAnonClient();
  const { data, error } = await client
    .from('products')
    .select('slug')
    .eq('is_active', true);

  if (error) {
    if (!isPrerenderAbort(error.message)) {
      console.error('[fetchAllProductSlugs] query failed', {
        code: error.code,
        message: error.message?.slice(0, 200),
      });
    }
    return [];
  }
  return (data ?? []).map((row) => (row as { slug: string }).slug);
}
