'use server';

/* ══════════════════════════════════════════════════════════════════════════
   actions.ts — /admin/gooddays server actions (S167 J-4)

   책임:
   1) getAdminClaims 가드 — 비admin 차단
   2) Zod 검증
   3) Storage upload/delete + DB INSERT/UPDATE/DELETE
   4) revalidateTag(GOODDAYS_CACHE_TAG, 'max') + revalidatePath('/admin/gooddays')

   설계 (ADR-006 §적용 범위):
   - 호출처 = 어드민 UI 1곳만 → Server Action 단일 채널 (dual channel 불필요).
   - cafe-events/actions.ts 패턴 답습.
   - LQIP (blur_data_url + width + height) 추출 = 서버 sharp/plaiceholder.

   actions 4종:
   - uploadGoodDaysImageAction   — Storage upload + sharp + DB INSERT (sort_order = max+1)
   - updateGoodDaysImageAction   — alt / featured / is_active 편집
   - reorderGoodDaysImagesAction — sort_order 일괄 UPDATE (DEFERRABLE)
   - deleteGoodDaysImageAction   — Storage delete + DB DELETE
   ══════════════════════════════════════════════════════════════════════════ */

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { getAdminClaims } from '@/lib/auth/getClaims';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  buildAdminImageFilename,
  processAdminImage,
} from '@/lib/admin/imageProcessing';
import { GOODDAYS_CACHE_TAG } from '@/lib/gooddaysServer';

const BUCKET_ID = 'gooddays-images';

/* ── Schemas ──────────────────────────────────────────────────────────── */

const UuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'invalid_uuid',
  );

const UpdateInputSchema = z.object({
  id: UuidSchema,
  alt: z.string().max(200).optional(),
  featured: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const ReorderInputSchema = z.object({
  orderedIds: z.array(UuidSchema).min(1).max(500),
});

const DeleteInputSchema = z.object({
  id: UuidSchema,
});

/* ── Result type ──────────────────────────────────────────────────────── */

export type GoodDaysActionResult =
  | { ok: true; id: string }
  | {
      ok: false;
      error:
        | 'unauthorized'
        | 'validation_failed'
        | 'not_found'
        | 'server_error'
        | 'invalid_image';
      detail?: string;
    };

/* ── Helpers ──────────────────────────────────────────────────────────── */

function flattenZodError(err: z.ZodError): string {
  const fields = err.flatten().fieldErrors;
  return Object.entries(fields)
    .map(([k, v]) => `${k}:${(v as string[])[0] ?? 'invalid'}`)
    .join('; ')
    .slice(0, 200);
}

/* ── Actions ──────────────────────────────────────────────────────────── */

/**
 * 이미지 업로드 — FormData 로 file + alt + featured 전송.
 *
 * 처리:
 * 1) admin 가드
 * 2) file Buffer + plaiceholder (blur + width/height)
 * 3) Storage upload (gooddays-images, 새 filename)
 * 4) sort_order = max+1 산출
 * 5) DB INSERT
 */
export async function uploadGoodDaysImageAction(
  formData: FormData,
): Promise<GoodDaysActionResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const file = formData.get('file');
  const alt = String(formData.get('alt') ?? '').slice(0, 200);
  const featured = formData.get('featured') === 'true';

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'validation_failed', detail: 'file_missing' };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, error: 'validation_failed', detail: 'file_too_large' };
  }

  const original = Buffer.from(await file.arrayBuffer());

  /* lib/admin/imageProcessing.ts 답습 — 어드민 전 영역 일관 (S231-3 마이그) */
  const processed = await processAdminImage(original);
  if (!processed.ok) {
    return { ok: false, error: 'invalid_image' };
  }
  const { image } = processed;

  const filename = buildAdminImageFilename('gd');
  const admin = getSupabaseAdmin();

  const { error: uploadErr } = await admin.storage
    .from(BUCKET_ID)
    .upload(filename, image.buffer, {
      contentType: 'image/webp',
      upsert: false,
    });
  if (uploadErr) {
    console.error('[uploadGoodDaysImageAction] storage upload failed', {
      message: uploadErr.message?.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }

  const { data: urlData } = admin.storage.from(BUCKET_ID).getPublicUrl(filename);

  /* sort_order = max+1. 빈 테이블이면 1. */
  const { data: maxRow, error: maxErr } = await admin
    .from('gooddays_gallery')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxErr) {
    console.error('[uploadGoodDaysImageAction] max sort_order failed', maxErr.message);
    /* Storage 객체 cleanup */
    await admin.storage.from(BUCKET_ID).remove([filename]);
    return { ok: false, error: 'server_error' };
  }
  const nextSort = (maxRow?.sort_order ?? 0) + 1;

  const { data: inserted, error: insertErr } = await admin
    .from('gooddays_gallery')
    .insert({
      url: urlData.publicUrl,
      alt,
      sort_order: nextSort,
      is_active: true,
      featured,
      blur_data_url: image.base64,
      width: image.width,
      height: image.height,
      updated_by: claims.userId,
    })
    .select('id')
    .single();
  if (insertErr || !inserted) {
    console.error('[uploadGoodDaysImageAction] insert failed', insertErr?.message);
    await admin.storage.from(BUCKET_ID).remove([filename]);
    return { ok: false, error: 'server_error' };
  }

  revalidateTag(GOODDAYS_CACHE_TAG, 'max');
  revalidatePath('/admin/gooddays');

  return { ok: true, id: inserted.id };
}

/**
 * alt / featured / is_active 편집.
 * 부분 업데이트 — undefined 필드는 무변경.
 */
