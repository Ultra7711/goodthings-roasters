'use server';

/* ══════════════════════════════════════════════════════════════════════════
   productActions.ts — /admin/products 상품 CRUD Server Actions (S256-B)

   책임 (product domain):
   1) toggleProductActiveAction — is_active on/off (목록 인라인 토글)
   2) updateProductMetaAction — products + volumes + recipes UPDATE (S218 / S231)
   3) createProductAction — create_product RPC 단일 트랜잭션 호출 (S231-2 / S231-4)
   4) deleteProductAction — products hard delete + Storage 폴더 cleanup (S231-4)
   5) reorderProductsAction — 카테고리 내 상품 순서 변경 (S250-6-#1)

   image domain (이미지 갤러리 reorder/upload/delete/active) 는 imageActions.ts.
   caller 는 productActions / imageActions 에서 직접 import (S256-B v2 —
   actions.ts re-export 폐기. Next.js 16 'use server' = async function 만 export
   허용. PRODUCT_IMAGES_BUCKET 도 _constants.ts 격리.
   [[feedback-use-server-async-only]] · [[feedback-server-action-split-next-build]]).
   ══════════════════════════════════════════════════════════════════════════ */

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { getAdminClaims, getAdminOwnerClaims } from '@/lib/auth/getClaims';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PRODUCTS_CACHE_TAG } from '@/lib/productsServer';
import { PRODUCT_IMAGES_BUCKET } from './_constants';

/* ── Common schemas (product domain 전용) ─────────────────────────────── */

const ProductStatusEnum = z
  .enum(['NEW', '인기 NO.1', '인기 NO.2', '인기 NO.3', '수량 한정', '품절'])
  .nullable();

const HexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, '#RRGGBB 형식이어야 합니다');

const RoastStageEnum = z.enum([
  'light',
  'medium-light',
  'medium',
  'medium-dark',
  'dark',
  'italian',
]);

const FlavorAxisSchema = z.number().min(0).max(5);

const FlavorChipSchema = z.object({
  ko: z.string().min(1),
  en: z.string(),
});

const VolumeInputSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1).max(50),
  price: z.number().int().min(0).max(99_999_999),
  soldOut: z.boolean(),
});

const RecipeInputSchema = z.object({
  id: z.string().uuid().optional(),
  method: z.string().min(1).max(50),
  dose: z.string().min(1).max(50),
  temp: z.string().min(1).max(50),
  time: z.string().min(1).max(50),
  water: z.string().min(1).max(50),
});

/* ── toggleProductActiveAction ────────────────────────────────────────── */

const ToggleActiveSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
});

type ToggleActiveResult =
  | { ok: true; id: string; isActive: boolean }
  | {
      ok: false;
      error: 'unauthorized' | 'not_found' | 'validation_failed' | 'server_error';
      detail?: string;
    };

/**
 * 상품 활성/비활성 토글 (admin 목록 인라인 토글).
 *
 * - admin 차단 시 unauthorized
 * - id / isActive 검증 (zod)
 * - UPDATE products SET is_active
 * - revalidateTag('products') + revalidatePath('/admin/products')
 */
export async function toggleProductActiveAction(input: {
  id: string;
  isActive: boolean;
}): Promise<ToggleActiveResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = ToggleActiveSchema.safeParse(input);
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      error: 'validation_failed',
      detail: Object.entries(fields)
        .map(([k, v]) => `${k}:${(v as string[])[0]}`)
        .join('; ')
        .slice(0, 200),
    };
  }

  const { id, isActive } = parsed.data;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('products')
    .update({ is_active: isActive })
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[toggleProductActiveAction] update failed', {
      code: error.code,
      message: error.message?.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }
  if (!data) return { ok: false, error: 'not_found' };

  revalidateTag(PRODUCTS_CACHE_TAG, 'max');
  revalidatePath('/admin/products');

  return { ok: true, id, isActive };
}

/* ── updateProductMetaAction ──────────────────────────────────────────── */

const UpdateProductMetaSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1).max(80),
  name: z.string().min(1).max(60),
  category: z.enum(['coffee_bean', 'drip_bag']),
  status: ProductStatusEnum,
  displayPrice: z.string().min(1).max(30),
  sortOrder: z.number().int().min(0).max(9999),
  color: HexColorSchema,
  subscription: z.boolean(),
  popup: z.boolean(),
  description: z.string().max(4000),
  flavorDesc: z.string().max(200),
  roastStage: RoastStageEnum,
  roastDesc: z.string().max(500),
  noteChips: z.array(FlavorChipSchema).max(20),
  noteColor: HexColorSchema,
  noteSweet: FlavorAxisSchema,
  noteBody: FlavorAxisSchema,
  noteAftertaste: FlavorAxisSchema,
  noteAroma: FlavorAxisSchema,
  noteAcidity: FlavorAxisSchema,
  volumes: z.array(VolumeInputSchema).min(1),
  recipes: z.array(RecipeInputSchema),
});

type UpdateProductMetaInput = z.infer<typeof UpdateProductMetaSchema>;

type UpdateProductMetaResult =
  | { ok: true; id: string }
  | {
      ok: false;
      error: 'unauthorized' | 'validation_failed' | 'not_found' | 'server_error';
      detail?: string;
    };

/**
 * products 단일 row 메타 UPDATE (S218 Phase 1 추가).
 *
 * volumes / recipes sync 전략 (S231-7 사용자 결정 = B):
 * - 서버 기존 ID 집합 조회 → 클라이언트에 빠진 ID 는 DELETE
 * - 클라이언트 row 는 UPSERT (id 있으면 UPDATE · 없으면 INSERT · sort_order = idx)
 * - drip_bag 의 경우 recipes 는 항상 빈 배열로 강제.
 */
export async function updateProductMetaAction(
  input: UpdateProductMetaInput,
): Promise<UpdateProductMetaResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = UpdateProductMetaSchema.safeParse(input);
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      error: 'validation_failed',
      detail: Object.entries(fields)
        .map(([k, v]) => `${k}:${(v as string[])[0]}`)
        .join('; ')
        .slice(0, 200),
    };
  }
  const v = parsed.data;
  const noteTagsJoined = v.noteChips.map((c) => c.ko).join(' | ');
  const noteTagsEnJoined = v.noteChips.map((c) => c.en).join(' | ');
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('products')
    .update({
      name: v.name,
      category: v.category,
      status: v.status,
      display_price: v.displayPrice,
      sort_order: v.sortOrder,
      color: v.color,
      subscription: v.subscription,
      popup: v.popup,
      description: v.description,
      flavor_desc: v.flavorDesc,
      roast_stage: v.roastStage,
      roast_desc: v.roastDesc,
      note_tags: noteTagsJoined,
      note_tags_en: noteTagsEnJoined,
      note_color: v.noteColor,
      note_sweet: v.noteSweet,
      note_body: v.noteBody,
      note_aftertaste: v.noteAftertaste,
      note_aroma: v.noteAroma,
      note_acidity: v.noteAcidity,
    })
    .eq('id', v.id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[updateProductMetaAction] update failed', {
      code: error.code,
      message: error.message?.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }
  if (!data) return { ok: false, error: 'not_found' };

  /* volumes / recipes sync — S231-7 (UPSERT + DELETE missing) */
  const volSyncErr = await syncProductChildren(admin, {
    table: 'product_volumes',
    productId: v.id,
    rows: v.volumes.map((row, idx) => ({
      ...(row.id ? { id: row.id } : {}),
      product_id: v.id,
      label: row.label,
      price: row.price,
      sold_out: row.soldOut,
      sort_order: idx,
    })),
  });
  if (volSyncErr) {
    console.error('[updateProductMetaAction] volumes sync failed', volSyncErr);
    return { ok: false, error: 'server_error', detail: 'volumes sync 실패' };
  }

  /* drip_bag 의 recipes 는 빈 배열로 강제 */
  const recipesToSync = v.category === 'coffee_bean' ? v.recipes : [];
  const recipeSyncErr = await syncProductChildren(admin, {
    table: 'product_recipes',
    productId: v.id,
    rows: recipesToSync.map((row, idx) => ({
      ...(row.id ? { id: row.id } : {}),
      product_id: v.id,
      method: row.method,
      dose: row.dose,
      temp: row.temp,
      time: row.time,
      water: row.water,
      sort_order: idx,
    })),
  });
  if (recipeSyncErr) {
    console.error('[updateProductMetaAction] recipes sync failed', recipeSyncErr);
    return { ok: false, error: 'server_error', detail: 'recipes sync 실패' };
  }

  revalidateTag(PRODUCTS_CACHE_TAG, 'max');
  revalidatePath('/admin/products');
  revalidatePath(`/admin/products/${v.slug}/edit`);
  revalidatePath('/shop');
  revalidatePath(`/shop/${v.slug}`);

  return { ok: true, id: v.id };
}

