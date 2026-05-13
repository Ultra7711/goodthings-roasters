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
