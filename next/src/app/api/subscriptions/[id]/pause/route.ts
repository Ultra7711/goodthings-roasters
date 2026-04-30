/* POST /api/subscriptions/[id]/pause — 구독 일시중지 */

import { apiError, apiSuccess } from '@/lib/api/errors';
import { getClaims } from '@/lib/auth/getClaims';
import { enforceSameOrigin } from '@/lib/api/csrf';
import {
  findSubscriptionForUser,
  pauseSubscription,
  toSubscription,
  type SubscriptionRow,
} from '@/lib/repositories/subscriptionRepo';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx): Promise<Response> {
  const forbidden = enforceSameOrigin(request);
  if (forbidden) return forbidden;

  const claims = await getClaims();
  if (!claims) return apiError('unauthorized');

  const { id } = await ctx.params;

  let sub: SubscriptionRow | null;
  try {
    sub = await findSubscriptionForUser(id);
  } catch (err) {
    console.error('[POST /api/subscriptions/[id]/pause] find error', err);
    return apiError('server_error');
  }
  if (!sub) return apiError('not_found');
  if (sub.status !== 'active') {
    return apiError('conflict', { detail: 'subscription_not_active' });
  }

  try {
    const updated = await pauseSubscription(id);
    return apiSuccess(toSubscription(updated));
  } catch (err) {
    console.error('[POST /api/subscriptions/[id]/pause] pause error', err);
    return apiError('server_error');
  }
}
