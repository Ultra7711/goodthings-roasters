import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   analyticsServer.ts — /admin/analytics 서버 전용 fetcher (S130 Group I-2)

   분리 이유:
   - lib/admin/analytics.ts 가 표시 헬퍼·readiness 계산을 export → 클라이언트
     번들 공유 가능.
   - createRouteHandlerClient 는 next/headers 의존 → server-only 격리.

   참조:
   - 033_admin_dashboard_analytics.sql (admin_sales_aggregate RPC)
   - lib/admin/analytics.ts (순수 헬퍼)
   ══════════════════════════════════════════════════════════════════════════ */

import { createRouteHandlerClient } from '@/lib/supabaseServer';
import {
  emptyAnalyticsView,
  mapAnalytics,
  parseAnalyticsSearchParams,
  periodToRange,
  type AnalyticsView,
  type SalesAggregateRpc,
} from './analytics';

function summarizeError(err: unknown): {
  code: string | null;
  message: string | null;
} {
  const e = (err ?? {}) as { code?: unknown; message?: unknown };
  return {
    code: typeof e.code === 'string' ? e.code : null,
    message: typeof e.message === 'string' ? e.message.slice(0, 200) : null,
  };
}

/**
 * /admin/analytics 매출 통계 fetch.
 *
 * 1) searchParams.period 파싱 → ISO 범위 변환.
 * 2) admin_sales_aggregate RPC 호출 (1 round-trip).
 * 3) 매핑 → AnalyticsView (readiness + stats + products).
 *
 * 실패 시 emptyAnalyticsView 로 fallback (UI 가 readiness.ready=false 분기).
 */
export async function fetchAdminAnalytics(
  searchParamsRaw: Record<string, string | string[] | undefined>,
): Promise<AnalyticsView> {
  const filters = parseAnalyticsSearchParams(searchParamsRaw);
  const range = periodToRange(filters.period);

  const supabase = await createRouteHandlerClient();
  const { data, error } = await supabase.rpc('admin_sales_aggregate', {
    p_period_start: range.startIso,
    p_period_end: range.endIso,
  });

  if (error) {
    console.error('[fetchAdminAnalytics] rpc failed', summarizeError(error));
    return emptyAnalyticsView(filters.period);
  }

  if (!data || typeof data !== 'object') {
    console.error('[fetchAdminAnalytics] unexpected payload', { type: typeof data });
    return emptyAnalyticsView(filters.period);
  }

  return mapAnalytics(data as SalesAggregateRpc, filters.period);
}
