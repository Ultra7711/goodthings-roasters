'use server';

/* ══════════════════════════════════════════════════════════════════════════
   actions.ts — /admin/users Server Actions (S169 PR-3 Group C-3)

   책임:
   1) getAdminClaims 가드 — 비admin 차단
   2) Zod 검증 — RoleChangeInputSchema (targetId · reason?)
   3) self-action 차단 — actor === target → 'self_action' (RPC round-trip 절약)
   4) RPC `grant_admin` / `revoke_admin` 호출 — 020 마이그레이션
   5) revalidatePath('/admin/users' + '/[id]') — 목록 · 상세 캐시 무효화

   설계 (ADR-006 §적용 범위):
   - 호출처 = 어드민 UI 1곳만 → Server Action 단일 채널 (REST API 미생성).
   - cafe-events/actions.ts 패턴 답습.
   - RPC 자체에 admin 가드 + role 불변 트리거가 있어 이중 방어.

   RPC 에러 매핑:
   - 42501 + "self-(grant|revoke)" → 'self_action'
   - 42501 그 외 → 'unauthorized' (호출자 본인이 admin 이 아닌 경우)
   - 그 외 → 'server_error'

   참조:
   - supabase/migrations/020_profiles_role_rbac.sql
   - docs/adr/ADR-003-rbac-role-separation.md
   - docs/adr/ADR-006-admin-pages-api-separation.md
   ══════════════════════════════════════════════════════════════════════════ */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getAdminOwnerClaims } from '@/lib/auth/getClaims';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { fetchAdminUsersForExport } from '@/lib/admin/usersServer';
import {
  describeProvider,
  describeRole,
  formatJoinedDate,
  resolveUserName,
} from '@/lib/admin/users';
import {
  MAX_EXPORT_ROWS,
  buildExportFilename,
  logCsvExportAudit,
  nowKstDisplay,
} from '@/lib/admin/csvExport';
import { buildXlsxBuffer, bufferToBase64 } from '@/lib/admin/xlsxExport';

/* ── Schemas ──────────────────────────────────────────────────────────── */

const UuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'invalid_uuid',
  );

const RoleChangeInputSchema = z.object({
  targetId: UuidSchema,
  /* reason: 선택. 빈 문자열은 미입력으로 간주 (UI 에서 undefined 전달) */
  reason: z.string().trim().min(1).max(500).optional(),
});

export type RoleChangeInput = z.input<typeof RoleChangeInputSchema>;

export type UserRoleActionResult =
  | { ok: true; targetId: string }
  | {
      ok: false;
      error: 'unauthorized' | 'validation_failed' | 'self_action' | 'server_error';
      detail?: string;
    };

/* ── Helpers ──────────────────────────────────────────────────────────── */

function flattenZodError(err: z.ZodError): string {
  const fields = err.flatten().fieldErrors;
  return Object.entries(fields)
    .map(([k, v]) => `${k}:${(v as string[])[0] ?? 'invalid'}`)
    .join('; ')
    .slice(0, 200);
}

/**
 * grant_admin / revoke_admin RPC 호출 + 결과 매핑.
 *
 * 호출자는 이미 admin 가드 · Zod 검증을 통과한 상태.
 */
