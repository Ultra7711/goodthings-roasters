/* ══════════════════════════════════════════════════════════════════════════
   /api/billing/charge/recurring — 정기배송 회차 자동 청구 (R-1)

   POST { subscriptionId } → 회차 주문 생성 + 빌링 자동결제 + 후처리

   인증:
   - x-cron-secret 헤더(timing-safe). pg_cron(R-2) 또는 운영자 수동 트리거 전용.
   - 브라우저 호출 아님 → CSRF 예외(csrf.ts CSRF_EXEMPT_PATHS).

   멱등:
   - chargeRecurringCycle 내부 RPC 가 next_delivery_at>now() 면 거부(중복 청구 0).
   - 토스 Idempotency-Key 이중 방어.
   ══════════════════════════════════════════════════════════════════════════ */

import { z } from 'zod';
import { apiError, apiSuccess, apiValidationError } from '@/lib/api/errors';
import { isCronRequest } from '@/lib/auth/cronAuth';
import {
  chargeRecurringCycle,
  BillingServiceError,
} from '@/lib/services/billingService';

const RECURRING_SCHEMA = z.object({
  subscriptionId: z.string().uuid(),
});

export async function POST(request: Request): Promise<Response> {
  /* 내부 인증 — 실패 시 즉시 거부(fail-closed) */
  if (!isCronRequest(request)) return apiError('unauthorized');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('validation_failed', { detail: 'invalid_json' });
  }

  const parsed = RECURRING_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error.flatten().fieldErrors);
  }

  try {
    const result = await chargeRecurringCycle({
      subscriptionId: parsed.data.subscriptionId,
    });
    return apiSuccess(result);
  } catch (err) {
    if (err instanceof BillingServiceError) {
      /* 예상된 도메인 실패 — 운영 가시성 위해 코드만 기록(민감정보 없음). */
      console.warn('[billing.charge.recurring] billing error', {
        subscriptionId: parsed.data.subscriptionId,
        code: err.code,
      });
      switch (err.code) {
        case 'subscription_not_found':
          return apiError('not_found', { detail: err.code });
        /* 청구 보류·중복·데이터 미비 → 409 (cron 이 재시도 큐로 흡수) */
        case 'subscription_not_active':
        case 'already_charged_this_cycle':
        case 'subscription_snapshot_missing':
        case 'billing_method_not_found':
        case 'no_default_address':
        case 'product_not_found':
          return apiError('conflict', { detail: err.code });
        case 'toss_charge_failed':
        case 'charge_not_done':
          return apiError('payment_failed', { detail: err.code });
        default:
          return apiError('server_error');
      }
    }
    console.error('[billing.charge.recurring.POST] unexpected', {
      ...(process.env.NODE_ENV !== 'production' && {
        msg:
          err instanceof Error
            ? err.message.slice(0, 200)
            : String(err).slice(0, 200),
      }),
    });
    return apiError('server_error');
  }
}
