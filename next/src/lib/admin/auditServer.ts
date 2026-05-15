import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   auditServer.ts — /admin/audit 통합 타임라인 fetcher (S233-fu Step 3)

   역할:
   - admin_export_log (CSV 다운로드 이력) + admin_audit (권한 변경 이력) 통합 조회.
   - profiles JOIN 으로 actor / target email 표시.
   - 시간 역순 정렬 (최신 상단).

   RLS:
   - admin_export_log_select_owner — owner 만 SELECT (056 마이그)
   - admin_audit_select_admin — admin 모두 SELECT (020 마이그) · 단 본 페이지는 owner 가드 답습
   - profiles_select_admin — admin 가 actor/target 프로필 조회 (020 마이그)

   설계 결정:
   - 페이지네이션 미적용 (carry — N=100 fixed). 출시 직후 운영 빈도 낮음.
   - 도메인 필터 미적용 (carry — UI 추가는 사용자 피드백 후).
   - lib/admin/users.ts 의 describeRole / lib/admin/audit.ts (clientsafe) 분리.
   ══════════════════════════════════════════════════════════════════════════ */

import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { summarizePgError } from './errors';

/** 통합 타임라인 항목 — export + role 변경 동형 표시 */
export type AdminAuditEvent = {
  id: string;
  source: 'export' | 'role';
  action: AdminAuditAction;
  actorId: string;
  actorEmail: string | null;
  targetUserId: string | null;
  targetUserEmail: string | null;
  /** filters (export) 또는 reason (role) 등 source 별 다름 */
  details: Record<string, unknown>;
  createdAtIso: string;
};

export type AdminAuditAction =
  | 'csv_subscriptions'
  | 'csv_orders'
  | 'csv_users'
  | 'csv_products'
  | 'csv_audit'
  | 'grant_admin'
  | 'revoke_admin'
  | 'set_admin_level';

/** 표시 한도 — 1-3인 운영 가정. 향후 페이지네이션 carry. */
const FETCH_LIMIT = 100;

type ExportRow = {
  id: string;
  actor_id: string;
  domain: string;
  filters: Record<string, unknown> | null;
  row_count: number;
  truncated: boolean;
  created_at: string;
};

type RoleAuditRow = {
  id: string;
  actor_id: string | null;
  target_user_id: string;
  action: 'grant_admin' | 'revoke_admin' | 'set_admin_level';
  reason: string | null;
  created_at: string;
};

/**
 * 통합 타임라인 fetch — export + role 양쪽 최대 N개씩 → 합산 후 시간 역순 정렬 → N개 cap.
 * RLS 가드는 페이지 측 (requireAdminOwnerOrRedirect) 에 위임.
 */
export async function fetchAdminAuditEvents(): Promise<AdminAuditEvent[]> {
  const supabase = await createRouteHandlerClient();

  /* 1) export + role 병렬 fetch (각 N개 한도) */
  const [exportRes, roleRes] = await Promise.all([
    supabase
      .from('admin_export_log')
      .select('id, actor_id, domain, filters, row_count, truncated, created_at')
      .order('created_at', { ascending: false })
      .limit(FETCH_LIMIT),
    supabase
      .from('admin_audit')
      .select('id, actor_id, target_user_id, action, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(FETCH_LIMIT),
  ]);

  if (exportRes.error) {
    console.error('[fetchAdminAuditEvents] export fetch failed', summarizePgError(exportRes.error));
  }
  if (roleRes.error) {
    console.error('[fetchAdminAuditEvents] role fetch failed', summarizePgError(roleRes.error));
  }

  const exportRows = (exportRes.data ?? []) as ExportRow[];
  const roleRows = (roleRes.data ?? []) as RoleAuditRow[];

  /* 2) 관련 프로필 lookup (actor + target) */
  const profileIds = Array.from(
    new Set([
      ...exportRows.map((r) => r.actor_id),
      ...roleRows.map((r) => r.actor_id).filter((v): v is string => typeof v === 'string'),
      ...roleRows.map((r) => r.target_user_id),
    ]),
  );

  const emailMap = new Map<string, string>();
  if (profileIds.length > 0) {
    const { data: profileRows, error: profileErr } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', profileIds);
    if (profileErr) {
      console.error('[fetchAdminAuditEvents] profiles lookup failed', summarizePgError(profileErr));
    } else if (profileRows) {
      for (const p of profileRows as { id: string; email: string }[]) {
        emailMap.set(p.id, p.email);
      }
    }
  }

  /* 3) 동형 AdminAuditEvent 로 매핑 */
  const exportEvents: AdminAuditEvent[] = exportRows.map((r) => ({
    id: `export:${r.id}`,
    source: 'export',
    action: `csv_${r.domain}` as AdminAuditAction,
    actorId: r.actor_id,
    actorEmail: emailMap.get(r.actor_id) ?? null,
    targetUserId: null,
    targetUserEmail: null,
    details: {
      domain: r.domain,
      filters: r.filters ?? {},
      row_count: r.row_count,
      truncated: r.truncated,
    },
    createdAtIso: r.created_at,
  }));

  const roleEvents: AdminAuditEvent[] = roleRows.map((r) => ({
    id: `role:${r.id}`,
    source: 'role',
    action: r.action,
    actorId: r.actor_id ?? '',
    actorEmail: r.actor_id ? emailMap.get(r.actor_id) ?? null : null,
    targetUserId: r.target_user_id,
    targetUserEmail: emailMap.get(r.target_user_id) ?? null,
    details: { reason: r.reason },
    createdAtIso: r.created_at,
  }));

  /* 4) 시간 역순 정렬 + N개 cap */
  const merged = [...exportEvents, ...roleEvents]
    .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso))
    .slice(0, FETCH_LIMIT);

  return merged;
}
