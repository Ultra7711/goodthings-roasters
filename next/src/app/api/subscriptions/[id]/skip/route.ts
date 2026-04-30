/* POST /api/subscriptions/[id]/skip — 1회 배송 건너뛰기 */

import { apiError, apiSuccess } from '@/lib/api/errors';
import { getClaims } from '@/lib/auth/getClaims';
import { enforceSameOrigin } from '@/lib/api/csrf';
import {
  findSubscriptionForUser,
  skipSubscriptionDelivery,
  type SubscriptionRow,
} from '@/lib/repositories/subscriptionRepo';
import type { Subscription, SubscriptionCycle } from '@/types/subscription';
import { formatDateKST } from '@/lib/utils';

const CYCLE_DAYS: Record<string, number> = {
  '2주': 14, '4주': 28, '6주': 42, '8주': 56,
};

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
    return apiError('conflict', { detail: 'subscription_not_active' });
  }

  const days = CYCLE_DAYS[sub.cycle] ?? 28;
  const base = new Date(sub.next_delivery_at);
  const nextDeliveryAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  const newSkipCount = sub.skip_count + 1;

  try {
    const updated = await skipSubscriptionDelivery(id, nextDeliveryAt, newSkipCount);
    return apiSuccess(toSubscription(updated));
  } catch {
    return apiError('server_error');
  }
}
