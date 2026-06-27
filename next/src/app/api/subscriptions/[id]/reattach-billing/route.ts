/* POST /api/subscriptions/[id]/reattach-billing — 결제수단 재연결 + 자동 재개 (R-3d)

   끊긴(detached)/정지(paused) 구독에 새로 발급한 빌링수단을 연결한다.
   - 선행: /billing/reattach/success 가 POST /api/billing/authorizations 로 빌링키 발급
     → 받은 billingMethodId 를 본 라우트로 전달.
   - paused 구독이면 자동 재개(active · next=now+cycle · DEC-S339-1·2).
   - 소유권·카드 유효성·atomic 처리는 108 RPC reattach_subscription_billing 가 보장. */

import { z } from 'zod';
import { apiError, apiSuccess, apiValidationError } from '@/lib/api/errors';
import { getClaims } from '@/lib/auth/getClaims';
import { enforceSameOrigin } from '@/lib/api/csrf';
import { checkRateLimit } from '@/lib/auth/rateLimit';
import {
  reattachSubscriptionBilling,
  toSubscription,
  type SubscriptionRow,
} from '@/lib/repositories/subscriptionRepo';

const ID_SCHEMA = z.string().uuid();
const BODY_SCHEMA = z.object({
  billingMethodId: z.string().uuid(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx): Promise<Response> {
  const forbidden = enforceSameOrigin(request);
  if (forbidden) return forbidden;

  const limited = await checkRateLimit(request, 'cart_write');
  if (limited) return limited;

  const claims = await getClaims();
  if (!claims) return apiError('unauthorized');

  const { id } = await ctx.params;
  if (!ID_SCHEMA.safeParse(id).success) {
    return apiError('validation_failed', { detail: 'invalid_id' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('validation_failed', { detail: 'invalid_json' });
  }
  const parsed = BODY_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error.flatten().fieldErrors);
  }

  let updated: SubscriptionRow;
  try {
    updated = await reattachSubscriptionBilling(id, parsed.data.billingMethodId);
  } catch (err) {
    /* 108 RPC raise → message 문자열 매칭(billingService.chargeRecurringCycle 와 동일 패턴).
       PostgREST SQLSTATE 전달에 의존하지 않는다. */
    const msg = err instanceof Error ? err.message : String(err);
    /* 소유권 실패 / 빌링수단 무효 → not_found (정보 노출 최소화) */
    if (/subscription not found|billing_method invalid/.test(msg)) {
      return apiError('not_found');
    }
    /* cancelled/expired 구독 등 재연결 불가 상태 */
    if (/not reattachable/.test(msg)) {
      return apiError('conflict', { detail: 'not_reattachable' });
    }
    console.error('[POST /api/subscriptions/[id]/reattach-billing] error', {
      ...(process.env.NODE_ENV !== 'production' && {
        msg: msg.slice(0, 200),
      }),
    });
    return apiError('server_error');
  }

  /* 재연결 직후이므로 billingStatus='ok' 확정 */
  return apiSuccess(toSubscription(updated, 'ok'));
}
