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
import { deliverOrder, type DeliverResult } from '@/lib/admin/deliverOrder';
import { getAdminClaims, getAdminOwnerClaims } from '@/lib/auth/getClaims';
import { OrderNumberSchema } from '@/lib/schemas/order';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { logActionError } from '@/lib/admin/logActionError';

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
   completeDeliveryAction — 운영자 override 배송완료(구매확정) (S327 · Phase 4)

   구매확정 모델(DEC-S327-1)의 적립 트리거 3종 중 운영자 예외 경로:
   일상 경로 = 구매자 "구매확정" 버튼(P5) · 발송+N일 자동확정 크론(다음 세션).
   본 버튼은 예외(운영자가 수령 확인·조기 확정)용.

   책임:
   1) owner 가드 — 적립(금전) 발생 + 예외적 수동 작업이라 owner-only
      (정책 설정·adjust_points 와 동급 · staff 차단)
   2) deliverOrder SoT 호출 — shipping→delivered 전이 + 적립(멱등)
   3) revalidatePath — 상세/목록 캐시 무효화
   ══════════════════════════════════════════════════════════════════════════ */

export type CompleteDeliveryActionResult =
  | DeliverResult
  | { ok: false; error: 'unauthorized' };

export async function completeDeliveryAction(
  input: { orderNumber: string },
): Promise<CompleteDeliveryActionResult> {
  const claims = await getAdminOwnerClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const result = await deliverOrder(input.orderNumber);

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
    logActionError('[updateAdminNotesAction] update failed', error, { orderNumber });
    return { ok: false, error: 'server_error' };
  }
  if (!data) return { ok: false, error: 'not_found' };

  revalidatePath(`/admin/orders/${orderNumber}`);

  return { ok: true, orderNumber };
}
