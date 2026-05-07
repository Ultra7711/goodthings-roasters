/* PATCH /api/subscriptions/[id] — 배송 주기 변경
   DELETE /api/subscriptions/[id] — 구독 해지 */

import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/errors';
import { getClaims } from '@/lib/auth/getClaims';
import { enforceSameOrigin } from '@/lib/api/csrf';
import { parseBody } from '@/lib/api/validate';
import {
  findSubscriptionForUser,
  updateSubscriptionCycle,
  cancelSubscription,
  toSubscription,
  type SubscriptionRow,
} from '@/lib/repositories/subscriptionRepo';
import {
  SUBSCRIPTION_CYCLES,
  recalculateNextDeliveryOnCycleChange,
  type SubscriptionCycle,
} from '@/lib/subscription/cycles';

const PatchSchema = z.object({
  cycle: z.enum(SUBSCRIPTION_CYCLES),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx): Promise<Response> {
  const forbidden = enforceSameOrigin(request);
  if (forbidden) return forbidden;

  const claims = await getClaims();
  if (!claims) return apiError('unauthorized');

  const { id } = await ctx.params;

  const parsed = await parseBody(request, PatchSchema);
  if (!parsed.success) return parsed.response;

  let sub: SubscriptionRow | null;
  try {
    sub = await findSubscriptionForUser(id);
  } catch (err) {
    console.error('[PATCH /api/subscriptions/[id]] find error', err);
    return apiError('server_error');
  }
  if (!sub) return apiError('not_found');
  if (sub.status !== 'active' && sub.status !== 'paused') {
    return apiError('conflict', { detail: 'subscription_not_active' });
  }

  /* 다음 배송일 재계산: 직전 배송일(next_delivery_at − oldCycle) + newCycle.
     클라이언트 미리보기 (useSubscriptionActions.previewNextDate) 와 동일 결과 보장. */
  const newCycle = parsed.data.cycle;
  const nextDeliveryAt = recalculateNextDeliveryOnCycleChange(
    new Date(sub.next_delivery_at),
    sub.cycle as SubscriptionCycle,
    newCycle,
  );

  try {
    const updated = await updateSubscriptionCycle(id, newCycle, nextDeliveryAt);
    return apiSuccess(toSubscription(updated));
  } catch (err) {
    console.error('[PATCH /api/subscriptions/[id]] update error', err);
    return apiError('server_error');
  }
}

export async function DELETE(request: Request, ctx: Ctx): Promise<Response> {
  const forbidden = enforceSameOrigin(request);
  if (forbidden) return forbidden;

  const claims = await getClaims();
  if (!claims) return apiError('unauthorized');

  const { id } = await ctx.params;

  let sub: SubscriptionRow | null;
  try {
    sub = await findSubscriptionForUser(id);
  } catch (err) {
    console.error('[DELETE /api/subscriptions/[id]] find error', err);
    return apiError('server_error');
  }
  if (!sub) return apiError('not_found');
  if (sub.status === 'cancelled' || sub.status === 'expired') {
    return apiError('conflict', { detail: 'already_cancelled' });
  }

  try {
    const updated = await cancelSubscription(id);
    return apiSuccess(toSubscription(updated));
  } catch (err) {
    console.error('[DELETE /api/subscriptions/[id]] cancel error', err);
    return apiError('server_error');
  }
}
