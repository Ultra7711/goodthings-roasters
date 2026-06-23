/* ══════════════════════════════════════════════════════════════════════════
   pointRepo.ts — 적립금(포인트) 조회 Repository (Phase 2)

   역할:
   - 포인트 잔액 조회만 담당(읽기). 잔액 변동은 094 RPC(service_role)만.
   - orderService(서버 재계산·T1)가 사용 가능액 캡 계산용으로 실잔액을 조회한다.

   주의:
   - service_role 클라이언트 사용(profiles.point_balance 조회). RLS 우회.
     실제 차감은 create_order(096) 내부 use_points 의 FOR UPDATE 가 권위 —
     본 조회는 캡 계산용이며, 차감 시점 잔액 부족은 RPC 가 재검증/거부한다(T2).

   참조:
   - supabase/migrations/090_points_schema.sql (profiles.point_balance)
   - supabase/migrations/094_point_rpcs.sql (use_points · 권위 차감)
   ══════════════════════════════════════════════════════════════════════════ */

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import type { PointLedgerEntry } from '@/types/point';

/**
 * 회원 포인트 잔액 조회 (service_role).
 * 프로필 미존재 시 0 반환(방어적 — 정상 회원은 handle_new_user 로 항상 존재).
 *
 * @throws DB 오류 — 호출자가 catch.
 */
export async function getPointBalance(userId: string): Promise<number> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('profiles')
    .select('point_balance')
    .eq('id', userId)
    .maybeSingle<{ point_balance: number }>();

  if (error) throw error;
  return data?.point_balance ?? 0;
}

type LedgerRow = {
  id: string;
  user_id: string;
  order_id: string | null;
  event_type: PointLedgerEntry['eventType'];
  source: PointLedgerEntry['source'];
  amount: number;
  expires_at: string | null;
  description: string | null;
  created_at: string;
};

/**
 * 회원 포인트 원장 최근 N건 조회 (service_role · 어드민이 타 회원 원장 조회용).
 * point_ledger RLS(092)는 본인 SELECT 만 허용 → 어드민은 service_role 로 우회.
 *
 * @throws DB 오류 — 호출자가 catch.
 */
export async function getRecentPointLedger(
  userId: string,
  limit: number,
): Promise<PointLedgerEntry[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('point_ledger')
    .select('id, user_id, order_id, event_type, source, amount, expires_at, description, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data ?? []) as LedgerRow[]).map((r) => ({
    id: r.id,
    userId: r.user_id,
    orderId: r.order_id,
    eventType: r.event_type,
    source: r.source,
    amount: r.amount,
    expiresAt: r.expires_at,
    description: r.description,
    createdAt: r.created_at,
  }));
}

/**
 * 어드민 수동 가감 (service_role RPC · 094 adjust_points).
 * 가감액 amount: 양수=지급, 음수=차감, 0 금지. 멱등(idempotency_key).
 * owner 가드는 호출 server action 책임.
 *
 * RPC 에러를 결과 코드로 매핑(호출자가 토스트 분기).
 */
export type AdjustPointsResult =
  | { ok: true; applied: boolean; balance: number; ledgerId: string | null }
  | {
      ok: false;
      error: 'user_not_found' | 'invalid_amount' | 'insufficient_balance' | 'server_error';
    };

export async function adjustPoints(params: {
  userId: string;
  amount: number;
  idempotencyKey: string;
  description: string | null;
}): Promise<AdjustPointsResult> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc('adjust_points', {
    p_user_id: params.userId,
    p_amount: params.amount,
    p_idempotency_key: params.idempotencyKey,
    p_description: params.description,
  });

  if (error) {
    const msg = error.message ?? '';
    if (error.code === 'no_data_found' || msg.includes('user_not_found')) {
      return { ok: false, error: 'user_not_found' };
    }
    if (error.code === '22023' || msg.includes('invalid_amount')) {
      return { ok: false, error: 'invalid_amount' };
    }
    if (error.code === 'P0001' || msg.includes('insufficient_balance')) {
      return { ok: false, error: 'insufficient_balance' };
    }
    console.error('[adjustPoints] rpc failed', { code: error.code, msg: msg.slice(0, 200) });
    return { ok: false, error: 'server_error' };
  }

  const result = (data ?? {}) as { applied?: boolean; ledger_id?: string | null; balance?: number };
  return {
    ok: true,
    applied: result.applied === true,
    balance: result.balance ?? 0,
    ledgerId: result.ledger_id ?? null,
  };
}
