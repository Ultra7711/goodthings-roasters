import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   subscriptionsServer.ts — /admin/subscriptions 서버 전용 fetcher (S188)

   역할:
   - status / q / page 필터로 구독 목록 fetch.
   - profiles JOIN 으로 사용자 이메일 / 이름 표시.
   - status 탭 카운트 (전체 / active / paused / cancelled / expired).

   분리 이유 (usersServer.ts 답습):
   - lib/admin/subscriptions.ts 는 클라이언트 컴포넌트가 매핑 헬퍼를 import.
   - createRouteHandlerClient 가 next/headers 의존 → server-only 격리 필수.

   참조:
   - 005_subscriptions.sql           (subscriptions 스키마)
   - 044_admin_subscriptions_rls.sql (subscriptions_select_admin)
   - 020_profiles_role_rbac.sql      (profiles_select_admin)
   - lib/admin/subscriptions.ts      (순수 헬퍼)
   - lib/admin/usersServer.ts        (답습 source)
   ══════════════════════════════════════════════════════════════════════════ */

import { createRouteHandlerClient } from '@/lib/supabaseServer';
import {
  PAGE_SIZE,
  parseSearchParams,
  sanitizeSearchQuery,
  type AdminSubscriptionsSearchParams,
  type DbSubscriptionPeriod,
  type DbSubscriptionStatus,
  type ListedSubscription,
  type StatusTabKey,
} from './subscriptions';

/**
 * Postgrest/일반 Error 모두 동일 형태로 요약. 200자 cap (민감정보 누출 회피).
 */
function summarizePgError(err: unknown): {
  code: string | null;
  message: string | null;
} {
  const e = (err ?? {}) as { code?: unknown; message?: unknown };
  return {
    code: typeof e.code === 'string' ? e.code : null,
    message: typeof e.message === 'string' ? e.message.slice(0, 200) : null,
  };
}

type SubscriptionRow = {
  id: string;
  user_id: string;
  product_slug: string;
  product_name: string;
  product_volume: string | null;
  cycle: DbSubscriptionPeriod;
  status: DbSubscriptionStatus;
  next_delivery_at: string;
  last_delivery_at: string | null;
  created_at: string;
};

type ProfileLookupRow = {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
};

export type AdminSubscriptionsResult = {
  rows: ListedSubscription[];
  total: number;
  counts: Record<StatusTabKey, number>;
  filters: AdminSubscriptionsSearchParams;
};

/**
 * /admin/subscriptions 데이터 fetch.
 *
 * 1) status 카운트 (active / paused / cancelled / expired head:true)
 * 2) subscriptions 메인 쿼리 (status / q 필터 + 페이지네이션)
 *    - q 검색은 product_name ilike. 사용자 검색은 별도 RPC 또는 후속 carry-over.
 * 3) profiles IN(userIds) 로 user 정보 매핑
 *
 * RLS:
 * - admin 세션이면 044 subscriptions_select_admin · 020 profiles_select_admin 통과.
 * - 비admin 세션이면 RLS 차단 → 빈 결과 반환.
 */
export async function fetchAdminSubscriptions(
  searchParamsRaw: Record<string, string | string[] | undefined>,
): Promise<AdminSubscriptionsResult> {
  const filters = parseSearchParams(searchParamsRaw);
  const supabase = await createRouteHandlerClient();

  /* 1) status 카운트 — 4개 status 별 head:true count */
  const [activeRes, pausedRes, cancelledRes, expiredRes] = await Promise.all([
    supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'paused'),
    supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'cancelled'),
    supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'expired'),
  ]);

  if (activeRes.error) console.error('[fetchAdminSubscriptions] active count failed', summarizePgError(activeRes.error));
  if (pausedRes.error) console.error('[fetchAdminSubscriptions] paused count failed', summarizePgError(pausedRes.error));
  if (cancelledRes.error) console.error('[fetchAdminSubscriptions] cancelled count failed', summarizePgError(cancelledRes.error));
  if (expiredRes.error) console.error('[fetchAdminSubscriptions] expired count failed', summarizePgError(expiredRes.error));

  const activeCount = activeRes.count ?? 0;
  const pausedCount = pausedRes.count ?? 0;
  const cancelledCount = cancelledRes.count ?? 0;
  const expiredCount = expiredRes.count ?? 0;
  const counts: AdminSubscriptionsResult['counts'] = {
    all: activeCount + pausedCount + cancelledCount + expiredCount,
    active: activeCount,
    paused: pausedCount,
    cancelled: cancelledCount,
    expired: expiredCount,
  };

  /* 2) 메인 쿼리 (status / q 필터 + 페이지네이션) */
  const offset = (filters.page - 1) * PAGE_SIZE;
  let query = supabase
    .from('subscriptions')
    .select(
      'id, user_id, product_slug, product_name, product_volume, cycle, status, next_delivery_at, last_delivery_at, created_at',
      { count: 'exact' },
    )
    .order('next_delivery_at', { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);

  if (filters.status !== 'all') query = query.eq('status', filters.status);

  const qSafe = sanitizeSearchQuery(filters.q);
  if (qSafe.length > 0) {
    query = query.ilike('product_name', `%${qSafe}%`);
  }

  const { data, count, error } = await query;
  if (error) {
    console.error('[fetchAdminSubscriptions] query failed', summarizePgError(error));
    return { rows: [], total: 0, counts, filters };
  }

  const subs = (data ?? []) as SubscriptionRow[];
  const userIds = Array.from(new Set(subs.map((s) => s.user_id)));

  /* 3) profiles IN(userIds) — user_id → email/name 매핑 */
  const profileMap = new Map<string, ProfileLookupRow>();
  if (userIds.length > 0) {
    const { data: profileRows, error: profileErr } = await supabase
      .from('profiles')
      .select('id, email, full_name, display_name')
      .in('id', userIds);
    if (profileErr) {
      console.error('[fetchAdminSubscriptions] profiles lookup failed', summarizePgError(profileErr));
    } else if (profileRows) {
      for (const p of profileRows as ProfileLookupRow[]) {
        profileMap.set(p.id, p);
      }
    }
  }

  const rows: ListedSubscription[] = subs.map((s) => {
    const p = profileMap.get(s.user_id);
    return {
      id: s.id,
      userId: s.user_id,
      userEmail: p?.email ?? '(unknown)',
      userDisplayName: p?.display_name ?? null,
      userFullName: p?.full_name ?? null,
      productSlug: s.product_slug,
      productName: s.product_name,
      productVolume: s.product_volume,
      cycle: s.cycle,
      status: s.status,
      nextDeliveryAtIso: s.next_delivery_at,
      lastDeliveryAtIso: s.last_delivery_at,
      createdAtIso: s.created_at,
    };
  });

  return { rows, total: count ?? 0, counts, filters };
}
