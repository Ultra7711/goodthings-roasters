'use server';

/* ══════════════════════════════════════════════════════════════════════════
   actions.ts — /admin/subscriptions Server Actions (S188 minimal → S189 Group D)

   책임 (operating safety net):
   1) getAdminClaims 가드 — 비admin 차단
   2) Zod 검증 — 각 액션별 스키마
   3) 044 RLS subscriptions_update_admin 통한 직접 UPDATE
      - 각 액션이 명시적 컬럼만 update (다른 컬럼 보호는 actions.ts 책임)
   4) revalidatePath('/admin/subscriptions') — 목록 캐시 무효화

   액션 목록 (Group D 풀 구축):
   - updateSubscriptionNextDeliveryAction  — 다음 배송일 변경 (S188)
   - updateSubscriptionCycleAction         — 주기 변경 + next_delivery_at 재계산
   - updateSubscriptionStatusAction        — pause / resume / cancel

   설계 (ADR-006 §적용 범위):
   - 호출처 = 어드민 UI 1곳만 → Server Action 단일 채널 (REST API 미생성).
   - users/actions.ts 패턴 답습.

   참조:
   - supabase/migrations/044_admin_subscriptions_rls.sql
   - docs/adr/ADR-006-admin-pages-api-separation.md
   - lib/subscription/cycles.ts (recalculateNextDeliveryOnCycleChange SoT)
   ══════════════════════════════════════════════════════════════════════════ */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getAdminClaims, getAdminOwnerClaims } from '@/lib/auth/getClaims';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import {
  dateInputToIso,
  describeCycle,
  describeStatus,
  formatDeliveryDate,
  resolveUserName,
} from '@/lib/admin/subscriptions';
import { fetchAdminSubscriptionsForExport } from '@/lib/admin/subscriptionsServer';
import {
  MAX_EXPORT_ROWS,
  buildCsv,
  buildExportFilename,
  formatKstDateCell,
  logCsvExportAudit,
  nowKstDisplay,
} from '@/lib/admin/csvExport';
import {
  SUBSCRIPTION_CYCLES,
  CYCLE_DAYS,
  recalculateNextDeliveryOnCycleChange,
  type SubscriptionCycle,
} from '@/lib/subscription/cycles';

/* ── Audit Log 타입 ──────────────────────────────────────────────────── */

export type AuditLogAction = 'update_next_delivery' | 'update_cycle' | 'update_status';

export type AuditLogEntry = {
  id: string;
  action: AuditLogAction;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  createdAt: string;
};

export type FetchAuditLogResult =
  | { ok: true; entries: AuditLogEntry[] }
  | { ok: false; error: 'unauthorized' | 'server_error' };

/* ── Schemas ──────────────────────────────────────────────────────────── */

const UuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'invalid_uuid',
  );

/** "YYYY-MM-DD" — input[type=date] value 형태 */
const DateInputSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid_date_format');

const UpdateNextDeliveryInputSchema = z.object({
  subscriptionId: UuidSchema,
  /** "YYYY-MM-DD" — KST 기준 날짜 입력. dateInputToIso 가 KST 00:00 → UTC 변환. */
  nextDeliveryAt: DateInputSchema,
});

export type UpdateNextDeliveryInput = z.input<typeof UpdateNextDeliveryInputSchema>;

export type UpdateNextDeliveryResult =
  | { ok: true; subscriptionId: string; nextDeliveryAtIso: string }
  | {
      ok: false;
      error: 'unauthorized' | 'validation_failed' | 'not_found' | 'server_error';
      detail?: string;
    };

const UpdateCycleInputSchema = z.object({
  subscriptionId: UuidSchema,
  newCycle: z.enum(SUBSCRIPTION_CYCLES),
});

export type UpdateCycleInput = z.input<typeof UpdateCycleInputSchema>;

export type UpdateCycleResult =
  | { ok: true; subscriptionId: string; cycle: string; nextDeliveryAtIso: string }
  | {
      ok: false;
      error: 'unauthorized' | 'validation_failed' | 'not_found' | 'conflict' | 'server_error';
      detail?: string;
    };

const UpdateStatusInputSchema = z.object({
  subscriptionId: UuidSchema,
  action: z.enum(['pause', 'resume', 'cancel']),
  cancelReason: z.string().max(200).optional(),
});

export type UpdateStatusInput = z.input<typeof UpdateStatusInputSchema>;

