'use server';

/* ══════════════════════════════════════════════════════════════════════════
   actions.ts — /admin/subscriptions Server Actions (S188 minimal)

   책임 (operating safety net):
   1) getAdminClaims 가드 — 비admin 차단
   2) Zod 검증 — UpdateNextDeliveryInputSchema (subscriptionId · nextDeliveryAt)
   3) 044 RLS subscriptions_update_admin 통한 직접 UPDATE
      - next_delivery_at 컬럼만 명시 (다른 컬럼 보호는 actions.ts 책임)
   4) revalidatePath('/admin/subscriptions') — 목록 캐시 무효화

   설계 (ADR-006 §적용 범위):
   - 호출처 = 어드민 UI 1곳만 → Server Action 단일 채널 (REST API 미생성).
   - users/actions.ts 패턴 답습.
   - cycle / qty / status / cancel / pause 액션은 carry-over (full Group D).

   참조:
   - supabase/migrations/044_admin_subscriptions_rls.sql
   - docs/adr/ADR-006-admin-pages-api-separation.md
   ══════════════════════════════════════════════════════════════════════════ */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getAdminClaims } from '@/lib/auth/getClaims';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { dateInputToIso } from '@/lib/admin/subscriptions';

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
