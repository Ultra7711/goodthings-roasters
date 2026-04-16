/* ══════════════════════════════════════════════════════════════════════════
   POST /api/orders — 주문 생성 (P2-A-2)

   요청 흐름:
   1) Rate Limit (order_create: 10 req / 1 m, IP 기준)
   2) zod 검증 (OrderCreateSchema)
   3) 인증 판단 — getClaims() 결과로 userId 결정
   4) 게스트 조건 검증 — userId == null 이면 contactEmail 을 guestEmail 로 사용
   5) orderService.createOrderFromInput — 가격 재계산 + argon2 + RPC
   6) 201 응답: { data: { id, orderNumber, totalAmount } }

   비즈 원칙:
   - 클라이언트 가격/총액 필드는 받지 않는다. 서버가 권위.
   - 게스트 guest_email 은 contactEmail 로 통일 (폼에 별도 guest email 필드 없음).

   에러 매핑:
   - OrderServiceError('product_not_found' | 'volume_not_found' | 'volume_sold_out')
     → 409 conflict + detail
   - OrderServiceError('subscription_not_allowed')
     → 400 validation_failed + detail
   - 그 외 DB 오류 → 500 server_error
   ══════════════════════════════════════════════════════════════════════════ */

import { apiError, apiSuccess } from '@/lib/api/errors';
import { parseBody } from '@/lib/api/validate';
import { checkRateLimit } from '@/lib/auth/rateLimit';
import { getClaims } from '@/lib/auth/getClaims';
import { OrderCreateSchema } from '@/lib/schemas/order';
import {
  createOrderFromInput,
  OrderServiceError,
} from '@/lib/services/orderService';

export async function POST(request: Request): Promise<Response> {
  /* 1) Rate Limit */
  const limited = await checkRateLimit(request, 'order_create');
  if (limited) return limited;

  /* 2) 입력 검증 */
  const parsed = await parseBody(request, OrderCreateSchema);
  if (!parsed.success) return parsed.response;
  const input = parsed.data;

  /* 3) 인증 조회 (null 허용) */
  const claims = await getClaims();
  const userId = claims?.userId ?? null;

  /* 4) 게스트 조건 — contactEmail 을 guestEmail 로 사용 */
  const guestEmail = userId == null ? input.contactEmail : null;

  /* 5) 서비스 호출 */
  try {
    const result = await createOrderFromInput(input, {
      userId,
      guestEmail,
    });

    /* 6) 201 Created */
    return apiSuccess(result, 201);
  } catch (err) {
    /* 도메인 에러 → 4xx 매핑 */
    if (err instanceof OrderServiceError) {
      switch (err.code) {
        case 'product_not_found':
        case 'volume_not_found':
        case 'volume_sold_out':
          return apiError('conflict', { detail: `${err.code}:${err.detail ?? ''}` });
        case 'subscription_not_allowed':
        case 'guest_pin_required':
        case 'guest_email_required':
          return apiError('validation_failed', {
            detail: err.code,
            status: 400,
          });
        default:
          return apiError('server_error');
      }
    }

    /* DB 오류 등 — 서버 로그에만 스택 남김 */
    console.error('[POST /api/orders] unexpected error', err);
    return apiError('server_error');
  }
}
