/* ══════════════════════════════════════════════════════════════════════════
   cartRepo.ts — 회원 장바구니 Repository (Session 12)

   역할:
   - cart_items 테이블 CRUD. 비즈 로직(가격 스냅샷 계산 등)은 cartService.
   - 회원 전용. RLS `cart_items_*_own` 이 자동으로 본인 user_id 만 허용.
   - 게스트는 이 repo 를 사용하지 않음 (localStorage 유지).

   참조:
   - supabase/migrations/019_cart_items.sql
   - supabase/migrations/007_rls_policies.sql
   ══════════════════════════════════════════════════════════════════════════ */

import { createRouteHandlerClient } from '@/lib/supabaseServer';
import type { OrderItemType } from '@/types/db';
import type { SubscriptionPeriod } from '@/lib/schemas/order';

/* ── DTO ──────────────────────────────────────────────────────────────── */

export type CartItemRow = {
  id: string;
  user_id: string;
  product_slug: string;
  product_volume: string;
  quantity: number;
  unit_price_snapshot: number;
  item_type: OrderItemType;
  subscription_period: SubscriptionPeriod | null;
  created_at: string;
  updated_at: string;
};

const CART_SELECT = `
  id, user_id, product_slug, product_volume,
  quantity, unit_price_snapshot,
  item_type, subscription_period,
  created_at, updated_at
` as const;

/* ── Upsert 입력 ──────────────────────────────────────────────────────── */

export type UpsertCartItemParams = {
  userId: string;
  productSlug: string;
  productVolume: string;
  quantity: number;
  unitPriceSnapshot: number;
  itemType: OrderItemType;
  /** itemType = 'subscription' 일 때만 non-null. */
  subscriptionPeriod: SubscriptionPeriod | null;
};

/** quantity 합산 시 상한 (cart_items_quantity_range CHECK 와 동일) */
export const CART_MAX_QTY = 99;

/* ══════════════════════════════════════════
   Public API
   ══════════════════════════════════════════ */

/**
 * 본인 카트 전체 조회. RLS 가 auth.uid() = user_id 행만 반환.
 * 정렬: created_at DESC (최근 담은 항목이 상단).
 */
export async function listCartItems(): Promise<CartItemRow[]> {
  const supabase = await createRouteHandlerClient();
  const { data, error } = await supabase
    .from('cart_items')
    .select(CART_SELECT)
    .order('created_at', { ascending: false })
    .returns<CartItemRow[]>();

  if (error) throw error;
  return data ?? [];
}

/**
 * 카트 아이템 upsert.
 *
 * 동작:
 * - 동일 (user_id, product_slug, product_volume, item_type, subscription_period)
 *   행이 존재하면 quantity 를 합산(상한 99)하고 unit_price_snapshot 은 최신값으로 갱신.
 * - 미존재 시 새 행 INSERT.
 *
 * 주의:
 * - SELECT → INSERT/UPDATE 두 단계. 동시성 경합은 partial unique index 가 잡아 409 유발.
 *   사용자 더블클릭 수준 빈도 → 허용 가능. 심각해지면 plpgsql RPC 로 이관.
 */
