'use server';

/* ══════════════════════════════════════════════════════════════════════════
   actions.ts — /admin/products Server Actions

   책임:
   1) admin 가드 (getAdminClaims)
   2) zod 검증
   3) supabase service_role 로 products INSERT/UPDATE
   4) revalidateTag('products') + revalidatePath('/admin/products')

   현재 포함:
   - toggleProductActiveAction — is_active on/off (목록 인라인 토글)
   - updateProductMetaAction — products + volumes + recipes UPDATE (S218/S231)
   - createProductAction — products + volumes + recipes INSERT (S231-2 · 이미지 제외)
   - reorderProductImagesAction — 이미지 갤러리 reorder
   - uploadProductImageAction — Storage upload + plaiceholder + DB INSERT (S231-3 · is_active=false)
   - updateProductImageActiveAction — 이미지 공개/비공개 토글 (S231-3 안전장치)
   - deleteProductImageAction — Storage delete + DB DELETE (S231-3)

   carry-over:
   - createProductAction 트랜잭션 RPC (S231-4 · 자식 INSERT 실패 시 롤백)
   - bg / bg_theme 운영자 편집 UI (memory: project_admin_product_image_bg_grad_editor)
   ══════════════════════════════════════════════════════════════════════════ */

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { getAdminClaims } from '@/lib/auth/getClaims';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  buildAdminImageFilename,
  processAdminImage,
} from '@/lib/admin/imageProcessing';
import { PRODUCTS_CACHE_TAG } from '@/lib/productsServer';

const PRODUCT_IMAGES_BUCKET = 'product-images';

const ToggleActiveSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
});

export type ToggleActiveResult =
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

/* ══════════════════════════════════════════════════════════════════════════
   updateProductMetaAction — products 단일 row 메타 UPDATE (S218 Phase 1 추가)

   책임:
   1) admin 가드
   2) zod 검증 (basic 탭 필드)
   3) UPDATE products SET ... WHERE id
   4) revalidateTag('products') + revalidatePath (admin + 메인 사이트)

   범위 (basic + detail + option 탭): name / category / status / displayPrice / sortOrder /
                    color / subscription / popup / description /
                    flavorDesc / roastStage / noteChips / noteColor /
                    noteSweet / noteBody / noteAftertaste / noteAroma / noteAcidity /
                    volumes / recipes (sync — UPSERT + DELETE missing)

   noteChips ({ko, en}[]) 는 시그니처 chip UI 와 동일 형식 — action 안에서
   note_tags / note_tags_en 두 컬럼 ' | ' join 으로 저장.

   volumes / recipes sync 전략 (S231-7 사용자 결정 = B):
   - 서버 기존 ID 집합 조회 → 클라이언트에 빠진 ID 는 DELETE
   - 클라이언트 row 는 UPSERT (id 있으면 UPDATE · 없으면 INSERT · sort_order = idx)
   - drip_bag 의 경우 recipes 는 항상 빈 배열로 강제 (DRIP_BAG_RECIPE 전역 상수 사용)

   carry-over (별 sprint): specs UI 편집 / drip_bag_recipe site_settings 통합
   ══════════════════════════════════════════════════════════════════════════ */

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

export type UpdateProductMetaInput = z.infer<typeof UpdateProductMetaSchema>;

export type UpdateProductMetaResult =
  | { ok: true; id: string }
  | {
      ok: false;
      error: 'unauthorized' | 'validation_failed' | 'not_found' | 'server_error';
      detail?: string;
    };

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

  /* drip_bag 의 recipes 는 빈 배열로 강제 (DRIP_BAG_RECIPE 전역 상수 사용) */
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

/* ══════════════════════════════════════════════════════════════════════════
   reorderProductImagesAction — 이미지 갤러리 reorder (S218 Phase 1 추가)

   책임:
   1) admin 가드
   2) productId + orderedImageIds 검증
   3) 각 image 가 productId 에 속하는지 확인 (보안)
   4) batch UPDATE — orderedImageIds[i] → sort_order = i
   5) revalidate (대표 이미지 = sort_order 0, 메인 사이트 PDP/카트/카드 갱신)
   ══════════════════════════════════════════════════════════════════════════ */

