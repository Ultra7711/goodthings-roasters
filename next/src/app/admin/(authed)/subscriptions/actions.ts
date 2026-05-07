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
import { getAdminClaims } from '@/lib/auth/getClaims';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { dateInputToIso } from '@/lib/admin/subscriptions';
import {
  SUBSCRIPTION_CYCLES,
  CYCLE_DAYS,
  recalculateNextDeliveryOnCycleChange,
  type SubscriptionCycle,
} from '@/lib/subscription/cycles';

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

  revalidatePath('/admin/subscriptions');
  return { ok: true, subscriptionId: data.id as string, status: data.status as string };
}
