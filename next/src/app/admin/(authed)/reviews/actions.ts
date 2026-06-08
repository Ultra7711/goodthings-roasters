'use server';

/* ══════════════════════════════════════════════════════════════════════════
   actions.ts — /admin/reviews Server Actions (S314 Step 5)

   책임:
   1) owner 가드 (getAdminOwnerClaims — 리뷰 모더레이션 owner-only · 계획 DEC)
   2) updateReviewStatus — approved/blocked/pending 전이 (admin RLS + 전이 트리거 통과)
   3) deleteReviewPermanent — 영구 삭제 (RLS delete 정책 없음 → service_role)
   4) revalidatePath('/admin/reviews')

   biz-inquiries/actions.ts + menu/actions.ts(owner+service_role) 답습.
   ══════════════════════════════════════════════════════════════════════════ */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getAdminOwnerClaims } from '@/lib/auth/getClaims';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { logActionError } from '@/lib/admin/logActionError';

const UuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'invalid_uuid',
  );

const StatusChangeSchema = z.object({
  id: UuidSchema,
  status: z.enum(['pending', 'approved', 'blocked']),
});

export type ReviewModerationInput = z.input<typeof StatusChangeSchema>;

export type ReviewModerationResult =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'validation_failed' | 'server_error' };

/* 상태 전이 (승인/차단/검토대기) — owner only. admin RLS update + 전이 트리거 통과. */
export async function updateReviewStatus(
  input: ReviewModerationInput,
): Promise<ReviewModerationResult> {
  const claims = await getAdminOwnerClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = StatusChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation_failed' };

  const supabase = await createRouteHandlerClient();
  const { error } = await supabase
    .from('reviews')
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.id);

  if (error) {
    logActionError('[admin/reviews] status update failed', error, { id: parsed.data.id });
    return { ok: false, error: 'server_error' };
  }

  revalidatePath('/admin/reviews');
  return { ok: true };
}

/* 영구 삭제 — owner only. reviews RLS 에 delete 정책 없음 → service_role 로 hard delete
   (review_helpfuls 는 FK on delete cascade). */
export async function deleteReviewPermanent(
  id: string,
): Promise<ReviewModerationResult> {
  const claims = await getAdminOwnerClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = UuidSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: 'validation_failed' };

  const admin = getSupabaseAdmin();
  const { error } = await admin.from('reviews').delete().eq('id', parsed.data);

  if (error) {
    logActionError('[admin/reviews] permanent delete failed', error, { id: parsed.data });
    return { ok: false, error: 'server_error' };
  }

  revalidatePath('/admin/reviews');
  return { ok: true };
}
