/* GET /api/subscriptions — 회원 본인 구독 목록 */

import { apiError, apiSuccess } from '@/lib/api/errors';
import { getClaims } from '@/lib/auth/getClaims';
import { enforceSameOrigin } from '@/lib/api/csrf';
import { findSubscriptionsForUser, type SubscriptionRow } from '@/lib/repositories/subscriptionRepo';
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

export async function GET(request: Request): Promise<Response> {
  const forbidden = enforceSameOrigin(request);
  if (forbidden) return forbidden;

  const claims = await getClaims();
  if (!claims) return apiError('unauthorized');

  try {
    const rows = await findSubscriptionsForUser();
    return apiSuccess(rows.map(toSubscription));
  } catch {
    return apiError('server_error');
  }
}
