'use server';

/* ══════════════════════════════════════════════════════════════════════════
   actions.ts — /admin/users Server Actions (S169 PR-3 Group C-3)

   책임:
   1) getAdminClaims 가드 — 비admin 차단
   2) Zod 검증 — RoleChangeInputSchema (targetId · reason?)
   3) self-action 차단 — actor === target → 'self_action' (RPC round-trip 절약)
   4) RPC `grant_admin` / `revoke_admin` 호출 — 020 마이그레이션
   5) revalidatePath('/admin/users' + '/[id]') — 목록·상세 캐시 무효화

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
 * 호출자는 이미 admin 가드·Zod 검증을 통과한 상태.
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
