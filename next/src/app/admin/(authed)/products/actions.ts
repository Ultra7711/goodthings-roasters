'use server';

/* ══════════════════════════════════════════════════════════════════════════
   actions.ts — /admin/products Server Actions (S218 Phase 1)

   책임:
   1) admin 가드 (getAdminClaims)
   2) zod 검증
   3) supabase service_role 로 products UPDATE
   4) revalidateTag('products') + revalidatePath('/admin/products')

   현재 포함:
   - toggleProductActiveAction — is_active on/off (목록 인라인 토글)

   carry-over (Step 4 / Step 5):
   - createProductAction — INSERT products + volumes + images + recipes
   - updateProductAction — UPDATE products + 자식 테이블 sync
   ══════════════════════════════════════════════════════════════════════════ */

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { getAdminClaims } from '@/lib/auth/getClaims';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PRODUCTS_CACHE_TAG } from '@/lib/productsServer';

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

   범위 (basic 탭): name / category / status / displayPrice / sortOrder /
                    color / noteColor / subscription / popup

   carry-over (detail/option/recipe 탭): description / specs / flavor_desc /
   note_tags / note_tags_en / roast_stage / note_sweet/body/aftertaste/aroma/acidity
   ══════════════════════════════════════════════════════════════════════════ */

const ProductStatusEnum = z
  .enum(['NEW', '인기 NO.1', '인기 NO.2', '인기 NO.3', '수량 한정', '품절'])
  .nullable();

const HexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, '#RRGGBB 형식이어야 합니다');

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

  revalidateTag(PRODUCTS_CACHE_TAG, 'max');
  revalidatePath('/admin/products');
  revalidatePath(`/admin/products/${v.slug}/edit`);
  revalidatePath('/shop');
  revalidatePath(`/shop/${v.slug}`);

  return { ok: true, id: v.id };
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
