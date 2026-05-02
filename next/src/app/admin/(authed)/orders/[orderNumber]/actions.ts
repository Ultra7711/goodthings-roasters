'use server';

/* ══════════════════════════════════════════════════════════════════════════
   actions.ts — /admin/orders/[orderNumber] server actions (S128 B-3)

   결정 3 (B안): server action 분리
   - 기존 /api/admin/orders/[orderNumber]/ship 은 운영자 curl 용 (x-admin-secret)
     으로 유지. 어드민 UI 는 본 server action 을 호출.

   책임:
   1) getAdminClaims() 가드 — 비인증/비admin 차단
   2) 입력 검증 (Zod) — orderNumber · trackingNumber · carrier
   3) orders 조회 (id 확보) — service_role (RPC 호출 위해 동일 클라 재사용)
   4) RPC dispatch_order — paid → shipping 원자 전환 + tracking/carrier/shipped_at
   5) 배송 알림 메일 fire-and-forget
   6) revalidatePath — 상세/목록 캐시 무효화
   ══════════════════════════════════════════════════════════════════════════ */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getAdminClaims } from '@/lib/auth/getClaims';
import { sendShippingNotificationEmail } from '@/lib/email/notifications';
import { OrderNumberSchema } from '@/lib/schemas/order';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const DispatchInputSchema = z.object({
  orderNumber: OrderNumberSchema,
  trackingNumber: z.string().trim().min(1).max(60),
  carrier: z.string().trim().min(1).max(60),
});

export type DispatchActionResult =
  | {
      ok: true;
      orderNumber: string;
      shippedAt: string;
      trackingNumber: string;
      carrier: string;
    }
  | {
      ok: false;
      error:
        | 'unauthorized'
        | 'not_found'
        | 'illegal_state'
        | 'invalid_tracking'
        | 'validation_failed'
        | 'server_error';
      detail?: string;
    };

/**
 * 어드민 UI 에서 송장 다이얼로그 제출 시 호출.
 *
 * 비admin 차단 + 원자 RPC 호출 + 알림 메일 fire-and-forget + 캐시 revalidate.
 *
 * 에러 매핑:
 *   illegal_state:{cur}     → { ok:false, error:'illegal_state', detail: cur }
 *   invalid_tracking        → 'invalid_tracking'
 *   order_not_found         → 'not_found'
 *   기타                    → 'server_error'
 */
export async function dispatchOrderAction(
  input: { orderNumber: string; trackingNumber: string; carrier: string },
): Promise<DispatchActionResult> {
  /* 1) admin 가드 */
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  /* 2) 입력 검증 */
  const parsed = DispatchInputSchema.safeParse(input);
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
  const { orderNumber, trackingNumber, carrier } = parsed.data;

  /* 3) orders 조회 — service_role (dispatch_order RPC 가 service_role 전용) */
  const admin = getSupabaseAdmin();
  const { data: order, error: lookupErr } = await admin
    .from('orders')
    .select('id')
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (lookupErr || !order) {
    return { ok: false, error: 'not_found' };
  }

  /* 4) RPC 원자 커밋 */
  const { data: rpcData, error: rpcError } = await admin.rpc('dispatch_order', {
    p_order_id: (order as { id: string }).id,
    p_tracking: trackingNumber,
    p_carrier: carrier,
  });

  if (rpcError) {
    const msg = rpcError.message ?? '';
    if (msg.startsWith('illegal_state:')) {
      return {
        ok: false,
        error: 'illegal_state',
        detail: msg.slice('illegal_state:'.length),
      };
    }
    if (msg.includes('invalid_tracking')) {
      return { ok: false, error: 'invalid_tracking' };
    }
    if (msg.includes('order_not_found')) {
      return { ok: false, error: 'not_found' };
    }
    console.error('[dispatchOrderAction] RPC failed', {
      code: rpcError.code,
      msg: msg.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }

  /* 5) 알림 메일 — 실패해도 dispatch 자체는 성공 처리 */
  void sendShippingNotificationEmail(orderNumber, { trackingNumber, carrier });

  /* 6) revalidate */
  revalidatePath(`/admin/orders/${orderNumber}`);
  revalidatePath('/admin/orders');

  const result = (rpcData ?? {}) as { order_number?: string; shipped_at?: string };
  return {
    ok: true,
    orderNumber: result.order_number ?? orderNumber,
    shippedAt: result.shipped_at ?? new Date().toISOString(),
    trackingNumber,
    carrier,
  };
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
