/* GET /api/subscriptions — 회원 본인 구독 목록 */

import { apiError, apiSuccess } from '@/lib/api/errors';
import { getClaims } from '@/lib/auth/getClaims';
import { enforceSameOrigin } from '@/lib/api/csrf';
import { findSubscriptionsForUser, toSubscription } from '@/lib/repositories/subscriptionRepo';

export async function GET(request: Request): Promise<Response> {
  const forbidden = enforceSameOrigin(request);
  if (forbidden) return forbidden;

  const claims = await getClaims();
  if (!claims) return apiError('unauthorized');

  try {
    const rows = await findSubscriptionsForUser();
    return apiSuccess(rows.map(toSubscription));
  } catch (err) {
    console.error('[GET /api/subscriptions]', err);
    return apiError('server_error');
  }
}
