import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   usersServer.ts — /admin/users 서버 전용 fetcher (S169 PR-1)

   분리 이유:
   - lib/admin/users.ts 는 클라이언트 컴포넌트(UsersTableClient) 가 매핑
     헬퍼(타입·상수·describeRole 등) 를 import 한다.
   - createRouteHandlerClient 가 next/headers 를 가져오므로 클라이언트 번들에
     섞이면 build 실패. server-only 경계로 격리.

   참조:
   - 020_profiles_role_rbac.sql (profiles_select_admin · role enum)
   - 030_admin_orders_rls.sql   (orders_select_admin)
   - lib/admin/users.ts         (순수 헬퍼)
   ══════════════════════════════════════════════════════════════════════════ */

import { createRouteHandlerClient } from '@/lib/supabaseServer';
import {
  PAGE_SIZE,
  parseSearchParams,
  sanitizeSearchQuery,
  type AdminUsersSearchParams,
  type DbUserRole,
  type ListedUser,
  type RoleTabKey,
} from './users';

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

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  role: DbUserRole;
  created_at: string;
};

export type AdminUsersResult = {
  rows: ListedUser[];
  total: number;
  counts: Record<RoleTabKey, number>;
  filters: AdminUsersSearchParams;
};

/**
 * /admin/users 데이터 fetch.
 *
 * 1) role 카운트 (admin / customer head:true count)
 * 2) profiles 메인 쿼리 (role / q 필터 + 페이지네이션)
 * 3) orders.user_id IN (...) 그룹 카운트 (현재 페이지 사용자만)
 *
 * RLS:
 * - admin 세션이면 020 profiles_select_admin · 030 orders_select_admin 통과.
 * - 비admin 세션이면 RLS 차단 → 빈 결과 반환.
 *
 * 성능 노트 (carry-over):
 * - 주문수는 PAGE_SIZE 행 (max 10) 만 IN 쿼리. 대규모 시 RPC 또는
 *   profiles 에 누적 컬럼 + 트리거로 전환 검토.
 */
export async function fetchAdminUsers(
  searchParamsRaw: Record<string, string | string[] | undefined>,
): Promise<AdminUsersResult> {
  const filters = parseSearchParams(searchParamsRaw);
  const supabase = await createRouteHandlerClient();

  /* 1) role 카운트 — admin / customer 각각 head:true count */
  const [adminCountRes, customerCountRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin'),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'customer'),
  ]);

  if (adminCountRes.error) {
    console.error('[fetchAdminUsers] admin count failed', summarizePgError(adminCountRes.error));
  }
  if (customerCountRes.error) {
    console.error('[fetchAdminUsers] customer count failed', summarizePgError(customerCountRes.error));
  }

  const adminCount = adminCountRes.count ?? 0;
  const customerCount = customerCountRes.count ?? 0;
  const counts: AdminUsersResult['counts'] = {
    all: adminCount + customerCount,
    admin: adminCount,
    customer: customerCount,
  };

  /* 2) 메인 쿼리 (role / q 필터 + 페이지네이션) */
  const offset = (filters.page - 1) * PAGE_SIZE;
  let query = supabase
    .from('profiles')
    .select('id, email, full_name, display_name, role, created_at', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (filters.role !== 'all') query = query.eq('role', filters.role);

  const qSafe = sanitizeSearchQuery(filters.q);
  if (qSafe.length > 0) {
    query = query.or(
      `email.ilike.%${qSafe}%,full_name.ilike.%${qSafe}%,display_name.ilike.%${qSafe}%`,
    );
  }

  const { data, count, error } = await query;
  if (error) {
    console.error('[fetchAdminUsers] query failed', summarizePgError(error));
    return { rows: [], total: 0, counts, filters };
  }

  const profiles = (data ?? []) as ProfileRow[];
  const userIds = profiles.map((p) => p.id);

  /* 3) 주문수 — IN(userIds) → 클라 그룹. 결과는 행별 매핑. */
  const orderCounts = new Map<string, number>();
  if (userIds.length > 0) {
    const { data: orderRows, error: orderErr } = await supabase
      .from('orders')
      .select('user_id')
      .in('user_id', userIds);
    if (orderErr) {
      console.error('[fetchAdminUsers] order count failed', summarizePgError(orderErr));
    } else if (orderRows) {
      for (const row of orderRows as { user_id: string | null }[]) {
        if (!row.user_id) continue;
        orderCounts.set(row.user_id, (orderCounts.get(row.user_id) ?? 0) + 1);
      }
    }
  }

  const rows: ListedUser[] = profiles.map((p) => ({
    id: p.id,
    email: p.email,
    fullName: p.full_name,
    displayName: p.display_name,
    role: p.role,
    createdAtIso: p.created_at,
    orderCount: orderCounts.get(p.id) ?? 0,
  }));

  return { rows, total: count ?? 0, counts, filters };
}