export type UpdateStatusResult =
  | { ok: true; subscriptionId: string; status: string }
  | {
      ok: false;
      error: 'unauthorized' | 'validation_failed' | 'not_found' | 'conflict' | 'server_error';
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

/* ── Audit Log 헬퍼 ──────────────────────────────────────────────────── */

type SupabaseClient = Awaited<ReturnType<typeof createRouteHandlerClient>>;

/** 구독 변경 이력 삽입 — best-effort (실패 시 로깅만, 주 액션은 중단하지 않음). */
async function insertAuditLog(
  supabase: SupabaseClient,
  params: {
    subscriptionId: string;
    adminUserId: string;
    action: AuditLogAction;
    oldValue: Record<string, unknown>;
    newValue: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase.from('subscription_audit_log').insert({
    subscription_id: params.subscriptionId,
    admin_user_id: params.adminUserId,
    action: params.action,
    old_value: params.oldValue,
    new_value: params.newValue,
  });
  if (error) {
    console.error('[insertAuditLog] failed', {
      code: error.code,
      message: error.message?.slice(0, 200),
    });
  }
}

/* ── Actions ──────────────────────────────────────────────────────────── */

/**
 * 구독의 next_delivery_at 을 변경한다.
 *
 * 운영 안전 망 — cycle 계산 BUG 같은 사고 시 SQL 직접 수정 대신 GUI 복구.
 *
 * - 044 RLS subscriptions_update_admin 통과 후 UPDATE.
 * - 다른 컬럼은 명시적으로 update payload 에 포함하지 않음 (정책 정합성).
 * - audit_log 패턴은 carry-over (full Group D 풀 구축 시).
 */
export async function updateSubscriptionNextDeliveryAction(
  input: UpdateNextDeliveryInput,
): Promise<UpdateNextDeliveryResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = UpdateNextDeliveryInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'validation_failed',
      detail: flattenZodError(parsed.error),
    };
  }

  let isoNext: string;
  try {
    isoNext = dateInputToIso(parsed.data.nextDeliveryAt);
  } catch {
    return { ok: false, error: 'validation_failed', detail: 'date_parse_failed' };
  }

  const supabase = await createRouteHandlerClient();

  /* audit 용 old value 조회 */
  const { data: current, error: fetchErr } = await supabase
    .from('subscriptions')
    .select('id, next_delivery_at')
    .eq('id', parsed.data.subscriptionId)
    .maybeSingle();

  if (fetchErr) {
    console.error('[updateSubscriptionNextDeliveryAction] fetch failed', {
      code: fetchErr.code,
      message: fetchErr.message?.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }
  if (!current) return { ok: false, error: 'not_found' };

  const oldNextDelivery = current.next_delivery_at as string;

  const { data, error } = await supabase
    .from('subscriptions')
    .update({ next_delivery_at: isoNext })
    .eq('id', parsed.data.subscriptionId)
    .select('id, next_delivery_at')
    .maybeSingle();

  if (error) {
    /* 42501 = insufficient_privilege (RLS 차단) — admin 가드 통과 후라면 거의 불가능. */
    if (error.code === '42501') {
      return { ok: false, error: 'unauthorized' };
    }
    console.error('[updateSubscriptionNextDeliveryAction] update failed', {
      code: error.code,
      message: error.message?.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }

  if (!data) {
    return { ok: false, error: 'not_found' };
  }

  await insertAuditLog(supabase, {
    subscriptionId: data.id,
    adminUserId: claims.userId,
    action: 'update_next_delivery',
    oldValue: { next_delivery_at: oldNextDelivery },
    newValue: { next_delivery_at: data.next_delivery_at as string },
  });

  revalidatePath('/admin/subscriptions');
  return {
    ok: true,
    subscriptionId: data.id,
    nextDeliveryAtIso: data.next_delivery_at as string,
  };
}

/**
 * 구독 주기를 변경하고 다음 배송일을 재계산한다.
 *
 * - 044 RLS subscriptions_update_admin 통과 후 UPDATE.
 * - recalculateNextDeliveryOnCycleChange (cycles.ts SoT) 와 동일 계산 — 직전 배송일 + newCycle.
 * - active / paused 상태 모두 허용 (사용자 API PATCH 패턴 답습).
 */
export async function updateSubscriptionCycleAction(
  input: UpdateCycleInput,
): Promise<UpdateCycleResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = UpdateCycleInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation_failed', detail: flattenZodError(parsed.error) };
  }

  const supabase = await createRouteHandlerClient();

  /* 현재 cycle · next_delivery_at 조회 — 재계산에 필요 */
  const { data: current, error: fetchErr } = await supabase
    .from('subscriptions')
    .select('id, cycle, next_delivery_at, status')
    .eq('id', parsed.data.subscriptionId)
    .maybeSingle();

  if (fetchErr) {
    console.error('[updateSubscriptionCycleAction] fetch failed', {
      code: fetchErr.code,
      message: fetchErr.message?.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }
  if (!current) return { ok: false, error: 'not_found' };

  const currentStatus = current.status as string;
  if (currentStatus === 'cancelled' || currentStatus === 'expired') {
    return { ok: false, error: 'conflict', detail: 'subscription_ended' };
  }

  const oldCycle = current.cycle as SubscriptionCycle;
  const newCycle = parsed.data.newCycle;

  const recalculated = recalculateNextDeliveryOnCycleChange(
    new Date(current.next_delivery_at as string),
    oldCycle,
    newCycle,
  );

  const { data, error } = await supabase
    .from('subscriptions')
    .update({ cycle: newCycle, next_delivery_at: recalculated.toISOString() })
    .eq('id', parsed.data.subscriptionId)
    .select('id, cycle, next_delivery_at')
    .maybeSingle();

  if (error) {
    if (error.code === '42501') return { ok: false, error: 'unauthorized' };
    console.error('[updateSubscriptionCycleAction] update failed', {
      code: error.code,
      message: error.message?.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }
  if (!data) return { ok: false, error: 'not_found' };

  await insertAuditLog(supabase, {
    subscriptionId: data.id as string,
    adminUserId: claims.userId,
    action: 'update_cycle',
    oldValue: { cycle: oldCycle, next_delivery_at: current.next_delivery_at as string },
    newValue: { cycle: newCycle, next_delivery_at: data.next_delivery_at as string },
  });

  revalidatePath('/admin/subscriptions');
  return {
    ok: true,
    subscriptionId: data.id as string,
    cycle: data.cycle as string,
    nextDeliveryAtIso: data.next_delivery_at as string,
  };
}

/**
 * 구독 상태를 변경한다 (pause / resume / cancel).
 *
 * - pause  : status='paused',    paused_at=NOW()
 * - resume : status='active',    paused_at=NULL,  next_delivery_at=NOW()+cycle_days
 * - cancel : status='cancelled', cancelled_at=NOW(), cancel_reason (선택)
 *
 * DB 제약:
 * - subscriptions_paused_consistency   : paused ↔ paused_at NOT NULL
 * - subscriptions_cancelled_consistency: cancelled ↔ cancelled_at NOT NULL
 */
export async function updateSubscriptionStatusAction(
  input: UpdateStatusInput,
): Promise<UpdateStatusResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = UpdateStatusInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation_failed', detail: flattenZodError(parsed.error) };
  }

  const supabase = await createRouteHandlerClient();

  const { data: current, error: fetchErr } = await supabase
    .from('subscriptions')
    .select('id, cycle, status')
    .eq('id', parsed.data.subscriptionId)
    .maybeSingle();

  if (fetchErr) {
    console.error('[updateSubscriptionStatusAction] fetch failed', {
      code: fetchErr.code,
      message: fetchErr.message?.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }
  if (!current) return { ok: false, error: 'not_found' };

  const currentStatus = current.status as string;
  const action = parsed.data.action;

  /* 상태 전환 가드 */
  if (action === 'pause' && currentStatus !== 'active') {
    return { ok: false, error: 'conflict', detail: 'not_active' };
  }
  if (action === 'resume' && currentStatus !== 'paused') {
    return { ok: false, error: 'conflict', detail: 'not_paused' };
  }
  if (action === 'cancel' && (currentStatus === 'cancelled' || currentStatus === 'expired')) {
    return { ok: false, error: 'conflict', detail: 'already_ended' };
  }

  const now = new Date().toISOString();

  type UpdatePayload = {
    status: string;
    paused_at?: string | null;
    cancelled_at?: string | null;
    cancel_reason?: string | null;
    next_delivery_at?: string;
  };

  let payload: UpdatePayload;
  if (action === 'pause') {
    payload = { status: 'paused', paused_at: now };
  } else if (action === 'resume') {
    /* resume: next_delivery_at = now + cycle_days */
    const cycle = current.cycle as SubscriptionCycle;
    const nextDelivery = new Date();
    nextDelivery.setDate(nextDelivery.getDate() + CYCLE_DAYS[cycle]);
    payload = { status: 'active', paused_at: null, next_delivery_at: nextDelivery.toISOString() };
  } else {
    /* cancel */
    payload = {
      status: 'cancelled',
      cancelled_at: now,
      cancel_reason: parsed.data.cancelReason ?? null,
    };
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .update(payload)
    .eq('id', parsed.data.subscriptionId)
    .select('id, status')
    .maybeSingle();

  if (error) {
    if (error.code === '42501') return { ok: false, error: 'unauthorized' };
    console.error('[updateSubscriptionStatusAction] update failed', {
      code: error.code,
      message: error.message?.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }
  if (!data) return { ok: false, error: 'not_found' };

  const newValue: Record<string, unknown> = { status: data.status as string };
  if (action === 'cancel' && parsed.data.cancelReason) {
    newValue.cancel_reason = parsed.data.cancelReason;
  }
  await insertAuditLog(supabase, {
    subscriptionId: data.id as string,
    adminUserId: claims.userId,
    action: 'update_status',
    oldValue: { status: currentStatus },
    newValue,
  });

  revalidatePath('/admin/subscriptions');
  return { ok: true, subscriptionId: data.id as string, status: data.status as string };
}

/**
 * 특정 구독의 변경 이력을 최신순으로 최대 10건 조회한다.
 * 045 마이그 후 유효. 테이블 없으면 server_error 반환.
 */
export async function fetchSubscriptionAuditLogAction(
  subscriptionId: string,
): Promise<FetchAuditLogResult> {
  const claims = await getAdminClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const validId = UuidSchema.safeParse(subscriptionId);
  if (!validId.success) return { ok: false, error: 'unauthorized' };

  const supabase = await createRouteHandlerClient();
  const { data, error } = await supabase
    .from('subscription_audit_log')
    .select('id, action, old_value, new_value, created_at')
    .eq('subscription_id', validId.data)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('[fetchSubscriptionAuditLogAction] failed', {
      code: error.code,
      message: error.message?.slice(0, 200),
    });
    return { ok: false, error: 'server_error' };
  }

  const entries: AuditLogEntry[] = (data ?? []).map((row) => ({
    id: row.id as string,
    action: row.action as AuditLogAction,
    oldValue: (row.old_value as Record<string, unknown>) ?? null,
    newValue: (row.new_value as Record<string, unknown>) ?? null,
    createdAt: row.created_at as string,
  }));

  return { ok: true, entries };
}

/* ── Export CSV (S232) ────────────────────────────────────────────── */

/**
 * 현재 필터에 일치하는 구독 목록을 CSV 로 내보낸다.
 *
 * - admin 가드
 * - PAGE_SIZE 무시 + MAX_EXPORT_ROWS (10,000) 한도
 * - PII 평문 (DEC-export-4): 운영 목적 (회계 / CS / 배송)
 * - actor / 필터 / 행 수 audit (console 구조화 · Vercel log 보존)
 *
 * 반환: csv 본문 + 파일명 + truncated 신호.
 *       client 에서 Blob 다운로드 + truncated 시 안내 toast.
 */
const ExportSubscriptionsInputSchema = z.object({
  status: z.enum(['all', 'active', 'paused', 'cancelled', 'expired']).default('all'),
  q: z.string().default(''),
});

export type ExportSubscriptionsInput = z.input<typeof ExportSubscriptionsInputSchema>;

export type ExportCsvResult =
  | { ok: true; filename: string; csv: string; rowCount: number; truncated: boolean }
  | { ok: false; error: 'unauthorized' | 'validation_failed' | 'server_error' };

export async function exportSubscriptionsCsvAction(
  input: ExportSubscriptionsInput,
): Promise<ExportCsvResult> {
  /* S232: owner (관리자) 만 CSV 내보내기. staff (운영자) 는 차단. */
  const claims = await getAdminOwnerClaims();
  if (!claims) return { ok: false, error: 'unauthorized' };

  const parsed = ExportSubscriptionsInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation_failed' };

  try {
    const { rows, truncated } = await fetchAdminSubscriptionsForExport(
      { status: parsed.data.status, q: parsed.data.q },
      MAX_EXPORT_ROWS,
    );

    const headers = [
      '구독 ID',
      '고객명',
      '이메일',
      '상품명',
      '용량',
      '주기',
      '상태',
      '다음 배송',
      '이전 배송',
      '시작일',
    ] as const;

    const dataRows = rows.map((s) => [
      s.id,
      resolveUserName(s),
      s.userEmail,
      s.productName,
      s.productVolume ?? '',
      describeCycle(s.cycle),
      describeStatus(s.status).label,
      formatDeliveryDate(s.nextDeliveryAtIso),
      s.lastDeliveryAtIso ? formatDeliveryDate(s.lastDeliveryAtIso) : '',
      formatKstDateCell(s.createdAtIso),
    ]);

    const csv = buildCsv(headers, dataRows, {
      domain: '정기배송',
      generatedAtKst: nowKstDisplay(),
    });
    const filename = buildExportFilename('subscriptions');

    await logCsvExportAudit({
      domain: 'subscriptions',
      actorId: claims.userId,
      filters: { status: parsed.data.status, q: parsed.data.q },
      rowCount: rows.length,
      truncated,
    });

    return {
      ok: true,
      filename,
      csv,
      rowCount: rows.length,
      truncated,
    };
  } catch (err: unknown) {
    console.error('[exportSubscriptionsCsvAction] failed', {
      message: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
    });
    return { ok: false, error: 'server_error' };
  }
}
