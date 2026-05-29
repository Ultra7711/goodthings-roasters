'use server';

/* ══════════════════════════════════════════════════════════════════════════
   actions.ts — /admin/biz-inquiries Server Actions (S250-3)

   책임:
   1) getAdminClaims 가드 — 비admin 차단 (owner + staff)
   2) Zod 검증 — id(uuid) · status(enum)
   3) biz_inquiries.status UPDATE (admin RLS biz_inquiries_admin_update 통과 · 067)
   4) revalidatePath('/admin/biz-inquiries')

   설계 (users/actions.ts 답습 · ADR-006 admin 단일 채널):
   - 호출처 = 어드민 UI 1곳 → Server Action 단일 채널 (REST API 미생성)
   - RPC 불필요 — admin RLS 가 UPDATE 권한 보장 → createRouteHandlerClient 직접 UPDATE
   ══════════════════════════════════════════════════════════════════════════ */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getAdminClaims } from '@/lib/auth/getClaims';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { logActionError } from '@/lib/admin/logActionError';

const UuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'invalid_uuid',
  );

const StatusChangeSchema = z.object({
  id: UuidSchema,
  status: z.enum(['pending', 'contacted', 'closed']),
});

export type BizStatusChangeInput = z.input<typeof StatusChangeSchema>;

export type BizStatusActionResult =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'validation_failed' | 'server_error' };

export async function updateBizInquiryStatus(
  input: BizStatusChangeInput,
): Promise<BizStatusActionResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = StatusChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation_failed' };

  const supabase = await createRouteHandlerClient();
  const { error } = await supabase
    .from('biz_inquiries')
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.id);

  if (error) {
    logActionError('[biz-inquiries] status update failed', error, {
      id: parsed.data.id,
    });
    return { ok: false, error: 'server_error' };
  }

  revalidatePath('/admin/biz-inquiries');
  return { ok: true };
}
