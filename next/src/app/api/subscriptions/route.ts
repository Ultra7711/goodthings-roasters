/* GET /api/subscriptions — 회원 본인 구독 목록 */

import { apiError, apiSuccess } from '@/lib/api/errors';
import { getClaims } from '@/lib/auth/getClaims';
import { enforceSameOrigin } from '@/lib/api/csrf';
import { findSubscriptionsWithBillingHealth } from '@/lib/repositories/subscriptionRepo';

export async function GET(request: Request): Promise<Response> {
  const forbidden = enforceSameOrigin(request);
  if (forbidden) return forbidden;

  const claims = await getClaims();
  if (!claims) return apiError('unauthorized');

  try {
    /* R-3d: 목록 + billing 상태(ok/detached/payment_failed) 머지 */
    const subscriptions = await findSubscriptionsWithBillingHealth();
    return apiSuccess(subscriptions);
  } catch (err) {
    console.error('[GET /api/subscriptions]', err);
    return apiError('server_error');
  }
}
