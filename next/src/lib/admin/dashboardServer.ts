import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   dashboardServer.ts — /admin 대시보드 서버 전용 fetcher (S130 Group I-1)

   분리 이유:
   - lib/admin/dashboard.ts 는 클라이언트 컴포넌트가 mapping helper 를 import
     할 가능성 (현재는 server-only 사용이지만 표시 헬퍼 재사용 여지 보호).
   - createRouteHandlerClient 가 next/headers 를 가져오므로 client 번들 격리.

   참조:
   - 033_admin_dashboard_analytics.sql (admin_dashboard_overview RPC)
   - lib/admin/dashboard.ts (순수 헬퍼 + 매핑)
   ══════════════════════════════════════════════════════════════════════════ */

import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { getClaims } from '@/lib/auth/getClaims';
import {
  emptyOverview,
  mapOverview,
  type DashboardOverview,
  type DashboardOverviewRpc,
} from './dashboard';

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
 * /admin 대시보드 데이터 fetch.
 *
 * - admin_dashboard_overview RPC (1 round-trip) 호출.
 * - admin 가드 실패 (insufficient_privilege) 또는 schema/네트워크 오류 시
 *   emptyOverview() 로 fallback (UI 깨짐 방지).
 *
 * 비인증 가드: layout 가드와 page fetch 가 병렬 렌더되므로, 비로그인/세션만료
 * 상태에서 anon role 로 RPC 가 발사되어 42501(permission denied) 로그 노이즈가
 * 발생한다. getClaims() (요청 캐시 히트·비용 0) 로 세션 유무를 먼저 확인하여
 * anon RPC 자체를 차단한다. getAdminClaims() 의 user-null skip 패턴과 정합.
 */
export async function fetchAdminDashboard(): Promise<DashboardOverview> {
  const claims = await getClaims();
  if (!claims) return emptyOverview();

  const supabase = await createRouteHandlerClient();
  const { data, error } = await supabase.rpc('admin_dashboard_overview');

  if (error) {
    console.error('[fetchAdminDashboard] rpc failed', summarizeError(error));
    return emptyOverview();
  }

  if (!data || typeof data !== 'object') {
    console.error('[fetchAdminDashboard] unexpected payload', { type: typeof data });
    return emptyOverview();
  }

  return mapOverview(data as DashboardOverviewRpc);
}
