/* ══════════════════════════════════════════════════════════════════════════
   dispatch.ts — Order dispatch 비즈니스 로직 SoT (S166 Candidate 7 PR-1)

   역할:
   Server Action (어드민 UI 채널) 과 REST API (운영자 curl 채널) 가 동일하게
   호출하는 출고 전환 비즈니스 로직. 가드(인증) · cache invalidation 은
   호출자 책임 (ADR-006 §3, §5).

   책임:
   1) Zod 검증 — orderNumber · trackingNumber · carrier
   2) orders 조회 (id 확보) — service_role
   3) RPC dispatch_order — paid → shipping 원자 전환 + tracking/carrier/shipped_at
   4) 배송 알림 메일 fire-and-forget

   참조:
   - docs/adr/ADR-006-admin-pages-api-separation.md (분리 결정)
   - docs/adr/ADR-003-rbac-role-separation.md §6 (dual channel 정당화)
   ══════════════════════════════════════════════════════════════════════════ */

import { z } from 'zod';
import { sendShippingNotificationEmail } from '@/lib/email/notifications';
import { OrderNumberSchema } from '@/lib/schemas/order';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export type DispatchInput = {
  orderNumber: string;
  trackingNumber: string;
  carrier: string;
};

export type DispatchSuccess = {
  orderNumber: string;
  shippedAt: string;
  trackingNumber: string;
  carrier: string;
};

export type DispatchErrorCode =
  | 'not_found'
  | 'illegal_state'
  | 'invalid_tracking'
  | 'validation_failed'
  | 'server_error';

export type DispatchResult =
  | { ok: true; data: DispatchSuccess }
  | { ok: false; error: DispatchErrorCode; detail?: string };

const DispatchInputSchema = z.object({
  orderNumber: OrderNumberSchema,
  trackingNumber: z.string().trim().min(1).max(60),
  carrier: z.string().trim().min(1).max(60),
});

/**
 * dispatch_order RPC + 배송 알림 메일 (fire-and-forget).
 *
 * 가드(인증) · cache invalidation 은 호출자 책임.
 *
 * 에러 매핑 (DB → DispatchErrorCode):
 *   illegal_state:{cur} → { error:'illegal_state', detail: cur }
 *   invalid_tracking    → 'invalid_tracking'
 *   order_not_found     → 'not_found'
 *   기타 RPC error      → 'server_error'
 */
export async function dispatchOrder(
  input: DispatchInput,
): Promise<DispatchResult> {
  /* 1) Zod 검증 */
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

  /* 2) orders 조회 — service_role (dispatch_order RPC 가 service_role 전용) */
  const admin = getSupabaseAdmin();
  const { data: order, error: lookupErr } = await admin
    .from('orders')
    .select('id')
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (lookupErr || !order) {
    return { ok: false, error: 'not_found' };
  }

  /* 3) RPC 원자 커밋 */
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
    console.error('[dispatchOrder] RPC failed', {
      code: rpcError.code,
      msg: msg.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }

  /* 4) 알림 메일 — 실패해도 dispatch 자체는 성공 처리 */
  void sendShippingNotificationEmail(orderNumber, { trackingNumber, carrier });

  const result = (rpcData ?? {}) as {
    order_number?: string;
    shipped_at?: string;
  };
  return {
    ok: true,
    data: {
      orderNumber: result.order_number ?? orderNumber,
      shippedAt: result.shipped_at ?? new Date().toISOString(),
      trackingNumber,
      carrier,
    },
  };
}
