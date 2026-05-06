/* ══════════════════════════════════════════════════════════════════════════
   POST /api/admin/orders/[orderNumber]/ship — 배송 출고 전환
   (Session 8-B B-2 · S166 dispatchOrder SoT 추출)

   용도:
   운영자가 curl/스크립트로 송장번호·택배사를 입력해 주문 상태를
   paid → shipping 으로 전환하고, 고객에게 배송 알림 메일을 발송한다.
   어드민 UI 채널은 별도 Server Action 사용 (ADR-006 §1).

   요청 흐름:
   1) CSRF 예외 (/api/admin/ 경로는 x-admin-secret 헤더 인증으로 대체)
   2) x-admin-secret timing-safe 비교 — 불일치 401
   3) orderNumber 포맷 검증 — 잘못되면 404 (존재 여부 비노출)
   4) body 검증 — { trackingNumber, carrier } 필수, 공백/길이 1~60
   5) dispatchOrder SoT 호출 — 검증 + 조회 + RPC + 메일
   6) DispatchResult → 표준 envelope 변환 (dispatchResultToApiResponse)

   보안:
   - ADMIN_API_SECRET 미설정 시 isAdminRequest() 항상 false → fail-closed.
   - orderNumber 존재 여부를 포맷 오류·미존재 모두 404 로 통일.
   ══════════════════════════════════════════════════════════════════════════ */

import { dispatchOrder } from '@/lib/admin/dispatch';
import { dispatchResultToApiResponse } from '@/lib/admin/dispatchResponse';
import { apiError, apiValidationError } from '@/lib/api/errors';
import { isAdminRequest } from '@/lib/auth/adminAuth';
import { OrderNumberSchema } from '@/lib/schemas/order';
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

  /* 4) dispatchOrder SoT 호출 → 표준 envelope 변환 */
  const result = await dispatchOrder({
    orderNumber: numberParsed.data,
    trackingNumber: bodyParsed.data.trackingNumber,
    carrier: bodyParsed.data.carrier,
  });

  return dispatchResultToApiResponse(result);
}
