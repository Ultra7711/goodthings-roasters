/* ══════════════════════════════════════════════════════════════════════════
   GET /api/orders/[orderNumber] — 회원 본인 주문 조회 (P2-A-3)

   요청 흐름:
   1) orderNumber 파라미터 포맷 검증 (GT-YYYYMMDD-NNNNN)
   2) getClaims() — 미인증이면 401 unauthorized
   3) findOrderForUser (RLS orders_select_own 이 차단 시 null)
   4) 조회 결과 없음 → 404 not_found
   5) 조회 성공 → 200 { data: { order } }

   보안:
   - 타인 주문은 RLS 가 자동 차단 → null 반환 → 404 로 응답하여
     주문번호 존재 여부 누설 방지.
   - 게스트 주문 조회는 POST /api/orders/guest-lookup 전용 엔드포인트 사용.
   ══════════════════════════════════════════════════════════════════════════ */

import { apiError, apiSuccess } from '@/lib/api/errors';
import { getClaims } from '@/lib/auth/getClaims';
import { findOrderForUser } from '@/lib/repositories/orderRepo';
import { OrderNumberSchema } from '@/lib/schemas/order';

type RouteParams = {
  params: Promise<{ orderNumber: string }>;
};

export async function GET(
  _request: Request,
  { params }: RouteParams,
): Promise<Response> {
  const { orderNumber } = await params;

  /* 1) 포맷 검증 */
  const parsed = OrderNumberSchema.safeParse(orderNumber);
  if (!parsed.success) {
    return apiError('not_found'); // 잘못된 포맷도 존재 여부를 노출하지 않도록 404
  }

  /* 2) 인증 필수 */
  const claims = await getClaims();
  if (!claims) return apiError('unauthorized');

  /* 3) 조회 (RLS 가 타인 주문 차단) */
  try {
    const order = await findOrderForUser(parsed.data);
    if (!order) return apiError('not_found');
    return apiSuccess({ order });
  } catch (err) {
    console.error('[GET /api/orders/:orderNumber] unexpected error', err);
    return apiError('server_error');
  }
}
