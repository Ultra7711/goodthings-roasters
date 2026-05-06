'use server';

/* ══════════════════════════════════════════════════════════════════════════
   actions.ts — /admin/orders/[orderNumber] server actions
   (S128 B-3 분리 · S166 dispatchOrder SoT 추출)

   결정 3 (B안): server action 분리
   - 기존 /api/admin/orders/[orderNumber]/ship 은 운영자 curl 용 (x-admin-secret)
     으로 유지. 어드민 UI 는 본 server action 을 호출.
   - 비즈니스 로직 SoT = lib/admin/dispatch.ts (ADR-006).
   - 본 모듈은 가드(인증) · cache invalidation 만 담당.

   책임:
   1) getAdminClaims() 가드 — 비인증/비admin 차단
   2) dispatchOrder() 호출 — 검증 + RPC + 메일 fire-and-forget
   3) revalidatePath — 상세/목록 캐시 무효화
   ══════════════════════════════════════════════════════════════════════════ */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { dispatchOrder, type DispatchResult } from '@/lib/admin/dispatch';
import { getAdminClaims } from '@/lib/auth/getClaims';
import { OrderNumberSchema } from '@/lib/schemas/order';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export type DispatchActionResult =
  | DispatchResult
  | { ok: false; error: 'unauthorized' };

/**
 * 어드민 UI 에서 송장 다이얼로그 제출 시 호출.
 *
 * 비admin 차단 + dispatchOrder SoT 호출 + 캐시 revalidate.
 */
export async function dispatchOrderAction(
  input: { orderNumber: string; trackingNumber: string; carrier: string },
): Promise<DispatchActionResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const result = await dispatchOrder(input);

  if (result.ok) {
    revalidatePath(`/admin/orders/${result.data.orderNumber}`);
    revalidatePath('/admin/orders');
  }

  return result;
}

/* ══════════════════════════════════════════════════════════════════════════
   updateAdminNotesAction — admin_notes 편집 (B-2 carry-over · S129)

   책임:
   1) admin 가드
   2) 입력 검증 (orderNumber + notes 길이)
   3) UPDATE orders.admin_notes WHERE order_number = ...
   4) revalidatePath
   ══════════════════════════════════════════════════════════════════════════ */

const UpdateNotesInputSchema = z.object({
  orderNumber: OrderNumberSchema,
  notes: z.string().max(2000),
});

export type UpdateNotesActionResult =
  | { ok: true; orderNumber: string }
  | {
      ok: false;
      error: 'unauthorized' | 'not_found' | 'validation_failed' | 'server_error';
      detail?: string;
    };

export async function updateAdminNotesAction(input: {
  orderNumber: string;
  notes: string;
}): Promise<UpdateNotesActionResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = UpdateNotesInputSchema.safeParse(input);
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
  const { orderNumber, notes } = parsed.data;

  const admin = getSupabaseAdmin();
  const trimmed = notes.trim();
  const { data, error } = await admin
    .from('orders')
    .update({ admin_notes: trimmed === '' ? null : trimmed })
    .eq('order_number', orderNumber)
    .select('order_number')
    .maybeSingle();

  if (error) {
    console.error('[updateAdminNotesAction] update failed', {
      code: error.code,
      message: error.message?.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }
  if (!data) return { ok: false, error: 'not_found' };

  revalidatePath(`/admin/orders/${orderNumber}`);

  return { ok: true, orderNumber };
}