/* ── product_volumes / product_recipes 자식 sync 헬퍼 ─────────────────────
   전략: 서버 현재 ID 집합 조회 → 클라이언트에 없는 ID 는 DELETE,
         클라이언트 row 는 UPSERT (id 없으면 INSERT, 있으면 UPDATE).
         실패 시 부분 stale 가능하지만 데이터 손실은 0 (재시도 가능). */
async function syncProductChildren(
  admin: ReturnType<typeof getSupabaseAdmin>,
  args: {
    table: 'product_volumes' | 'product_recipes';
    productId: string;
    rows: Array<Record<string, unknown>>;
  },
): Promise<string | null> {
  const { table, productId, rows } = args;

  const { data: existing, error: selErr } = await admin
    .from(table)
    .select('id')
    .eq('product_id', productId);
  if (selErr) return `select ${table} 실패: ${selErr.message}`;

  const clientIds = new Set(
    rows.map((r) => r.id).filter((id): id is string => typeof id === 'string'),
  );
  const idsToDelete = (existing ?? [])
    .map((r) => r.id as string)
    .filter((id) => !clientIds.has(id));

  if (idsToDelete.length > 0) {
    const { error: delErr } = await admin
      .from(table)
      .delete()
      .in('id', idsToDelete);
    if (delErr) return `delete ${table} 실패: ${delErr.message}`;
  }

  if (rows.length > 0) {
    const { error: upErr } = await admin
      .from(table)
      .upsert(rows, { onConflict: 'id' });
    if (upErr) return `upsert ${table} 실패: ${upErr.message}`;
  }

  return null;
}

/* ── createProductAction ──────────────────────────────────────────────── */

const SlugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    '소문자/숫자 + 하이픈만 가능합니다 (예: autumn-night)',
  );

/* sortOrder 는 입력에서 무시 — create_product RPC 내부에서 카테고리 max+1 재계산 (S231-4).
   ProductEditForm 의 FormValues 에는 sortOrder 가 있지만 zod strip 으로 통과. */
const CreateProductSchema = z.object({
  slug: SlugSchema,
  name: z.string().min(1).max(60),
  category: z.enum(['coffee_bean', 'drip_bag']),
  status: ProductStatusEnum,
  displayPrice: z.string().min(1).max(30),
  color: HexColorSchema,
  subscription: z.boolean(),
  popup: z.boolean(),
  description: z.string().max(4000),
  flavorDesc: z.string().max(200),
  roastStage: RoastStageEnum,
  roastDesc: z.string().max(500),
  noteChips: z.array(FlavorChipSchema).max(20),
  noteColor: HexColorSchema,
  noteSweet: FlavorAxisSchema,
  noteBody: FlavorAxisSchema,
  noteAftertaste: FlavorAxisSchema,
  noteAroma: FlavorAxisSchema,
  noteAcidity: FlavorAxisSchema,
  volumes: z.array(VolumeInputSchema).min(1),
  recipes: z.array(RecipeInputSchema),
});

type CreateProductInput = z.infer<typeof CreateProductSchema>;

type CreateProductResult =
  | { ok: true; slug: string }
  | {
      ok: false;
      error:
        | 'unauthorized'
        | 'validation_failed'
        | 'slug_conflict'
        | 'server_error';
      detail?: string;
    };

