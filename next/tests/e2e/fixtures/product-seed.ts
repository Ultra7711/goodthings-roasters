/* ══════════════════════════════════════════════════════════════════════════
   product-seed.ts — E2E 임시 product 생성/정리 helper (S264-D LOW-C)

   - service_role 로 직접 INSERT (admin Server Action 우회)
   - is_active=false 로 박음 → 사이트 노출 X, admin 페이지만 노출
   - slug 가 충돌하면 기존 row 재사용 (이전 teardown 실패 보호)
   - cleanup: 자식 image rows + storage 파일 + product row 까지 hard delete

   사용처:
   - spec 의 test.beforeAll 에서 seedTestProduct() 호출
   - test.afterAll 에서 cleanupTestProduct(seed) 호출
   ══════════════════════════════════════════════════════════════════════════ */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const PRODUCT_IMAGES_BUCKET = 'product-images';
export const E2E_PRODUCT_SLUG = 'e2e-low-c-product';

export interface SeedProduct {
  id: string;
  slug: string;
}

function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      'product-seed: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 누락',
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * E2E 전용 임시 product 1개 생성 (이미 존재하면 재사용).
 * is_active=false — 일반 사이트에 노출 0.
 *
 * volumes 1행도 함께 INSERT — products 단독으로는 detail/edit 페이지가
 * 정상 동작하지 않을 가능성 있음 (PDP 가 volumes 의존).
 */
export async function seedTestProduct(): Promise<SeedProduct> {
  const admin = adminClient();

  const { data: existing, error: selErr } = await admin
    .from('products')
    .select('id, slug')
    .eq('slug', E2E_PRODUCT_SLUG)
    .maybeSingle();
  if (selErr) throw new Error(`seedTestProduct select 실패: ${selErr.message}`);

  if (existing) {
    /* 이전 실행 잔존 — image rows + storage 만 일단 정리 후 재사용 */
    await cleanupProductImages(admin, existing.id, existing.slug);
    return { id: existing.id, slug: existing.slug };
  }

  const { data: inserted, error: insErr } = await admin
    .from('products')
    .insert({
      slug: E2E_PRODUCT_SLUG,
      category: 'coffee_bean',
      name: '[E2E] LOW-C 회귀 테스트 상품',
      display_price: '10,000원',
      color: '#cccccc',
      status: null,
      subscription: false,
      popup: false,
      description: 'E2E LOW-C 회귀 검증용 임시 상품 (자동 정리됨)',
      specs: 'E2E 전용',
      note_sweet: 3,
      note_body: 3,
      note_aftertaste: 3,
      note_aroma: 3,
      note_acidity: 3,
      note_tags: 'e2e',
      note_tags_en: 'e2e',
      flavor_desc: 'E2E test',
      note_color: '#A47146',
      roast_stage: 'medium',
      sort_order: 9999,
      is_active: false,
    })
    .select('id, slug')
    .single();
  if (insErr || !inserted) {
    throw new Error(`seedTestProduct insert 실패: ${insErr?.message}`);
  }

  /* volumes 1행 INSERT — PDP/edit 페이지 정합 */
  const { error: volErr } = await admin.from('product_volumes').insert({
    product_id: inserted.id,
    label: '200g',
    price: 10_000,
    sold_out: false,
    sort_order: 0,
  });
  if (volErr) {
    /* volumes 실패 시 product 까지 롤백 — 부분 seed 방지 */
    await admin.from('products').delete().eq('id', inserted.id);
    throw new Error(`seedTestProduct volume insert 실패: ${volErr.message}`);
  }

  return { id: inserted.id, slug: inserted.slug };
}

/**
 * seed 한 product 와 그 자식 image + storage 파일 hard delete.
 * RLS 우회 (service_role). cascading FK 가 image rows 삭제하지만
 * Storage 파일은 별도 정리.
 */
export async function cleanupTestProduct(seed: SeedProduct): Promise<void> {
  const admin = adminClient();
  await cleanupProductImages(admin, seed.id, seed.slug);
  /* product row + volumes (cascade) 삭제 */
  const { error: delErr } = await admin
    .from('products')
    .delete()
    .eq('id', seed.id);
  if (delErr) {
    /* teardown 단계 — throw 안 함 (테스트 결과는 이미 보고됨). 로그만. */
    console.warn(
      `[product-seed] product delete 실패 (id=${seed.id}): ${delErr.message}`,
    );
  }
}

/**
 * 특정 product 의 모든 image row + storage 파일 정리.
 * product 자체는 유지 — re-seed 또는 race 시나리오 재실행 시 사용.
 */
export async function cleanupProductImages(
  admin: SupabaseClient,
  productId: string,
  slug: string,
): Promise<void> {
  /* DB row 조회 — storage path 추출용 */
  const { data: rows } = await admin
    .from('product_images')
    .select('id, src')
    .eq('product_id', productId);

  if (rows && rows.length > 0) {
    const paths = rows
      .map((r) => extractStoragePath(String(r.src)))
      .filter((p): p is string => p !== null);
    if (paths.length > 0) {
      const { error: rmErr } = await admin.storage
        .from(PRODUCT_IMAGES_BUCKET)
        .remove(paths);
      if (rmErr) {
        console.warn(
          `[product-seed] storage remove 실패 (${paths.length} files): ${rmErr.message}`,
        );
      }
    }
    const { error: delErr } = await admin
      .from('product_images')
      .delete()
      .eq('product_id', productId);
    if (delErr) {
      console.warn(
        `[product-seed] image rows delete 실패: ${delErr.message}`,
      );
    }
  }

  /* 폴더 안의 잔존 파일 정리 — DB row 없이 남은 orphan 까지 정리 */
  const { data: list } = await admin.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .list(slug, { limit: 100 });
  if (list && list.length > 0) {
    const orphanPaths = list.map((f) => `${slug}/${f.name}`);
    const { error: rmOrphErr } = await admin.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .remove(orphanPaths);
    if (rmOrphErr) {
      console.warn(
        `[product-seed] orphan storage 정리 실패: ${rmOrphErr.message}`,
      );
    }
  }
}

/**
 * publicUrl 에서 Storage path 추출 (imageActions.deleteProductImageAction 답습).
 */
function extractStoragePath(url: string): string | null {
  const marker = `/${PRODUCT_IMAGES_BUCKET}/`;
  const idx = url.indexOf(marker);
  return idx >= 0 ? url.slice(idx + marker.length) : null;
}

/**
 * 특정 product 의 현재 image rows 조회 — 회귀 검증용.
 */
export async function listProductImageRows(
  productId: string,
): Promise<Array<{ id: string; src: string; sort_order: number; is_active: boolean }>> {
  const admin = adminClient();
  const { data, error } = await admin
    .from('product_images')
    .select('id, src, sort_order, is_active')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(`listProductImageRows 실패: ${error.message}`);
  return (data ?? []) as Array<{
    id: string;
    src: string;
    sort_order: number;
    is_active: boolean;
  }>;
}

/**
 * 특정 product 의 storage 폴더 파일 list 조회 — 회귀 검증용.
 */
export async function listProductStorageFiles(slug: string): Promise<string[]> {
  const admin = adminClient();
  const { data, error } = await admin.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .list(slug, { limit: 100 });
  if (error) throw new Error(`listProductStorageFiles 실패: ${error.message}`);
  return (data ?? []).map((f) => f.name);
}
