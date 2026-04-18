/* ══════════════════════════════════════════════════════════════════════════
   POST /api/admin/orders/[orderNumber]/ship — 배송 출고 전환 (Session 8-B B-2)

   용도:
   어드민 UI 가 구축되기 전 운영자가 curl/스크립트로 송장번호·택배사를 입력해
   주문 상태를 paid → shipping 으로 전환하고, 고객에게 배송 알림 메일을 발송한다.

   요청 흐름:
   1) CSRF 예외 (/api/admin/ 경로는 x-admin-secret 헤더 인증으로 대체)
   2) x-admin-secret timing-safe 비교 — 불일치 401
   3) orderNumber 포맷 검증 — 잘못되면 404 (존재 여부 비노출)
   4) body 검증 — { trackingNumber, carrier } 필수, 공백/길이 1~60
   5) orders 조회 (service_role) → orderId 확보, 없으면 404
   6) RPC dispatch_order(p_order_id, p_tracking, p_carrier) 호출
      - 'illegal_state:{current}' → 409 conflict
      - 'invalid_tracking'        → 400 validation_failed
      - 'order_not_found'         → 404 (RPC 행 잠금 타이밍)
   7) 성공 → 배송 알림 메일 fire-and-forget → 200 { shipped_at }

   보안:
   - ADMIN_API_SECRET 미설정 시 isAdminRequest() 항상 false → fail-closed.
   - orderNumber 존재 여부를 포맷 오류·미존재 모두 404 로 통일.
   ══════════════════════════════════════════════════════════════════════════ */

import { apiError, apiSuccess, apiValidationError } from '@/lib/api/errors';
import { isAdminRequest } from '@/lib/auth/adminAuth';
import { OrderNumberSchema } from '@/lib/schemas/order';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendShippingNotificationEmail } from '@/lib/email/notifications';
import { z } from 'zod';

type RouteParams = {
  params: Promise<{ orderNumber: string }>;
};

const ShipRequestSchema = z.object({
  trackingNumber: z.string().trim().min(1).max(60),
  carrier: z.string().trim().min(1).max(60),
});

export async function POST(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  /* 1) 어드민 인증 */
  if (!isAdminRequest(request)) {
    return apiError('unauthorized');
  }

  /* 2) 주문번호 포맷 */
  const { orderNumber } = await params;
  const numberParsed = OrderNumberSchema.safeParse(orderNumber);
  if (!numberParsed.success) {
    return apiError('not_found');
  }

  /* 3) body 검증 */
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError('validation_failed', { detail: 'invalid_json' });
  }
  const bodyParsed = ShipRequestSchema.safeParse(rawBody);
  if (!bodyParsed.success) {
    return apiValidationError(bodyParsed.error.flatten().fieldErrors);
  }
  const { trackingNumber, carrier } = bodyParsed.data;

  const admin = getSupabaseAdmin();

  /* 4) orders 조회 — orderId 확보 */
  const { data: order, error: lookupErr } = await admin
    .from('orders')
    .select('id')
    .eq('order_number', numberParsed.data)
    .single();

  if (lookupErr || !order) {
    return apiError('not_found');
  }

  /* 5) RPC 원자 커밋 */
  const { data: rpcData, error: rpcError } = await admin.rpc('dispatch_order', {
    p_order_id: (order as { id: string }).id,
    p_tracking: trackingNumber,
    p_carrier: carrier,
  });

  if (rpcError) {
    const msg = rpcError.message ?? '';
    if (msg.startsWith('illegal_state:')) {
      const current = msg.slice('illegal_state:'.length);
      return apiError('conflict', { detail: `illegal_state:${current}` });
    }
    if (msg.includes('invalid_tracking')) {
      return apiError('validation_failed', { detail: 'invalid_tracking' });
    }
    if (msg.includes('order_not_found')) {
      return apiError('not_found');
    }
    console.error('[admin.ship] RPC failed', {
      code: rpcError.code,
      msg: msg.slice(0, 200),
    });
    return apiError('server_error');
  }

  /* 6) 배송 알림 메일 (fire-and-forget) */
  void sendShippingNotificationEmail(numberParsed.data, {
    trackingNumber,
    carrier,
  });

  const result = (rpcData ?? {}) as {
    order_number?: string;
    shipped_at?: string;
  };

  return apiSuccess({
    orderNumber: result.order_number ?? numberParsed.data,
    shippedAt: result.shipped_at ?? null,
    trackingNumber,
    carrier,
  });
}
