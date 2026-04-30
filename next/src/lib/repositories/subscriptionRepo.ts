/* ══════════════════════════════════════════════════════════════════════════
   subscriptionRepo.ts — 구독 저장/조회 Repository (P2-C)

   역할:
   - 회원 인증 기반 구독 CRUD. 모든 쿼리는 createRouteHandlerClient (RLS 적용).
   - subscriptions_select_own / subscriptions_update_own 정책에 의해
     타인 행에 접근/수정 불가.
   - status 필드 일관성 제약(paused_at NOT NULL when paused 등)은 DB 가 보장.

   참조:
   - supabase/migrations/005_subscriptions.sql
   - supabase/migrations/007_rls_policies.sql
   ══════════════════════════════════════════════════════════════════════════ */

import { createRouteHandlerClient } from '@/lib/supabaseServer';
import type { DbSubscriptionStatus } from '@/types/db';

/* ── Row 타입 ────────────────────────────────────────────────────────── */

export type SubscriptionRow = {
  id: string;
  user_id: string;
  product_slug: string;
  product_name: string;
  product_volume: string | null;
  product_image_src: string | null;
  cycle: string;
  next_delivery_at: string;
  last_delivery_at: string | null;
  status: DbSubscriptionStatus;
  paused_at: string | null;
  cancelled_at: string | null;
  skip_count: number;
  created_at: string;
  updated_at: string;
};

const SUB_SELECT = `
  id, user_id, product_slug, product_name, product_volume, product_image_src,
  cycle, next_delivery_at, last_delivery_at, status,
  paused_at, cancelled_at, skip_count, created_at, updated_at
` as const;

/* ── SELECT ─────────────────────────────────────────────────────────── */

/** 회원 본인 구독 목록 (active/paused 만) — RLS 자동 필터링 */
export async function findSubscriptionsForUser(): Promise<SubscriptionRow[]> {
  const supabase = await createRouteHandlerClient();
  const { data, error } = await supabase
    .from('subscriptions')
    .select(SUB_SELECT)
    .in('status', ['active', 'paused'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as SubscriptionRow[]) ?? [];
}

/** 단건 조회 — RLS 로 타인 접근 차단 */
export async function findSubscriptionForUser(id: string): Promise<SubscriptionRow | null> {
  const supabase = await createRouteHandlerClient();
  const { data, error } = await supabase
    .from('subscriptions')
    .select(SUB_SELECT)
    .eq('id', id)
    .maybeSingle<SubscriptionRow>();

  if (error) throw error;
  return data ?? null;
}

/* ── UPDATE ─────────────────────────────────────────────────────────── */

/**
 * 배송 주기 변경 + 다음 배송일 갱신.
 * next_delivery_at 은 서버(Route Handler)에서 계산 후 전달.
 */
export async function updateSubscriptionCycle(
  id: string,
  cycle: string,
  nextDeliveryAt: Date,
): Promise<SubscriptionRow> {
  const supabase = await createRouteHandlerClient();
  const { data, error } = await supabase
    .from('subscriptions')
    .update({ cycle, next_delivery_at: nextDeliveryAt.toISOString() })
    .eq('id', id)
    .select(SUB_SELECT)
    .single<SubscriptionRow>();

  if (error) throw error;
  return data;
}

/**
 * 구독 해지 — status='cancelled', cancelled_at=now().
 * DB constraint 충족을 위해 두 필드 동시 업데이트.
 */
export async function cancelSubscription(id: string): Promise<SubscriptionRow> {
  const supabase = await createRouteHandlerClient();
  const { data, error } = await supabase
    .from('subscriptions')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['active', 'paused'])
    .select(SUB_SELECT)
    .single<SubscriptionRow>();

  if (error) throw error;
  return data;
}

/**
 * 1회 건너뛰기 — next_delivery_at 갱신, skip_count++.
 * nextDeliveryAt·newSkipCount 은 호출자(Route Handler)에서 계산.
 */
export async function skipSubscriptionDelivery(
  id: string,
  nextDeliveryAt: Date,
  newSkipCount: number,
): Promise<SubscriptionRow> {
  const supabase = await createRouteHandlerClient();
  const { data, error } = await supabase
    .from('subscriptions')
    .update({
      next_delivery_at: nextDeliveryAt.toISOString(),
      skip_count: newSkipCount,
    })
    .eq('id', id)
    .eq('status', 'active')
    .select(SUB_SELECT)
    .single<SubscriptionRow>();

  if (error) throw error;
  return data;
}

/**
 * 구독 일시중지 — status='paused', paused_at=now().
 */
export async function pauseSubscription(id: string): Promise<SubscriptionRow> {
  const supabase = await createRouteHandlerClient();
  const { data, error } = await supabase
    .from('subscriptions')
    .update({ status: 'paused', paused_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'active')
    .select(SUB_SELECT)
    .single<SubscriptionRow>();

  if (error) throw error;
  return data;
}

/**
 * 구독 재개 — status='active', paused_at=null, next_delivery_at 갱신.
 * nextDeliveryAt 은 now() + cycle_days (서버 계산).
 */
export async function resumeSubscription(
  id: string,
  nextDeliveryAt: Date,
): Promise<SubscriptionRow> {
  const supabase = await createRouteHandlerClient();
  const { data, error } = await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      paused_at: null,
      next_delivery_at: nextDeliveryAt.toISOString(),
    })
    .eq('id', id)
    .eq('status', 'paused')
    .select(SUB_SELECT)
    .single<SubscriptionRow>();

  if (error) throw error;
  return data;
}