export async function upsertCartItem(
  params: UpsertCartItemParams,
): Promise<CartItemRow> {
  const supabase = await createRouteHandlerClient();

  /* 1) 동일 키 레코드 검색 */
  let query = supabase
    .from('cart_items')
    .select(CART_SELECT)
    .eq('user_id', params.userId)
    .eq('product_slug', params.productSlug)
    .eq('product_volume', params.productVolume)
    .eq('item_type', params.itemType);

  if (params.itemType === 'subscription') {
    query = query.eq('subscription_period', params.subscriptionPeriod ?? '');
  } else {
    query = query.is('subscription_period', null);
  }

  const { data: existing, error: selectError } =
    await query.maybeSingle<CartItemRow>();
  if (selectError) throw selectError;

  /* 2) 존재 시 UPDATE (quantity 합산) */
  if (existing) {
    const mergedQty = Math.min(
      CART_MAX_QTY,
      existing.quantity + params.quantity,
    );
    const { data, error } = await supabase
      .from('cart_items')
      .update({
        quantity: mergedQty,
        unit_price_snapshot: params.unitPriceSnapshot,
      })
      .eq('id', existing.id)
      .select(CART_SELECT)
      .single<CartItemRow>();
    if (error) throw error;
    return data;
  }

  /* 3) 미존재 시 INSERT */
  const { data, error } = await supabase
    .from('cart_items')
    .insert({
      user_id: params.userId,
      product_slug: params.productSlug,
      product_volume: params.productVolume,
      quantity: params.quantity,
      unit_price_snapshot: params.unitPriceSnapshot,
      item_type: params.itemType,
      subscription_period: params.subscriptionPeriod,
    })
    .select(CART_SELECT)
    .single<CartItemRow>();

  if (error) throw error;
  return data;
}

/**
 * quantity 직접 설정 (PATCH). 합산이 아니라 치환.
 * RLS 가 본인 행만 매칭 — 타인 id 전달 시 null 반환.
 */
export async function updateCartItemQuantity(
  id: string,
  quantity: number,
): Promise<CartItemRow | null> {
  const supabase = await createRouteHandlerClient();
  const { data, error } = await supabase
    .from('cart_items')
    .update({ quantity })
    .eq('id', id)
    .select(CART_SELECT)
    .maybeSingle<CartItemRow>();

  if (error) throw error;
  return data ?? null;
}

/**
 * 카트 아이템 삭제. RLS 가 본인 행만 매칭.
 * @returns true = 삭제된 행 있음, false = 타인/미존재
 */
export async function deleteCartItem(id: string): Promise<boolean> {
  const supabase = await createRouteHandlerClient();
  const { data, error } = await supabase
    .from('cart_items')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/* ══════════════════════════════════════════
   Bulk merge (C-M3) — 단일 RPC 호출로 N 아이템 일괄 upsert.
   ══════════════════════════════════════════ */

export type BulkMergeItem = {
  productSlug: string;
  productVolume: string;
  quantity: number;
  unitPriceSnapshot: number;
  itemType: OrderItemType;
  subscriptionPeriod: SubscriptionPeriod | null;
};

/**
 * merge_cart_items RPC 호출. 검증 완료된 아이템 배열을 원자적으로 upsert.
 * RLS 준수 (SECURITY INVOKER) — user-context 클라이언트 사용.
 * @returns merged 행 수 (RPC 반환값)
 */
export async function bulkMergeCartItems(
  userId: string,
  items: BulkMergeItem[],
): Promise<number> {
  if (items.length === 0) return 0;
  const supabase = await createRouteHandlerClient();
  const payload = items.map((i) => ({
    product_slug: i.productSlug,
    product_volume: i.productVolume,
    quantity: i.quantity,
    unit_price_snapshot: i.unitPriceSnapshot,
    item_type: i.itemType,
    subscription_period: i.subscriptionPeriod,
  }));

  const { data, error } = await supabase.rpc('merge_cart_items', {
    p_user_id: userId,
    p_items: payload,
  });
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}

/**
 * 특정 사용자의 카트 아이템 전체 삭제 (결제 완료 후 호출 예정 — Session 14+).
 *
 * @param userId — 삭제 대상 사용자 UUID. 반드시 인증 세션의 user.id 와 일치해야 함.
 *   RLS 정책 `cart_items_delete_own` 이 `auth.uid() = user_id` 로 제한하지만,
 *   방어적으로 WHERE 절에도 명시 — service_role 컨텍스트 또는 RLS 변경 시 안전장치.
 */
export async function clearCartItems(userId: string): Promise<void> {
  const supabase = await createRouteHandlerClient();
  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('user_id', userId);

  if (error) throw error;
}
