/* ══════════════════════════════════════════════════════════════════════════
   POST /api/orders/[orderNumber]/cancel — pending 주문 명시 취소 (S171 PR-B)

   역할:
   - Toss 결제창 이탈(onBack · pageshow persisted) 시 클라이언트가 호출.
   - `status = 'pending'` 인 경우만 `cancelled` 로 전환. 그 외 상태는 no-op.
   - 게스트 주문 취소 미지원 (PIN 없이 orderNumber 만으로 취소 가능해지면 보안 취약).

   보안:
   - getClaims() 인증 필수 → 미인증 401.
   - service_role + user_id 필터로 타인 주문 보호 (cancelPendingOrderForUser).
   - 주문 미존재·비pending 모두 200 으로 응답하여 존재 여부 노출 방지.
   ══════════════════════════════════════════════════════════════════════════ */

import { apiError, apiSuccess } from '@/lib/api/errors';
import { getClaims } from '@/lib/auth/getClaims';
import { cancelPendingOrderForUser } from '@/lib/repositories/orderRepo';
import { OrderNumberSchema } from '@/lib/schemas/order';

type RouteParams = {
  params: Promise<{ orderNumber: string }>;
};

export async function POST(
  _request: Request,
  { params }: RouteParams,
): Promise<Response> {
  const { orderNumber } = await params;

  const parsed = OrderNumberSchema.safeParse(orderNumber);
  if (!parsed.success) return apiError('not_found');

  const claims = await getClaims();
  if (!claims) return apiError('unauthorized');

  try {
    await cancelPendingOrderForUser(parsed.data, claims.userId);
    return apiSuccess({ cancelled: true });
  } catch (err) {
    console.error('[POST /api/orders/:orderNumber/cancel] unexpected error', err);
    return apiError('server_error');
  }
}