/**
 * create_product RPC 호출 (S231-4 트랜잭션 보강).
 *
 * - products + volumes + recipes 한 트랜잭션 INSERT (RPC 안에서 보장)
 * - sort_order 는 RPC 내부에서 카테고리 max+1 재계산
 * - slug UNIQUE 위반 → SQLSTATE 23505 → 'slug_conflict' 반환
 * - is_active=false 안전장치 (RPC 안에서 박음 · 운영자가 검토 후 공개)
 * - 이미지 INSERT 제외 — 등록 후 edit 페이지의 이미지 갤러리 섹션에서 업로드.
 */
export async function createProductAction(
  input: CreateProductInput,
): Promise<CreateProductResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = CreateProductSchema.safeParse(input);
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      error: 'validation_failed',
      detail: Object.entries(fields)
        .map(([k, v]) => `${k}:${(v as string[])[0]}`)
        .join('; ')
        .slice(0, 200),
    };
  }
  const v = parsed.data;
  const noteTagsJoined = v.noteChips.map((c) => c.ko).join(' | ');
  const noteTagsEnJoined = v.noteChips.map((c) => c.en).join(' | ');

  const payload = {
    slug: v.slug,
    name: v.name,
    category: v.category,
    status: v.status ?? '',
    display_price: v.displayPrice,
    color: v.color,
    subscription: v.subscription,
    popup: v.popup,
    description: v.description,
    flavor_desc: v.flavorDesc,
    roast_stage: v.roastStage,
    roast_desc: v.roastDesc,
    note_tags: noteTagsJoined,
    note_tags_en: noteTagsEnJoined,
    note_color: v.noteColor,
    note_sweet: v.noteSweet,
    note_body: v.noteBody,
    note_aftertaste: v.noteAftertaste,
    note_aroma: v.noteAroma,
    note_acidity: v.noteAcidity,
    volumes: v.volumes.map((row) => ({
      label: row.label,
      price: row.price,
      sold_out: row.soldOut,
    })),
    recipes:
      v.category === 'coffee_bean'
        ? v.recipes.map((row) => ({
            method: row.method,
            dose: row.dose,
            temp: row.temp,
            time: row.time,
            water: row.water,
          }))
        : [],
  };

  const admin = getSupabaseAdmin();
  const { data: returnedSlug, error: rpcErr } = await admin.rpc(
    'create_product',
    { p_input: payload },
  );

  if (rpcErr) {
    if (rpcErr.code === '23505') {
      return { ok: false, error: 'slug_conflict' };
    }
    console.error('[createProductAction] RPC failed', {
      code: rpcErr.code,
      message: rpcErr.message?.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }

  revalidateTag(PRODUCTS_CACHE_TAG, 'max');
  revalidatePath('/admin/products');
  revalidatePath('/shop');

  return { ok: true, slug: (returnedSlug as string) ?? v.slug };
}

/* ── deleteProductAction ──────────────────────────────────────────────── */

type DeleteProductResult =
  | { ok: true }
  | {
      ok: false;
      error: 'unauthorized' | 'validation_failed' | 'not_found' | 'server_error';
      detail?: string;
    };

/**
 * 상품 영구 삭제 (S231-4).
 *
 * - products DELETE → product_volumes / product_images / product_recipes
 *   모두 cascade (046 마이그)
 * - Storage product-images/{slug}/* 일괄 삭제
 * - cart_items / subscriptions 의 product_slug 는 FK 없는 스냅샷 → 영향 0.
 * - S232: owner 만 영구 삭제. staff 는 일시 비공개만 가능.
 */
export async function deleteProductAction(input: {
  id: string;
}): Promise<DeleteProductResult> {
  const claims = await getAdminOwnerClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  if (!z.string().uuid().safeParse(input.id).success) {
    return { ok: false, error: 'validation_failed', detail: 'id' };
  }

  const admin = getSupabaseAdmin();

  /* 사전 SELECT — slug 조회 (Storage 폴더 path + revalidate 용). */
  const { data: prodRow, error: prodSelErr } = await admin
    .from('products')
    .select('id, slug')
    .eq('id', input.id)
    .maybeSingle();
  if (prodSelErr) {
    console.error('[deleteProductAction] select failed', prodSelErr.message);
    return { ok: false, error: 'server_error' };
  }
  if (!prodRow) return { ok: false, error: 'not_found' };
  const prodSlug = String(prodRow.slug);

  /* Storage 폴더 cleanup. 실패해도 DB DELETE 는 진행 (orphan storage 는 carry). */
  const { data: files, error: listErr } = await admin.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .list(prodSlug);
  if (listErr) {
    console.error('[deleteProductAction] storage list failed', {
      slug: prodSlug,
      message: listErr.message?.slice(0, 200),
    });
  } else if (files && files.length > 0) {
    const paths = files.map((f) => `${prodSlug}/${f.name}`);
    const { error: rmErr } = await admin.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .remove(paths);
    if (rmErr) {
      console.error('[deleteProductAction] storage remove failed', {
        slug: prodSlug,
        count: paths.length,
        message: rmErr.message?.slice(0, 200),
      });
    }
  }

  /* DB DELETE — cascade 자식 일괄 삭제 */
  const { error: delErr } = await admin
    .from('products')
    .delete()
    .eq('id', input.id);
  if (delErr) {
    console.error('[deleteProductAction] delete failed', delErr.message);
    return { ok: false, error: 'server_error' };
  }

  revalidateTag(PRODUCTS_CACHE_TAG, 'max');
  revalidatePath('/admin/products');
  revalidatePath('/shop');
  revalidatePath(`/shop/${prodSlug}`);

  return { ok: true };
}

/* ── reorderProductsAction ────────────────────────────────────────────── */

const ReorderProductsSchema = z.object({
  category: z.enum(['coffee_bean', 'drip_bag']),
  orderedProductIds: z.array(z.string().uuid()).min(1).max(100),
});

type ReorderProductsResult =
  | { ok: true; category: 'coffee_bean' | 'drip_bag' }
  | {
      ok: false;
      error:
        | 'unauthorized'
        | 'validation_failed'
        | 'mismatch'
        | 'server_error';
      detail?: string;
    };

/**
 * 카테고리 내 상품 순서 변경 (S250-6-#1).
 *
 * - 모든 productId 가 input.category 에 속하는지 확인 (보안 + 정합)
 * - batch UPDATE — orderedProductIds[i] → sort_order = i
 * - 같은 카테고리 내 그룹 origin 으로 0..N 재번호.
 */
export async function reorderProductsAction(input: {
  category: 'coffee_bean' | 'drip_bag';
  orderedProductIds: string[];
}): Promise<ReorderProductsResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = ReorderProductsSchema.safeParse(input);
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      error: 'validation_failed',
      detail: Object.entries(fields)
        .map(([k, v]) => `${k}:${(v as string[])[0]}`)
        .join('; ')
        .slice(0, 200),
    };
  }

  const { category, orderedProductIds } = parsed.data;
  const admin = getSupabaseAdmin();

  /* 보안 + 정합 — 모든 productId 가 input.category 에 속하는지 확인. */
  const { data: owned, error: ownErr } = await admin
    .from('products')
    .select('id')
    .eq('category', category)
    .in('id', orderedProductIds);

  if (ownErr) {
    console.error('[reorderProductsAction] ownership check failed', {
      code: ownErr.code,
      message: ownErr.message?.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }
  if (!owned || owned.length !== orderedProductIds.length) {
    return { ok: false, error: 'mismatch' };
  }

  /* batch UPDATE — Promise.all (소규모 배열, 동시성 낮음 → 트랜잭션 생략) */
  const updates = await Promise.all(
    orderedProductIds.map((productId, idx) =>
      admin
        .from('products')
        .update({ sort_order: idx })
        .eq('id', productId)
        .eq('category', category),
    ),
  );
  const firstErr = updates.find((r) => r.error);
  if (firstErr?.error) {
    console.error('[reorderProductsAction] update failed', {
      code: firstErr.error.code,
      message: firstErr.error.message?.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }

  revalidateTag(PRODUCTS_CACHE_TAG, 'max');
  revalidatePath('/admin/products');
  revalidatePath('/shop');

  return { ok: true, category };
}