const ReorderImagesSchema = z.object({
  productId: z.string().uuid(),
  orderedImageIds: z.array(z.string().uuid()).min(1).max(20),
});

export type ReorderImagesResult =
  | { ok: true; productId: string }
  | {
      ok: false;
      error:
        | 'unauthorized'
        | 'validation_failed'
        | 'not_found'
        | 'mismatch'
        | 'server_error';
      detail?: string;
    };

export async function reorderProductImagesAction(input: {
  productId: string;
  orderedImageIds: string[];
}): Promise<ReorderImagesResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = ReorderImagesSchema.safeParse(input);
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

  const { productId, orderedImageIds } = parsed.data;
  const admin = getSupabaseAdmin();

  /* 보안 — 모든 image 가 productId 에 속하는지 확인. */
  const { data: owned, error: ownErr } = await admin
    .from('product_images')
    .select('id')
    .eq('product_id', productId)
    .in('id', orderedImageIds);

  if (ownErr) {
    console.error('[reorderProductImagesAction] ownership check failed', {
      code: ownErr.code,
      message: ownErr.message?.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }
  if (!owned || owned.length !== orderedImageIds.length) {
    return { ok: false, error: 'mismatch' };
  }

  /* batch UPDATE — Promise.all (소규모 배열, 동시성 낮음 → 트랜잭션 생략) */
  const updates = await Promise.all(
    orderedImageIds.map((imageId, idx) =>
      admin
        .from('product_images')
        .update({ sort_order: idx })
        .eq('id', imageId)
        .eq('product_id', productId),
    ),
  );
  const firstErr = updates.find((r) => r.error);
  if (firstErr?.error) {
    console.error('[reorderProductImagesAction] update failed', {
      code: firstErr.error.code,
      message: firstErr.error.message?.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }

  revalidateTag(PRODUCTS_CACHE_TAG, 'max');
  revalidatePath('/admin/products');

  return { ok: true, productId };
}

/* ══════════════════════════════════════════════════════════════════════════
   createProductAction — products + volumes + recipes INSERT (S231-2)

   책임:
   1) admin 가드
   2) zod 검증 (slug kebab-case · volumes 최소 1)
   3) INSERT products (id 자동 생성)
   4) INSERT product_volumes (sort_order = idx)
   5) INSERT product_recipes (coffee_bean 만 · sort_order = idx)
   6) revalidate
   7) return { ok: true, slug } — 호출자가 /admin/products/{slug}/edit redirect

   범위 (S231-2):
   - 이미지 INSERT 제외 — 등록 후 edit 페이지의 이미지 갤러리 섹션에서 업로드 (S231-3)
   - 자식 INSERT 실패 시 products row 가 남는 부분 정합 risk 존재 — S231-4 에서 RPC 트랜잭션 보강

   slug 중복 처리:
   - INSERT 시 UNIQUE 위반 (PostgreSQL 23505) → 'slug_conflict' 반환
   ══════════════════════════════════════════════════════════════════════════ */

const SlugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    '소문자/숫자 + 하이픈만 가능합니다 (예: autumn-night)',
  );

const CreateProductSchema = z.object({
  slug: SlugSchema,
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

export type CreateProductInput = z.infer<typeof CreateProductSchema>;

export type CreateProductResult =
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
  const admin = getSupabaseAdmin();

  /* INSERT products — id auto · specs 빈 문자열 (DB NOT NULL · UI 미노출) */
  const { data: inserted, error: insErr } = await admin
    .from('products')
    .insert({
      slug: v.slug,
      name: v.name,
      category: v.category,
      status: v.status,
      display_price: v.displayPrice,
      sort_order: v.sortOrder,
      color: v.color,
      subscription: v.subscription,
      popup: v.popup,
      description: v.description,
      specs: '',
      flavor_desc: v.flavorDesc,
      roast_stage: v.roastStage,
      note_tags: noteTagsJoined,
      note_tags_en: noteTagsEnJoined,
      note_color: v.noteColor,
      note_sweet: v.noteSweet,
      note_body: v.noteBody,
      note_aftertaste: v.noteAftertaste,
      note_aroma: v.noteAroma,
      note_acidity: v.noteAcidity,
      is_active: false,
    })
    .select('id')
    .single();

  if (insErr) {
    if (insErr.code === '23505') {
      return { ok: false, error: 'slug_conflict' };
    }
    console.error('[createProductAction] insert failed', {
      code: insErr.code,
      message: insErr.message?.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }
  const newId = inserted.id;

  /* INSERT product_volumes — sort_order = idx (최소 1행 보장 — zod) */
  const volRows = v.volumes.map((row, idx) => ({
    product_id: newId,
    label: row.label,
    price: row.price,
    sold_out: row.soldOut,
    sort_order: idx,
  }));
  const { error: volErr } = await admin.from('product_volumes').insert(volRows);
  if (volErr) {
    console.error('[createProductAction] volumes insert failed', {
      code: volErr.code,
      message: volErr.message?.slice(0, 200),
    });
    return { ok: false, error: 'server_error', detail: 'volumes insert 실패' };
  }

  /* INSERT product_recipes — coffee_bean 만 (drip_bag = DRIP_BAG_RECIPE 전역) */
  if (v.category === 'coffee_bean' && v.recipes.length > 0) {
    const recipeRows = v.recipes.map((row, idx) => ({
      product_id: newId,
      method: row.method,
      dose: row.dose,
      temp: row.temp,
      time: row.time,
      water: row.water,
      sort_order: idx,
    }));
    const { error: recErr } = await admin
      .from('product_recipes')
      .insert(recipeRows);
    if (recErr) {
      console.error('[createProductAction] recipes insert failed', {
        code: recErr.code,
        message: recErr.message?.slice(0, 200),
      });
      return { ok: false, error: 'server_error', detail: 'recipes insert 실패' };
    }
  }

  revalidateTag(PRODUCTS_CACHE_TAG, 'max');
  revalidatePath('/admin/products');
  revalidatePath('/shop');

  return { ok: true, slug: v.slug };
}

/* ══════════════════════════════════════════════════════════════════════════
   uploadProductImageAction — Storage upload + plaiceholder + DB INSERT (S231-3)

   GoodDays admin actions 답습 (gooddays/actions.ts).

   처리:
   1) admin 가드 + file 검증 (5MB 제한 · 028 마이그 RLS 와 일관)
   2) plaiceholder → base64 (blur) + metadata.width/height + color.hex (dominant)
   3) bg_theme 자동 판별 — color.hex 의 luminance > 0.5 = 'light' else 'dark'
   4) Storage upload: product-images/{slug}/pd-{ts}-{rand}.{ext}
   5) sort_order = max+1 (빈 테이블 = 0 — 046 spec "메인 이미지가 0")
   6) product_images INSERT
   7) revalidate /admin/products + 해당 slug PDP

   carry-over (별 sprint):
   - sharp 리사이즈/webp 강제 변환 (현재는 원본 그대로 + plaiceholder 만)
   - bg / bg_theme 운영자 편집 UI (자동값 + 운영자 grad 문자열 편집)
   ══════════════════════════════════════════════════════════════════════════ */

const SlugPathSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

export type UploadProductImageResult =
  | { ok: true; id: string }
  | {
      ok: false;
      error:
        | 'unauthorized'
        | 'validation_failed'
        | 'invalid_image'
        | 'server_error';
      detail?: string;
    };

export async function uploadProductImageAction(
  formData: FormData,
): Promise<UploadProductImageResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const productId = String(formData.get('productId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const file = formData.get('file');

  if (!z.string().uuid().safeParse(productId).success) {
    return { ok: false, error: 'validation_failed', detail: 'productId' };
  }
  if (!SlugPathSchema.safeParse(slug).success) {
    return { ok: false, error: 'validation_failed', detail: 'slug' };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'validation_failed', detail: 'file_missing' };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, error: 'validation_failed', detail: 'file_too_large' };
  }

  const original = Buffer.from(await file.arrayBuffer());

  /* lib/admin/imageProcessing.ts 답습 — 어드민 전 영역 일관 (S231-3) */
  const processed = await processAdminImage(original);
  if (!processed.ok) {
    return { ok: false, error: 'invalid_image' };
  }
  const { image } = processed;

  const filename = buildAdminImageFilename('pd');
  const storagePath = `${slug}/${filename}`;
  const admin = getSupabaseAdmin();

  const { error: uploadErr } = await admin.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(storagePath, image.buffer, {
      contentType: 'image/webp',
      upsert: false,
    });
  if (uploadErr) {
    console.error('[uploadProductImageAction] storage upload failed', {
      message: uploadErr.message?.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }

  const { data: urlData } = admin.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .getPublicUrl(storagePath);

  /* sort_order = max+1. 빈 테이블 (현 상품에 이미지 0개) = 0 (대표). */
  const { data: maxRow, error: maxErr } = await admin
    .from('product_images')
    .select('sort_order')
    .eq('product_id', productId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxErr) {
    console.error('[uploadProductImageAction] max sort_order failed', maxErr.message);
    await admin.storage.from(PRODUCT_IMAGES_BUCKET).remove([storagePath]);
    return { ok: false, error: 'server_error' };
  }
  const nextSort = maxRow ? (maxRow.sort_order as number) + 1 : 0;

  /* 안전장치 (050) — 신규 업로드는 default 비공개. 운영자가 카드에서 토글로 공개. */
  const { data: inserted, error: insErr } = await admin
    .from('product_images')
    .insert({
      product_id: productId,
      src: urlData.publicUrl,
      bg: image.colorHex,
      bg_theme: image.bgTheme,
      blur_data_url: image.base64,
      width: image.width,
      height: image.height,
      sort_order: nextSort,
      is_active: false,
    })
    .select('id')
    .single();
  if (insErr || !inserted) {
    console.error('[uploadProductImageAction] insert failed', insErr?.message);
    await admin.storage.from(PRODUCT_IMAGES_BUCKET).remove([storagePath]);
    return { ok: false, error: 'server_error' };
  }

  revalidateTag(PRODUCTS_CACHE_TAG, 'max');
  revalidatePath('/admin/products');
  revalidatePath(`/admin/products/${slug}/edit`);
  revalidatePath('/shop');
  revalidatePath(`/shop/${slug}`);

  return { ok: true, id: inserted.id };
}

/* ══════════════════════════════════════════════════════════════════════════
   updateProductImageActiveAction — 이미지 공개/비공개 토글 (S231-3 · 050)

   안전장치 — 신규 업로드는 default false. 운영자가 카드에서 확인 후 활성.
   잘못 올린 이미지 즉시 비활성으로 사이트에서 숨김.
   ══════════════════════════════════════════════════════════════════════════ */

export type UpdateProductImageActiveResult =
  | { ok: true }
  | {
      ok: false;
      error: 'unauthorized' | 'validation_failed' | 'not_found' | 'server_error';
      detail?: string;
    };

export async function updateProductImageActiveAction(input: {
  imageId: string;
  isActive: boolean;
}): Promise<UpdateProductImageActiveResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  if (!z.string().uuid().safeParse(input.imageId).success) {
    return { ok: false, error: 'validation_failed', detail: 'imageId' };
  }
  if (typeof input.isActive !== 'boolean') {
    return { ok: false, error: 'validation_failed', detail: 'isActive' };
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('product_images')
    .update({ is_active: input.isActive })
    .eq('id', input.imageId)
    .select('id, product_id, products!inner(slug)')
    .maybeSingle();
  if (error) {
    console.error('[updateProductImageActiveAction] update failed', error.message);
    return { ok: false, error: 'server_error' };
  }
  if (!data) return { ok: false, error: 'not_found' };

  const productsRel = data.products as unknown;
  const slug =
    Array.isArray(productsRel) && productsRel[0] && typeof productsRel[0] === 'object'
      ? (productsRel[0] as { slug?: string }).slug ?? null
      : productsRel && typeof productsRel === 'object'
        ? (productsRel as { slug?: string }).slug ?? null
        : null;

  revalidateTag(PRODUCTS_CACHE_TAG, 'max');
  revalidatePath('/admin/products');
  if (slug) {
    revalidatePath(`/admin/products/${slug}/edit`);
    revalidatePath(`/shop/${slug}`);
  }
  revalidatePath('/shop');

  return { ok: true };
}

/* ══════════════════════════════════════════════════════════════════════════
   deleteProductImageAction — Storage delete + DB DELETE (S231-3)

   - admin 가드
   - product_images SELECT (src, product_id 조회 → slug 도 함께 조회)
   - Storage path 추출 = publicUrl 의 .../product-images/<storagePath>
   - Storage remove (실패해도 DB DELETE 진행 — orphan 은 carry)
   - product_images DELETE
   - revalidate
   ══════════════════════════════════════════════════════════════════════════ */

export type DeleteProductImageResult =
  | { ok: true }
  | {
      ok: false;
      error: 'unauthorized' | 'validation_failed' | 'not_found' | 'server_error';
      detail?: string;
    };

export async function deleteProductImageAction(input: {
  imageId: string;
}): Promise<DeleteProductImageResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  if (!z.string().uuid().safeParse(input.imageId).success) {
    return { ok: false, error: 'validation_failed', detail: 'imageId' };
  }

  const admin = getSupabaseAdmin();
  const { data: row, error: selErr } = await admin
    .from('product_images')
    .select('id, src, product_id, products!inner(slug)')
    .eq('id', input.imageId)
    .maybeSingle();
  if (selErr) {
    console.error('[deleteProductImageAction] select failed', selErr.message);
    return { ok: false, error: 'server_error' };
  }
  if (!row) return { ok: false, error: 'not_found' };

  /* Storage path 추출 — publicUrl 마지막 두 segment ({slug}/{filename}) */
  const url = String(row.src);
  const marker = `/${PRODUCT_IMAGES_BUCKET}/`;
  const idx = url.indexOf(marker);
  const storagePath =
    idx >= 0 ? url.slice(idx + marker.length) : null;

  if (storagePath) {
    const { error: rmErr } = await admin.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .remove([storagePath]);
    if (rmErr) {
      /* Storage 삭제 실패는 로그만 — DB row 삭제는 진행 (orphan storage 는 carry) */
      console.error('[deleteProductImageAction] storage remove failed', {
        message: rmErr.message?.slice(0, 200),
        storagePath,
      });
    }
  }

  const { error: delErr } = await admin
    .from('product_images')
    .delete()
    .eq('id', input.imageId);
  if (delErr) {
    console.error('[deleteProductImageAction] delete failed', delErr.message);
    return { ok: false, error: 'server_error' };
  }

  /* slug 추출 — Supabase nested select 의 products 가 단일 객체 또는 배열일 수 있음 */
  const productsRel = row.products as unknown;
  const slug =
    Array.isArray(productsRel) && productsRel[0] && typeof productsRel[0] === 'object'
      ? (productsRel[0] as { slug?: string }).slug ?? null
      : productsRel && typeof productsRel === 'object'
        ? (productsRel as { slug?: string }).slug ?? null
        : null;

  revalidateTag(PRODUCTS_CACHE_TAG, 'max');
  revalidatePath('/admin/products');
  if (slug) {
    revalidatePath(`/admin/products/${slug}/edit`);
    revalidatePath(`/shop/${slug}`);
  }
  revalidatePath('/shop');

  return { ok: true };
}
