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
  type SubscriptionRow,
} from '@/lib/repositories/subscriptionRepo';
import type { Subscription, SubscriptionCycle } from '@/types/subscription';
import { formatDateKST } from '@/lib/utils';

const CYCLE_DAYS: Record<string, number> = {
  '2주': 14, '4주': 28, '6주': 42, '8주': 56,
};

const PatchSchema = z.object({
  cycle: z.enum(['2주', '4주', '6주', '8주']),
});

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

export async function PATCH(request: Request, ctx: Ctx): Promise<Response> {
  const forbidden = enforceSameOrigin(request);
  if (forbidden) return forbidden;

  const claims = await getClaims();
  if (!claims) return apiError('unauthorized');

  const { id } = await ctx.params;

  const parsed = await parseBody(request, PatchSchema);
  if (!parsed.success) return parsed.response;

  /* 구독 존재·소유 확인 (RLS 가 타인 행 차단) */
  const sub = await findSubscriptionForUser(id).catch(() => null);
  if (!sub) return apiError('not_found');
  if (sub.status !== 'active' && sub.status !== 'paused') {
    return apiError('conflict', { detail: 'subscription_not_active' });
  }

  /* 다음 배송일 재계산: 현재 next_delivery_at 기준 + 새 주기 */
  const newCycle = parsed.data.cycle;
  const days = CYCLE_DAYS[newCycle] ?? 28;
  const base = new Date(sub.next_delivery_at);
  const nextDeliveryAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

  try {
    const updated = await updateSubscriptionCycle(id, newCycle, nextDeliveryAt);
    return apiSuccess(toSubscription(updated));
  } catch {
    return apiError('server_error');
  }
}

export async function DELETE(request: Request, ctx: Ctx): Promise<Response> {
  const forbidden = enforceSameOrigin(request);
  if (forbidden) return forbidden;

  const claims = await getClaims();
  if (!claims) return apiError('unauthorized');

  const { id } = await ctx.params;

  const sub = await findSubscriptionForUser(id).catch(() => null);
  if (!sub) return apiError('not_found');
  if (sub.status === 'cancelled' || sub.status === 'expired') {
    return apiError('conflict', { detail: 'already_cancelled' });
  }

  try {
    const updated = await cancelSubscription(id);
    return apiSuccess(toSubscription(updated));
  } catch {
    return apiError('server_error');
  }
}
