/* ══════════════════════════════════════════════════════════════════════════
   deliverOrder.ts — 구매확정(배송완료) 처리 비즈니스 로직 SoT (S327 · Phase 4)

   역할:
   shipping → delivered 전이 + 배송완료 적립을 원자 처리하는 098 complete_delivery
   RPC 의 유일한 앱 진입점. 적립 트리거 3종이 모두 이 함수를 호출한다:
     1) 운영자 override 버튼 (어드민 주문 상세 · 이번 세션)
     2) 구매자 "구매확정" 버튼 (프론트 P5 · 다음 세션)
     3) 자동확정 크론 (발송 + auto_confirm_days 경과 · 다음 세션)

   가드(인증) · cache invalidation 은 호출자 책임 (dispatch.ts 패턴 답습).

   적립액 산정 (DEC-P1·Δ3):
   - computeEarnAmount(subtotal, 정책) = 단일 권위. 본 함수가 계산 → RPC 는 기록만.
   - points.enabled=false 또는 earn.enabled=false 면 0 → 전이만(미적립).
   - 게스트(user_id NULL)는 RPC 내부에서 미적립.
   - 멱등: idempotency_key = 'earn:'||order_id (주문당 1회 · 재호출 안전).

   참조:
   - lib/admin/dispatch.ts (dispatchOrder · SoT 패턴)
   - supabase/migrations/098_complete_delivery_earn.sql
   - lib/services/pointService.ts (computeEarnAmount)
   ══════════════════════════════════════════════════════════════════════════ */

import { computeEarnAmount } from '@/lib/services/pointService';
import { OrderNumberSchema } from '@/lib/schemas/order';
import { fetchSiteSettings } from '@/lib/siteSettingsServer';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export type DeliverSuccess = {
  orderNumber: string;
  /** 이번 호출로 적립이 실제 기록됐는지 (멱등 중복이면 false) */
  earnApplied: boolean;
  /** 산정된 적립액 (정책 OFF·게스트면 0) */
  earnAmount: number;
};

export type DeliverErrorCode =
  | 'not_found'
  | 'illegal_state'
  | 'validation_failed'
  | 'server_error';

export type DeliverResult =
  | { ok: true; data: DeliverSuccess }
  | { ok: false; error: DeliverErrorCode; detail?: string };

/**
 * 098 complete_delivery RPC 호출 + 정책 기반 적립액 산정.
 *
 * 가드(인증) · cache invalidation 은 호출자 책임.
 *
 * 에러 매핑 (DB → DeliverErrorCode):
 *   illegal_state:{cur} → { error:'illegal_state', detail: cur }  (shipping 아님)
 *   order_not_found     → 'not_found'
 *   기타 RPC error      → 'server_error'
 */
export async function deliverOrder(orderNumber: string): Promise<DeliverResult> {
  /* 1) 입력 검증 */
  const parsed = OrderNumberSchema.safeParse(orderNumber);
  if (!parsed.success) {
    return { ok: false, error: 'validation_failed' };
  }
  const orderNo = parsed.data;

  /* 2) 주문 조회 — service_role (complete_delivery RPC 가 service_role 전용).
        적립 기준액 = subtotal (Δ3). */
  const admin = getSupabaseAdmin();
  const { data: order, error: lookupErr } = await admin
    .from('orders')
    .select('id, subtotal')
    .eq('order_number', orderNo)
    .maybeSingle<{ id: string; subtotal: number }>();

  if (lookupErr || !order) {
    return { ok: false, error: 'not_found' };
  }

  /* 3) 적립액 산정 — 정책 단일 권위(computeEarnAmount). enabled=false 면 0. */
  const { points } = await fetchSiteSettings();
  const earnAmount = computeEarnAmount(order.subtotal, points);

  /* 4) RPC 원자 커밋 — 전이 + 적립(멱등 earn:||order_id) */
  const { data: rpcData, error: rpcError } = await admin.rpc('complete_delivery', {
    p_order_id: order.id,
    p_earn_amount: earnAmount,
    p_earn_idempotency_key: `earn:${order.id}`,
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
    if (msg.includes('order_not_found')) {
      return { ok: false, error: 'not_found' };
    }
    console.error('[deliverOrder] RPC failed', {
      code: rpcError.code,
      msg: msg.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }

  const result = (rpcData ?? {}) as { order_number?: string; earn_applied?: boolean };
  return {
    ok: true,
    data: {
      orderNumber: result.order_number ?? orderNo,
      earnApplied: result.earn_applied === true,
      earnAmount,
    },
  };
}
