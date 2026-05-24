'use server';

/* ══════════════════════════════════════════════════════════════════════════
   imageActions.ts — /admin/products 이미지 도메인 Server Actions (S256-B)

   책임 (image domain):
   1) reorderProductImagesAction — 이미지 갤러리 reorder (S218 Phase 1)
   2) uploadProductImageAction — Storage upload + plaiceholder + DB INSERT (S231-3)
   3) updateProductImageActiveAction — 공개/비공개 토글 (S231-3 · 050)
   4) deleteProductImageAction — Storage delete + DB DELETE (S231-3)

   product CRUD (toggle/update/create/delete/reorder) 는 productActions.ts.
   caller 는 productActions / imageActions 에서 직접 import (S256-B v2 —
   actions.ts re-export 폐기. Next.js 16 'use server' = async function 만 export
   허용. [[feedback-use-server-async-only]]).

   PRODUCT_IMAGES_BUCKET 상수는 _constants.ts 로 격리 — 'use server' 파일에서
   const export 가 build fail 의 원인이었음. productActions.ts (deleteProductAction
   Storage cleanup) 도 같은 경로에서 import.
   ══════════════════════════════════════════════════════════════════════════ */

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { getAdminClaims } from '@/lib/auth/getClaims';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  buildAdminImageFilename,
  processAdminImage,
} from '@/lib/admin/imageProcessing';
import { logActionError } from '@/lib/admin/logActionError';
import { PRODUCTS_CACHE_TAG } from '@/lib/productsServer';
import { PRODUCT_IMAGES_BUCKET } from './_constants';

const SlugPathSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

/* ── reorderProductImagesAction ───────────────────────────────────────── */

const ReorderImagesSchema = z.object({
  productId: z.string().uuid(),
  orderedImageIds: z.array(z.string().uuid()).min(1).max(20),
});

type ReorderImagesResult =
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

/**
 * 이미지 갤러리 reorder (S218 Phase 1 추가).
 *
 * - 각 image 가 productId 에 속하는지 확인 (보안)
 * - batch UPDATE — orderedImageIds[i] → sort_order = i
 * - revalidate (대표 이미지 = sort_order 0, 메인 사이트 PDP/카트/카드 갱신)
 */
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
    logActionError('[reorderProductImagesAction] ownership check failed', ownErr);
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
    logActionError('[reorderProductImagesAction] update failed', firstErr.error);
    return { ok: false, error: 'server_error' };
  }

  revalidateTag(PRODUCTS_CACHE_TAG, 'max');
  revalidatePath('/admin/products');

  return { ok: true, productId };
}

/* ── uploadProductImageAction ─────────────────────────────────────────── */

type UploadProductImageResult =
  | {
      ok: true;
      id: string;
      src: string;
      blurDataUrl: string | null;
      isActive: boolean;
    }
  | {
      ok: false;
      error:
        | 'unauthorized'
        | 'validation_failed'
        | 'invalid_image'
        | 'server_error';
      detail?: string;
    };

/**
 * Storage upload + plaiceholder + DB INSERT (S231-3 · GoodDays admin actions 답습).
 *
 * - file 검증 (5MB 제한 · 028 마이그 RLS 와 일관)
 * - lib/admin/imageProcessing.ts (sharp webp 변환 + plaiceholder + bg_theme 자동 판별)
 * - Storage upload: product-images/{slug}/pd-{ts}-{rand}.webp
 * - sort_order = max+1 (빈 테이블 = 0 — 046 spec "메인 이미지가 0")
 * - 050 안전장치: 신규 업로드는 is_active=false. 운영자가 카드에서 토글로 공개.
 */
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
    logActionError('[uploadProductImageAction] storage upload failed', uploadErr);
    return { ok: false, error: 'server_error' };
  }

  const { data: urlData } = admin.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .getPublicUrl(storagePath);

  /* sort_order = max+1. 빈 테이블 = 0 (대표). */
  const { data: maxRow, error: maxErr } = await admin
    .from('product_images')
    .select('sort_order')
    .eq('product_id', productId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxErr) {
    logActionError('[uploadProductImageAction] max sort_order failed', maxErr);
    await admin.storage.from(PRODUCT_IMAGES_BUCKET).remove([storagePath]);
    return { ok: false, error: 'server_error' };
  }
  const nextSort = maxRow ? (maxRow.sort_order as number) + 1 : 0;

  /* 안전장치 (050) — 신규 업로드는 default 비공개. */
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
    .select('id, src, blur_data_url, is_active')
    .single();
  if (insErr || !inserted) {
    logActionError('[uploadProductImageAction] insert failed', insErr);
    await admin.storage.from(PRODUCT_IMAGES_BUCKET).remove([storagePath]);
    return { ok: false, error: 'server_error' };
  }

  revalidateTag(PRODUCTS_CACHE_TAG, 'max');
  revalidatePath('/admin/products');
  revalidatePath(`/admin/products/${slug}/edit`);
  revalidatePath('/shop');
  revalidatePath(`/shop/${slug}`);

  return {
    ok: true,
    id: inserted.id as string,
    src: inserted.src as string,
    blurDataUrl: (inserted.blur_data_url as string | null) ?? null,
    isActive: inserted.is_active as boolean,
  };
}

/* ── updateProductImageActiveAction ───────────────────────────────────── */

type UpdateProductImageActiveResult =
  | { ok: true }
  | {
      ok: false;
      error: 'unauthorized' | 'validation_failed' | 'not_found' | 'server_error';
      detail?: string;
    };

/**
 * 이미지 공개/비공개 토글 (S231-3 · 050 안전장치).
 *
 * 신규 업로드는 default false. 운영자가 카드에서 확인 후 활성.
 * 잘못 올린 이미지 즉시 비활성으로 사이트에서 숨김.
 */
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
    logActionError('[updateProductImageActiveAction] update failed', error);
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

/* ── deleteProductImageAction ─────────────────────────────────────────── */

type DeleteProductImageResult =
  | { ok: true }
  | {
      ok: false;
      error: 'unauthorized' | 'validation_failed' | 'not_found' | 'server_error';
      detail?: string;
    };

/**
 * Storage delete + DB DELETE (S231-3).
 *
 * - product_images SELECT (src, product_id, slug 조회)
 * - Storage path 추출 = publicUrl 의 .../product-images/<storagePath>
 * - Storage remove (실패해도 DB DELETE 진행 — orphan 은 carry)
 * - product_images DELETE
 */
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
    logActionError('[deleteProductImageAction] select failed', selErr);
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
      logActionError('[deleteProductImageAction] storage remove failed', rmErr, {
        storagePath,
      });
    }
  }

  const { error: delErr } = await admin
    .from('product_images')
    .delete()
    .eq('id', input.imageId);
  if (delErr) {
    logActionError('[deleteProductImageAction] delete failed', delErr);
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
