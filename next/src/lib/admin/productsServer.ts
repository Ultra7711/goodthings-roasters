import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   lib/admin/productsServer.ts — /admin/products 서버 전용 fetcher (S227 DEC-16)

   분리 사유 (ADR-009):
   - 기존 lib/productsServer.ts 는 B2C 메인 사이트 SSR (`use cache` + cacheTag)
     + admin variant 3종이 한 파일에 혼재. **Locality 부재** — admin 데이터 로직
     이 lib/ 루트에 위치하여 ordersServer/usersServer/subscriptionsServer 패턴
     과 불일치.
   - admin variant 분리 후: lib/productsServer.ts = B2C only / lib/admin/
     productsServer.ts = admin only.

   역할:
   - listProductsAdmin()        — settings 페이지 (Product[] 형태)
   - listAdminProductsLite()    — /admin/products 목록 (AdminProductListItem[])
   - fetchAdminProductRawBySlug — /admin/products/[slug]/edit (raw row)

   설계 (ordersServer.ts 답습):
   - createRouteHandlerClient (admin RLS = is_active=false 도 fetch)
   - cache 미사용 (어드민 항상 최신)
   - 호출 실패 시 [] / null graceful fallback

   참조:
   - ADR-009 (admin architecture · DEC-16)
   - 046_products_schema.sql
   - types/product.ts (mapProductRow / mapAdminProductListItem)
   ══════════════════════════════════════════════════════════════════════════ */

import { createRouteHandlerClient } from '@/lib/supabaseServer';
import {
  mapAdminProductListItem,
  mapProductRow,
  type AdminProductListItem,
  type ProductWithRelationsRow,
} from '@/types/product';
import type { Product } from '@/lib/products';

/** 1 쿼리 nested select 절 — admin fetch 공통 사용 (B2C lib/productsServer 답습) */
const PRODUCT_SELECT =
  '*, product_volumes(*), product_images(*), product_recipes(*)';

/**
 * 어드민 전체 목록 (is_active 무관) — UI Product 매핑.
 * cache 미사용. 정렬: sort_order asc → updated_at desc.
 *
 * settings 페이지 등 기존 Product[] 형태가 필요한 곳에서 사용.
 * /admin/products 목록 페이지는 listAdminProductsLite() 사용.
 */
export async function listProductsAdmin(): Promise<Product[]> {
  const client = await createRouteHandlerClient();
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
 * /admin/products/new 페이지 전용 — 신규 등록 시 sort_order 자동값.
 * 같은 카테고리 내 max(sort_order) + 1 반환. row 0건이면 0.
 *
 * /shop 표시는 카테고리별로 분리되어 같은 카테고리 내 sort_order asc 정렬되므로
 * (ShopPage 답습) 카테고리 origin 으로 자동 번호 부여 → 그룹 맨 뒤 배치.
 *
 * S231-2 — drip_bag 은 신규 등록 막혀있으므로 (DRIP_BAG_RECIPE Phase 3-D)
 * 사실상 coffee_bean 만 호출. 추후 drip_bag 도메인 풀릴 때 호출 흐름 확장.
 */
export async function fetchAdminNextSortOrder(
  category: 'coffee_bean' | 'drip_bag',
): Promise<number> {
  const client = await createRouteHandlerClient();
  const { data, error } = await client
    .from('products')
    .select('sort_order')
    .eq('category', category)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[fetchAdminNextSortOrder] query failed', {
      category,
      code: error.code,
      message: error.message?.slice(0, 200),
    });
    return 0;
  }
  if (!data) return 0;
  return (data.sort_order as number) + 1;
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
