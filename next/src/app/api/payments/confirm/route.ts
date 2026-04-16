/* ══════════════════════════════════════════════════════════════════════════
   POST /api/payments/confirm — Toss 결제 승인 최종 확정 (P2-B Session 4 B-3)

   요청 흐름:
   1) CSRF 가드 (Origin 헤더 검증)
   2) Rate Limit (`payment_confirm`: 10 req / 60s, IP 기준)
   3) zod 검증 (PaymentConfirmSchema)
   4) getClaims() 결과로 userId 결정 (null = 게스트 경로)
   5) paymentService.confirmOrder 호출
      - 소유권·상태·금액 교차검증 + Toss confirm + RPC 원자 커밋
      - 3중 멱등 방어 (앱 pre-check / RPC FOR UPDATE / UNIQUE 23505)
   6) 200 응답: { data: { orderNumber, status, totalAmount, method, virtualAccount? } }

   도메인 에러 매핑:
   - not_found          → 404 not_found
   - forbidden          → 403 forbidden
   - state_conflict     → 409 conflict (detail=이전 status)
   - amount_mismatch    → 409 conflict (detail='amount_mismatch')
   - toss_failed        → 402 payment_failed (detail=Toss code)
   - toss_unavailable   → 502 server_error (detail='toss_unavailable')
   - method_mismatch    → 409 conflict (detail=…)
   - 기타 PostgrestError → 500 server_error

   참조:
   - docs/payments-flow.md §3.1 엔드포인트 스펙 · §3.1.3 3중 방어
   ══════════════════════════════════════════════════════════════════════════ */

import { apiError, apiSuccess } from '@/lib/api/errors';
import { enforceSameOrigin } from '@/lib/api/csrf';
import { parseBody } from '@/lib/api/validate';
import { checkRateLimit } from '@/lib/auth/rateLimit';
import { getClaims } from '@/lib/auth/getClaims';
import { PaymentConfirmSchema } from '@/lib/schemas/payment';
import {
  confirmOrder,
  PaymentServiceError,
} from '@/lib/services/paymentService';

export async function POST(request: Request): Promise<Response> {
  /* 1) CSRF 가드 */
  const forbidden = enforceSameOrigin(request);
  if (forbidden) return forbidden;

  /* 2) Rate Limit */
  const limited = await checkRateLimit(request, 'payment_confirm');
  if (limited) return limited;

  /* 3) 입력 검증 */
  const parsed = await parseBody(request, PaymentConfirmSchema);
  if (!parsed.success) return parsed.response;
  const input = parsed.data;

  /* 4) 인증 조회 (null 허용 — 게스트 결제 경로) */
  const claims = await getClaims();
  const userId = claims?.userId ?? null;

  /* 5) 서비스 호출 */
  try {
    const result = await confirmOrder(input, { userId });
    return apiSuccess(result);
  } catch (err) {
    if (err instanceof PaymentServiceError) {
      switch (err.code) {
        case 'not_found':
          return apiError('not_found');
        case 'forbidden':
          return apiError('forbidden', { detail: err.detail });
        case 'state_conflict':
          return apiError('conflict', { detail: `state_conflict:${err.detail ?? ''}` });
        case 'amount_mismatch':
          return apiError('conflict', { detail: 'amount_mismatch' });
        case 'method_mismatch':
          return apiError('conflict', { detail: `method_mismatch:${err.detail ?? ''}` });
        case 'toss_failed':
          /* Toss 가 거부 (카드사 승인 실패 · ALREADY_PROCESSED_PAYMENT 예외 등).
             상세 code 는 클라이언트가 FAQ 매칭에 사용. */
          return apiError('payment_failed', { detail: err.detail ?? 'unknown' });
        case 'toss_unavailable':
          return apiError('server_error', {
            detail: 'toss_unavailable',
            status: 502,
          });
        default: {
          /* exhaustive check */
          const _exhaustive: never = err.code;
          void _exhaustive;
          return apiError('server_error');
        }
      }
    }

    /* DB 오류 등 — 서버 로그에만 스택 남김 */
    console.error('[POST /api/payments/confirm] unexpected error', err);
    return apiError('server_error');
  }
}
