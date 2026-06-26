/* ══════════════════════════════════════════════════════════════════════════
   POST /api/orders/[orderNumber]/cancel — pending 주문 DELETE (S171 PR-B / S173 변경)

   역할:
   - Toss 결제창 이탈(onBack · pageshow persisted) 시 클라이언트가 호출.
   - `status = 'pending'` 인 경우만 DELETE. 그 외 상태는 no-op.
   - 게스트 주문 미지원 (PIN 없이 orderNumber 만으로 처리 가능해지면 보안 취약).

   S173 정책 변경:
   - "Toss 위젯에서 이전" 은 사용자 명시 취소가 아닌 UX 네비게이션 → cancelled status
     로 남길 가치 없음. 결제 미완료 흔적은 DELETE.
   - cancelled 는 진짜 운영 취소(사용자 토스 직접 취소·운영 수동 취소) 전용.
   - 라우트 경로(/cancel)는 클라이언트 호환을 위해 유지, 의미는 abandon.

   보안:
   - getClaims() 인증 필수 → 미인증 401.
   - service_role + user_id 필터로 타인 주문 보호 (deletePendingOrderForUser).
   - 주문 미존재·비pending 모두 200 으로 응답하여 존재 여부 노출 방지.
   ══════════════════════════════════════════════════════════════════════════ */

import { apiError, apiSuccess } from '@/lib/api/errors';
import { enforceSameOrigin } from '@/lib/api/csrf';
import { getClaims } from '@/lib/auth/getClaims';
import { deletePendingOrderForUser } from '@/lib/repositories/orderRepo';
import { OrderNumberSchema } from '@/lib/schemas/order';

type RouteParams = {
  params: Promise<{ orderNumber: string }>;
};

export async function POST(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  /* S334: 다른 모든 state-change POST 와 동일하게 CSRF(동일 origin) 가드 추가.
     pending 주문 DELETE 는 상태 변경이므로 교차 origin 요청 차단. */
  const forbidden = enforceSameOrigin(request);
  if (forbidden) return forbidden;

  const { orderNumber } = await params;

  const parsed = OrderNumberSchema.safeParse(orderNumber);
  if (!parsed.success) return apiError('not_found');

  const claims = await getClaims();
  if (!claims) return apiError('unauthorized');

  try {
    await deletePendingOrderForUser(parsed.data, claims.userId);
    return apiSuccess({ deleted: true });
  } catch (err) {
    console.error('[POST /api/orders/:orderNumber/cancel] unexpected error', err);
    return apiError('server_error');
  }
}
