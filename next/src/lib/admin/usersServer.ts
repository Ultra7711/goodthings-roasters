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
import { summarizePgError } from './errors';
import { type AdminListResult, applyRange, applyIlikeSearch } from './listHelpers';
import {
  PAGE_SIZE,
  parseSearchParams,
  sanitizeSearchQuery,
  type AdminAuditEntry,
  type AdminLevel,
  type AdminUsersSearchParams,
  type DbUserRole,
  type ListedUser,
  type ListedUserOrder,
  type RoleTabKey,
  type SignupProvider,
  type UserDetailProfile,
} from './users';

/** 상세 페이지 — 최근 주문 N개 */
const RECENT_ORDERS_LIMIT = 20;

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  role: DbUserRole;
  admin_level: AdminLevel | null;
  signup_provider: SignupProvider;
  created_at: string;
};

export type AdminUsersResult = AdminListResult<
  ListedUser,
  RoleTabKey,
  AdminUsersSearchParams
>;

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

  /* 2) 메인 쿼리 (role / provider / q 필터 + 페이지네이션) */
  let query = applyRange(
    supabase
      .from('profiles')
      .select(
        'id, email, full_name, display_name, role, admin_level, signup_provider, created_at',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false }),
    filters.page,
    PAGE_SIZE,
  );

  if (filters.role !== 'all') query = query.eq('role', filters.role);
  if (filters.provider !== 'all') query = query.eq('signup_provider', filters.provider);

  query = applyIlikeSearch(query, sanitizeSearchQuery(filters.q), [
    'email',
    'full_name',
    'display_name',
  ]);

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
    adminLevel: p.admin_level,
    signupProvider: p.signup_provider,
    createdAtIso: p.created_at,
    orderCount: orderCounts.get(p.id) ?? 0,
  }));

  return { rows, total: count ?? 0, counts, filters };
}

/* ── 상세 조회 ──────────────────────────────────────────────────────── */

type ProfileDetailRow = {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  phone: string | null;
  role: DbUserRole;
  admin_level: AdminLevel | null;
  created_at: string;
  updated_at: string;
};

type UserOrderRow = {
  id: string;
  order_number: string;
  created_at: string;
  status: ListedUserOrder['status'];
  total_amount: number;
};

type AuditRow = {
  id: string;
  actor_id: string | null;
  action: 'grant_admin' | 'revoke_admin' | 'set_admin_level';
  reason: string | null;
  created_at: string;
};

export type AdminUserDetail = {
  profile: UserDetailProfile;
  orders: ListedUserOrder[];
  audit: AdminAuditEntry[];
};

/**
 * /admin/users/[id] 상세 fetch.
 *
 * 1) profile (profiles_select_admin RLS)
 * 2) 최근 주문 N개 (orders_select_admin RLS, user_id = id)
 * 3) admin_audit — target_user_id = id 의 grant/revoke 이력
 * 4) audit.actor_id 프로필 lookup (이메일 표시용)
 *
 * profile not_found → null. 호출처가 notFound() 처리.
 *
 * RLS:
 * - admin_audit_select_admin (020) — admin SELECT 허용.
 * - profiles_select_admin (020) — admin 이 actor 프로필 lookup 가능.
 */
export async function fetchAdminUserDetail(
  id: string,
): Promise<AdminUserDetail | null> {
  const supabase = await createRouteHandlerClient();

  /* 1·2·3) 병렬 fetch */
  const [profileRes, ordersRes, auditRes] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'id, email, full_name, display_name, phone, role, admin_level, created_at, updated_at',
      )
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('orders')
      .select('id, order_number, created_at, status, total_amount')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(RECENT_ORDERS_LIMIT),
    supabase
      .from('admin_audit')
      .select('id, actor_id, action, reason, created_at')
      .eq('target_user_id', id)
      .order('created_at', { ascending: false }),
  ]);

  if (profileRes.error) {
    console.error(
      '[fetchAdminUserDetail] profile failed',
      summarizePgError(profileRes.error),
    );
  }
  if (ordersRes.error) {
    console.error(
      '[fetchAdminUserDetail] orders failed',
      summarizePgError(ordersRes.error),
    );
  }
  if (auditRes.error) {
    console.error(
      '[fetchAdminUserDetail] audit failed',
      summarizePgError(auditRes.error),
    );
  }

  const profileRow = profileRes.data as ProfileDetailRow | null;
  if (!profileRow) return null;

  const orderRows = (ordersRes.data ?? []) as UserOrderRow[];
  const auditRows = (auditRes.data ?? []) as AuditRow[];

  /* 4) actor email 매핑 — admin_audit.actor_id 의 profiles.email lookup. */
  const actorIds = Array.from(
    new Set(
      auditRows
        .map((r) => r.actor_id)
        .filter((v): v is string => typeof v === 'string'),
    ),
  );
  const actorEmails = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: actorRows, error: actorErr } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', actorIds);
    if (actorErr) {
      console.error(
        '[fetchAdminUserDetail] actor lookup failed',
        summarizePgError(actorErr),
      );
    } else if (actorRows) {
      for (const row of actorRows as { id: string; email: string }[]) {
        actorEmails.set(row.id, row.email);
      }
    }
  }

  const profile: UserDetailProfile = {
    id: profileRow.id,
    email: profileRow.email,
    fullName: profileRow.full_name,
    displayName: profileRow.display_name,
    phone: profileRow.phone,
    role: profileRow.role,
    adminLevel: profileRow.admin_level,
    createdAtIso: profileRow.created_at,
    updatedAtIso: profileRow.updated_at,
  };

  const orders: ListedUserOrder[] = orderRows.map((r) => ({
    id: r.id,
    orderNumber: r.order_number,
    createdAtIso: r.created_at,
    status: r.status,
    totalAmount: r.total_amount,
  }));

  const audit: AdminAuditEntry[] = auditRows.map((r) => ({
    id: r.id,
    actorId: r.actor_id,
    actorEmail: r.actor_id ? actorEmails.get(r.actor_id) ?? null : null,
    action: r.action,
    reason: r.reason,
    createdAtIso: r.created_at,
  }));

  return { profile, orders, audit };
}
