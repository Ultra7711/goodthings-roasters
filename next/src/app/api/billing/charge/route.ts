/* ══════════════════════════════════════════════════════════════════════════
   /api/billing/charge — 빌링 첫 회차 결제 (Phase 3-A · ADR-008 §3.4)

   POST : { orderId, billingMethodId } → Toss chargeBilling + atomic 후처리

   설계:
   - 회원만 (D-5)
   - 첫 회차 한정 (cron 자동 결제는 Phase 3-C)
   - rate limit: cart_write 재사용
   ══════════════════════════════════════════════════════════════════════════ */

import { z } from 'zod';
import { apiError, apiSuccess, apiValidationError } from '@/lib/api/errors';
import { enforceSameOrigin } from '@/lib/api/csrf';
import { checkRateLimit } from '@/lib/auth/rateLimit';
import { getClaims } from '@/lib/auth/getClaims';
import {
  chargeFirstCycle,
  BillingServiceError,
} from '@/lib/services/billingService';

const CHARGE_SCHEMA = z.object({
  orderId: z.string().uuid(),
  billingMethodId: z.string().uuid(),
});

export async function POST(request: Request): Promise<Response> {
  const forbidden = enforceSameOrigin(request);
  if (forbidden) return forbidden;

  const limited = await checkRateLimit(request, 'cart_write');
  if (limited) return limited;

  const claims = await getClaims();
  if (!claims) return apiError('unauthorized');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('validation_failed', { detail: 'invalid_json' });
  }

  const parsed = CHARGE_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error.flatten().fieldErrors);
  }

  try {
    const result = await chargeFirstCycle({
      orderId: parsed.data.orderId,
      userId: claims.userId,
      billingMethodId: parsed.data.billingMethodId,
    });
    return apiSuccess(result);
  } catch (err) {
    if (err instanceof BillingServiceError) {
      switch (err.code) {
        case 'profile_not_found':
          return apiError('unauthorized');
        case 'order_not_found':
        case 'billing_method_not_found':
          return apiError('not_found', { detail: err.code });
        case 'order_not_pending':
        case 'no_subscription_items':
          return apiError('conflict', { detail: err.code });
        case 'duplicate_subscription':
          return apiError('conflict', { detail: 'duplicate_subscription' });
        case 'toss_charge_failed':
        case 'charge_not_done':
          return apiError('payment_failed', { detail: err.code });
        default:
          return apiError('server_error');
      }
    }
    console.error('[billing.charge.POST] unexpected', {
      ...(process.env.NODE_ENV !== 'production' && {
        msg: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
      }),
    });
    return apiError('server_error');
  }
}
