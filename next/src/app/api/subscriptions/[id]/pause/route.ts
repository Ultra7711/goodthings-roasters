/* POST /api/subscriptions/[id]/pause — 구독 일시중지 */

import { apiError, apiSuccess } from '@/lib/api/errors';
import { getClaims } from '@/lib/auth/getClaims';
import { enforceSameOrigin } from '@/lib/api/csrf';
import {
  findSubscriptionForUser,
  pauseSubscription,
  type SubscriptionRow,
} from '@/lib/repositories/subscriptionRepo';
import type { Subscription, SubscriptionCycle } from '@/types/subscription';
import { formatDateKST } from '@/lib/utils';

function toSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    slug: row.product_slug,
    name: row.product_name,
    volume: row.product_volume,
    cycle: row.cycle as SubscriptionCycle,
    nextDate: formatDateKST(row.next_delivery_at),
    status: row.status,
  };
}

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx): Promise<Response> {
  const forbidden = enforceSameOrigin(request);
  if (forbidden) return forbidden;

  const claims = await getClaims();
  if (!claims) return apiError('unauthorized');

  const { id } = await ctx.params;

  const sub = await findSubscriptionForUser(id).catch(() => null);
  if (!sub) return apiError('not_found');
  if (sub.status !== 'active') {
    return apiError('conflict', { detail: 'not_active' });
  }

  try {
    const updated = await pauseSubscription(id);
    return apiSuccess(toSubscription(updated));
  } catch {
    return apiError('server_error');
  }
}