async function callRoleRpc(
  fn: 'grant_admin' | 'revoke_admin',
  input: { targetId: string; reason?: string },
  actorId: string,
): Promise<UserRoleActionResult> {
  /* UI 단 self-action 차단 — RPC 도 별도 차단하지만 round-trip 절약 */
  if (input.targetId === actorId) {
    return { ok: false, error: 'self_action' };
  }

  const supabase = await createRouteHandlerClient();
  const { error } = await supabase.rpc(fn, {
    target_id: input.targetId,
    reason: input.reason ?? null,
  });

  if (error) {
    /* 42501 = insufficient_privilege.
       RPC 내부에서 (a) 비admin actor (b) self-grant/revoke 모두 동일 code raise.
       message 로 보강 매핑. */
    if (error.code === '42501' && /self-(grant|revoke)/i.test(error.message ?? '')) {
      return { ok: false, error: 'self_action' };
    }
    if (error.code === '42501') {
      return { ok: false, error: 'unauthorized' };
    }
    console.error(`[${fn}Action] rpc failed`, {
      code: error.code,
      message: error.message?.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }

  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${input.targetId}`);
  return { ok: true, targetId: input.targetId };
}

/* ── Actions ──────────────────────────────────────────────────────────── */

export async function grantAdminAction(
  input: RoleChangeInput,
): Promise<UserRoleActionResult> {
  /* S232: owner 만 admin 승격/강등. RPC 측에서도 동일 가드. */
  const claims = await getAdminOwnerClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = RoleChangeInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'validation_failed',
      detail: flattenZodError(parsed.error),
    };
  }

  return callRoleRpc('grant_admin', parsed.data, claims.userId);
}

export async function revokeAdminAction(
  input: RoleChangeInput,
): Promise<UserRoleActionResult> {
  /* S232: owner 만 admin 승격/강등. RPC 측에서도 동일 가드. */
  const claims = await getAdminOwnerClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = RoleChangeInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'validation_failed',
      detail: flattenZodError(parsed.error),
    };
  }

  return callRoleRpc('revoke_admin', parsed.data, claims.userId);
}

/* ── set_admin_level (S232) ───────────────────────────────────────────
   admin 권한 단계 변경 (owner ↔ staff). owner 만 호출.
   마지막 owner self-강등은 RPC 측에서 차단.
   ──────────────────────────────────────────────────────────────────── */

const SetAdminLevelInputSchema = z.object({
  targetId: UuidSchema,
  newLevel: z.enum(['owner', 'staff']),
  reason: z.string().trim().min(1).max(500).optional(),
});

export type SetAdminLevelInput = z.input<typeof SetAdminLevelInputSchema>;

export type SetAdminLevelResult =
  | { ok: true; targetId: string }
  | {
      ok: false;
      error: 'unauthorized' | 'validation_failed' | 'last_owner' | 'not_admin' | 'not_found' | 'server_error';
      detail?: string;
    };

export async function setAdminLevelAction(
  input: SetAdminLevelInput,
): Promise<SetAdminLevelResult> {
  const claims = await getAdminOwnerClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = SetAdminLevelInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation_failed', detail: flattenZodError(parsed.error) };
  }

  const supabase = await createRouteHandlerClient();
  const { error } = await supabase.rpc('set_admin_level', {
    target_id: parsed.data.targetId,
    new_level: parsed.data.newLevel,
    reason: parsed.data.reason ?? null,
  });

  if (error) {
    /* RPC 측 raise — 메시지로 케이스 매핑 */
    if (error.code === '42501' && /last owner/i.test(error.message ?? '')) {
      return { ok: false, error: 'last_owner' };
    }
    if (error.code === '42501') {
      return { ok: false, error: 'unauthorized' };
    }
    if (error.code === '23514' || /not admin/i.test(error.message ?? '')) {
      return { ok: false, error: 'not_admin' };
    }
    if (error.code === 'P0002' || /not found/i.test(error.message ?? '')) {
      return { ok: false, error: 'not_found' };
    }
    console.error('[setAdminLevelAction] rpc failed', {
      code: error.code,
      message: error.message?.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }

  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${parsed.data.targetId}`);
  return { ok: true, targetId: parsed.data.targetId };
}

/* ── exportUsersCsvAction (S255-B · Users CSV export) ─────────────────
   orders / subscriptions 답습. owner 가드 + Zod + fetchAdminUsersForExport
   + buildCsv + audit log. UsersTableClient 의 handleExport 가 호출.
   ──────────────────────────────────────────────────────────────────── */

const ExportUsersInputSchema = z.object({
  role: z.enum(['all', 'admin', 'customer']).default('all'),
  provider: z.enum(['all', 'email', 'google', 'kakao', 'naver']).default('all'),
  q: z.string().default(''),
});

export type ExportUsersInput = z.input<typeof ExportUsersInputSchema>;

export type ExportUsersCsvResult =
  | {
      ok: true;
      filename: string;
      /** S255-C: xlsx Buffer base64 직렬화. client 가 디코딩 후 Blob 생성. */
      xlsxBase64: string;
      rowCount: number;
      truncated: boolean;
    }
  | { ok: false; error: 'unauthorized' | 'validation_failed' | 'server_error' };

export async function exportUsersCsvAction(
  input: ExportUsersInput,
): Promise<ExportUsersCsvResult> {
  /* owner (관리자) 만 CSV 내보내기. staff (운영자) 는 차단. */
  const claims = await getAdminOwnerClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = ExportUsersInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation_failed' };

  try {
    const { rows, truncated } = await fetchAdminUsersForExport(
      {
        role: parsed.data.role,
        provider: parsed.data.provider,
        q: parsed.data.q,
      },
      MAX_EXPORT_ROWS,
    );

    const headers = [
      '이메일',
      '이름',
      '역할',
      '가입 채널',
      '가입일',
      '주문수',
    ] as const;

    const dataRows = rows.map((u) => [
      u.email,
      resolveUserName(u),
      describeRole(u.role, u.adminLevel).label,
      describeProvider(u.signupProvider),
      formatJoinedDate(u.createdAtIso),
      u.orderCount,
    ]);

    const buffer = await buildXlsxBuffer(headers, dataRows, {
      domain: '고객',
      generatedAtKst: nowKstDisplay(),
    });
    const filename = buildExportFilename('users', 'xlsx');

    await logCsvExportAudit({
      domain: 'users',
      actorId: claims.userId,
      filters: parsed.data,
      rowCount: rows.length,
      truncated,
    });

    return {
      ok: true,
      filename,
      xlsxBase64: bufferToBase64(buffer),
      rowCount: rows.length,
      truncated,
    };
  } catch (err: unknown) {
    console.error('[exportUsersCsvAction] failed', {
      message: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
    });
    return { ok: false, error: 'server_error' };
  }
}

/* ── forceDeleteAccountAction (S258 P4 · 운영자 직권 탈퇴) ────────────────
   - owner 전용 가드 (staff 차단)
   - reason 필수 (PIPA §39-7 시정조치 정당성 기록)
   - self 차단 (본인 본인 탈퇴 금지 — admin 0명 회피)
   - target 이 admin 이면 차단 (admin 끼리 강제 탈퇴 금지)
   - delete_account RPC (015) — 활성 구독 차단 + orders 익명화
   - admin_audit insert force_delete_account + target_email_snapshot (070)
   - auth.admin.deleteUser — profiles/addresses CASCADE
   ──────────────────────────────────────────────────────────────────── */

const ForceDeleteAccountInputSchema = z.object({
  targetId: UuidSchema,
  /** 사유 필수 (운영자 강제 탈퇴는 PIPA §39-7 시정조치 정당성 기록 의무). */
  reason: z.string().trim().min(1).max(500),
});

export type ForceDeleteAccountInput = z.input<typeof ForceDeleteAccountInputSchema>;

export type ForceDeleteAccountResult =
  | {
      ok: true;
      targetId: string;
      ordersAnonymized: number;
      subscriptionsDeleted: number;
    }
  | {
      ok: false;
      error:
        | 'unauthorized'
        | 'validation_failed'
        | 'self_action'
        | 'not_found'
        | 'target_is_admin'
        | 'subscription_active'
        | 'server_error';
      detail?: string;
    };

export async function forceDeleteAccountAction(
  input: ForceDeleteAccountInput,
): Promise<ForceDeleteAccountResult> {
  /* owner 전용 — staff 차단 */
  const claims = await getAdminOwnerClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = ForceDeleteAccountInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation_failed', detail: flattenZodError(parsed.error) };
  }

  /* self 차단 — 본인 본인 탈퇴 시 admin 0명 위험 */
  if (parsed.data.targetId === claims.userId) {
    return { ok: false, error: 'self_action' };
  }

  const admin = getSupabaseAdmin();

  /* target 조회 — email (audit snapshot 용) + role (admin 차단 가드) */
  const { data: target, error: targetErr } = await admin
    .from('profiles')
    .select('id, email, role')
    .eq('id', parsed.data.targetId)
    .maybeSingle();

  if (targetErr) {
    console.error('[forceDeleteAccountAction] target lookup failed', {
      code: targetErr.code,
      message: targetErr.message?.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }
  if (!target) return { ok: false, error: 'not_found' };

  /* admin 끼리 강제 탈퇴 금지 — 권한 분쟁 회피 (admin 강등 후 다시 탈퇴는 가능) */
  if (target.role === 'admin') {
    return { ok: false, error: 'target_is_admin' };
  }

  const targetEmailSnapshot = (target.email as string | null) ?? null;

  /* delete_account RPC (015) — 활성 구독 차단 + orders 익명화 + cancelled/expired subs DELETE */
  const { data: rpcData, error: rpcError } = await admin.rpc('delete_account', {
    p_user_id: parsed.data.targetId,
  });

  if (rpcError) {
    const msg = rpcError.message ?? '';
    if (msg.includes('subscription_active')) {
      return { ok: false, error: 'subscription_active' };
    }
    console.error('[forceDeleteAccountAction] rpc failed', {
      code: rpcError.code,
      message: msg.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }

  /* admin_audit insert — auth.users 삭제 전에 수행 (target_user_id 보존). */
  const { error: auditErr } = await admin
    .from('admin_audit')
    .insert({
      actor_id: claims.userId,
      target_user_id: parsed.data.targetId,
      action: 'force_delete_account',
      reason: parsed.data.reason,
      target_email_snapshot: targetEmailSnapshot,
    });

  if (auditErr) {
    /* audit insert 실패는 치명. force delete 는 책임 추적 필수 — 작업 중단. */
    console.error('[forceDeleteAccountAction] admin_audit insert failed', {
      code: auditErr.code,
      message: auditErr.message?.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }

  /* auth.users 삭제 — profiles/addresses CASCADE */
  const { error: deleteAuthErr } = await admin.auth.admin.deleteUser(parsed.data.targetId);

  if (deleteAuthErr) {
    /* orphan: orders 익명화 완료 + audit 기록 완료, auth.users 만 잔존.
       안전 방향 (PII 이미 파기) — 운영자 수동 복구 가능. */
    console.error('[forceDeleteAccountAction] auth.deleteUser failed — ORPHAN', {
      userId: parsed.data.targetId,
      code: deleteAuthErr.status,
    });
    return { ok: false, error: 'server_error' };
  }

  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${parsed.data.targetId}`);
  revalidatePath('/admin/audit');

  const rpcResult = (rpcData ?? {}) as {
    orders_anonymized?: number;
    subscriptions_deleted?: number;
  };

  return {
    ok: true,
    targetId: parsed.data.targetId,
    ordersAnonymized: rpcResult.orders_anonymized ?? 0,
    subscriptionsDeleted: rpcResult.subscriptions_deleted ?? 0,
  };
}
