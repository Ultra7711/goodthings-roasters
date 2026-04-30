/* POST /api/subscriptions/[id]/resume — 구독 재개 */

import { apiError, apiSuccess } from '@/lib/api/errors';
import { getClaims } from '@/lib/auth/getClaims';
import { enforceSameOrigin } from '@/lib/api/csrf';
import {
  findSubscriptionForUser,
  resumeSubscription,
  calculateNextDeliveryDate,
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
    console.error('[POST /api/subscriptions/[id]/resume] find error', err);
    return apiError('server_error');
  }
  if (!sub) return apiError('not_found');
  if (sub.status !== 'paused') {
    return apiError('conflict', { detail: 'subscription_not_paused' });
  }

  /* 재개 시 next_delivery_at = now() + cycle_days */
  const nextDeliveryAt = calculateNextDeliveryDate(new Date(), sub.cycle);

  try {
    const updated = await resumeSubscription(id, nextDeliveryAt);
    return apiSuccess(toSubscription(updated));
  } catch (err) {
    console.error('[POST /api/subscriptions/[id]/resume] resume error', err);
    return apiError('server_error');
  }
}