export async function updateGoodDaysImageAction(input: {
  id: string;
  alt?: string;
  featured?: boolean;
  isActive?: boolean;
}): Promise<GoodDaysActionResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = UpdateInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation_failed', detail: flattenZodError(parsed.error) };
  }

  const patch: Record<string, unknown> = { updated_by: claims.userId };
  if (parsed.data.alt !== undefined) patch.alt = parsed.data.alt;
  if (parsed.data.featured !== undefined) patch.featured = parsed.data.featured;
  if (parsed.data.isActive !== undefined) patch.is_active = parsed.data.isActive;

  if (Object.keys(patch).length === 1) {
    /* updated_by 만 있음 → 변경 없음 */
    return { ok: true, id: parsed.data.id };
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('gooddays_gallery')
    .update(patch)
    .eq('id', parsed.data.id)
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('[updateGoodDaysImageAction] update failed', error.message);
    return { ok: false, error: 'server_error' };
  }
  if (!data) return { ok: false, error: 'not_found' };

  revalidateTag(GOODDAYS_CACHE_TAG, 'max');
  revalidatePath('/admin/gooddays');

  return { ok: true, id: parsed.data.id };
}

/**
 * sort_order 일괄 UPDATE — 드래그 리오더.
 *
 * 2-pass 패턴 (S167 J-4 fix):
 *   supabase-js 의 sequential update 는 statement 단위 자체 commit → DEFERRABLE
 *   INITIALLY DEFERRED 가 무효 (트랜잭션 종료 = 매 statement 의 implicit commit).
 *   따라서 단순 loop UPDATE 는 1↔2 swap 등에서 unique 충돌.
 *
 *   해결: 1차 loop = 음수 sort_order (-1, -2, ...) 부여 → 양수 영역과 충돌 X,
 *         2차 loop = 정상 양수 sort_order (1, 2, ...) 부여.
 *
 * 향후 성능 이슈 발생 시 PL/pgSQL RPC (단일 트랜잭션) 로 전환 가능.
 */
export async function reorderGoodDaysImagesAction(input: {
  orderedIds: string[];
}): Promise<{ ok: true; count: number } | { ok: false; error: string; detail?: string }> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = ReorderInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation_failed', detail: flattenZodError(parsed.error) };
  }

  const admin = getSupabaseAdmin();
  const ids = parsed.data.orderedIds;

  /* 1차 — 모든 row 음수 sort_order 부여. 양수 1..N 영역과 충돌 X. */
  for (let i = 0; i < ids.length; i++) {
    const { error } = await admin
      .from('gooddays_gallery')
      .update({ sort_order: -(i + 1), updated_by: claims.userId })
      .eq('id', ids[i]);
    if (error) {
      console.error('[reorderGoodDaysImagesAction] pass1 failed', {
        idx: i,
        message: error.message?.slice(0, 200),
      });
      return { ok: false, error: 'server_error', detail: `pass1_idx_${i}` };
    }
  }

  /* 2차 — 정상 양수 sort_order 부여. 음수 영역과 충돌 X. */
  for (let i = 0; i < ids.length; i++) {
    const { error } = await admin
      .from('gooddays_gallery')
      .update({ sort_order: i + 1, updated_by: claims.userId })
      .eq('id', ids[i]);
    if (error) {
      console.error('[reorderGoodDaysImagesAction] pass2 failed', {
        idx: i,
        message: error.message?.slice(0, 200),
      });
      return { ok: false, error: 'server_error', detail: `pass2_idx_${i}` };
    }
  }

  revalidateTag(GOODDAYS_CACHE_TAG, 'max');
  revalidatePath('/admin/gooddays');

  return { ok: true, count: ids.length };
}

/**
 * 이미지 삭제 — DB row 조회 → Storage delete → DB delete.
 */
export async function deleteGoodDaysImageAction(input: {
  id: string;
}): Promise<GoodDaysActionResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = DeleteInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation_failed', detail: flattenZodError(parsed.error) };
  }

  const admin = getSupabaseAdmin();

  /* 먼저 row 조회 — Storage path 추출용 (url 마지막 segment) */
  const { data: row, error: selErr } = await admin
    .from('gooddays_gallery')
    .select('id, url')
    .eq('id', parsed.data.id)
    .maybeSingle();
  if (selErr) {
    console.error('[deleteGoodDaysImageAction] select failed', selErr.message);
    return { ok: false, error: 'server_error' };
  }
  if (!row) return { ok: false, error: 'not_found' };

  /* url 마지막 segment 가 Storage path. seed 와 upload 모두 filename 그대로 사용. */
  const storagePath = row.url.split('/').pop();

  if (storagePath) {
    const { error: rmErr } = await admin.storage.from(BUCKET_ID).remove([storagePath]);
    if (rmErr) {
      /* Storage 삭제 실패는 로그만 — DB row 삭제는 진행 (orphan storage 는 carry-over) */
      console.error('[deleteGoodDaysImageAction] storage remove failed', {
        message: rmErr.message?.slice(0, 200),
      });
    }
  }

  const { error: delErr } = await admin
    .from('gooddays_gallery')
    .delete()
    .eq('id', parsed.data.id);
  if (delErr) {
    console.error('[deleteGoodDaysImageAction] delete failed', delErr.message);
    return { ok: false, error: 'server_error' };
  }

  revalidateTag(GOODDAYS_CACHE_TAG, 'max');
  revalidatePath('/admin/gooddays');

  return { ok: true, id: parsed.data.id };
}
