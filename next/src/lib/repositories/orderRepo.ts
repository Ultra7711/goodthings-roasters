/* ══════════════════════════════════════════════════════════════════════════
   orderRepo.ts — 주문 저장/조회 Repository (P2-A)

   역할:
   - Supabase 쿼리만 담당. 비즈 로직은 orderService.
   - service_role 클라이언트 사용 (원자 RPC + 게스트 조회 + RLS 우회 INSERT).
   - 회원 본인 조회는 getClaims() + RLS 에 의존 → createRouteHandlerClient 사용.

   참조:
   - supabase/migrations/010_create_order_rpc.sql
   - supabase/migrations/007_rls_policies.sql (orders_select_own, order_items_select_own)
   ══════════════════════════════════════════════════════════════════════════ */

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import type { OrderItemType, DbPaymentMethod, DbOrderStatus } from '@/types/db';

/* ── RPC 입력(= 010 마이그레이션 시그니처) ──────────────────────────────── */

export type CreateOrderRpcItem = {
  product_slug: string;
  product_name: string;
  product_category: string;
  product_volume: string;
  product_image_src: string;
  product_image_bg: string;
  quantity: number;
  unit_price: number;
  original_unit_price: number;
  line_total: number;
  item_type: OrderItemType;
  subscription_period: string | null;
};

export type CreateOrderRpcParams = {
  userId: string | null;
  guestEmail: string | null;
  guestPinHash: string | null;
  contactEmail: string;
  contactPhone: string;
  shipping: {
    name: string;
    phone: string;
    zipcode: string;
    addr1: string;
    addr2: string;
    messageCode: string | null;
    messageCustom: string | null;
  };
  payment: {
    method: DbPaymentMethod;
    bankName: string | null;
    depositorName: string | null;
  };
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  totalAmount: number;
  termsVersion: string;
  items: CreateOrderRpcItem[];
};

export type CreateOrderRpcResult = {
  id: string;
  orderNumber: string;
  totalAmount: number;
  /** 서버 기준 주문 생성 시각 (ISO-8601). 017 마이그레이션에서 RPC 반환값에 추가. */
  createdAt: string;
  /**
   * @deprecated 042 cutover 후 항상 0. create_order RPC 가 더 이상 subscriptions INSERT 하지 않음.
   * 정기배송 등록은 process_billing_charge_success RPC (Phase 3-A) 가 담당.
   * RPC 응답 5번째 컬럼 호환을 위해 type 만 유지.
   */
  subscriptionCount: number;
};

/* ── 주문 DTO (조회용) ────────────────────────────────────────────────── */

export type OrderItemRow = {
  id: string;
  product_slug: string;
  product_name: string;
  product_category: string;
  product_volume: string | null;
  product_image_src: string | null;
  product_image_bg: string | null;
  quantity: number;
  unit_price: number;
  original_unit_price: number;
  line_total: number;
  item_type: OrderItemType;
  subscription_period: string | null;
};

export type OrderRow = {
  id: string;
  order_number: string;
  /** 018 마이그레이션 — enumeration 방어용 공개 식별자 (UUID v4). 고객 대면 URL/이메일 전용. */
  public_token: string;
  user_id: string | null;
  guest_email: string | null;
  contact_email: string;
  contact_phone: string;
  shipping_name: string;
  shipping_phone: string;
  shipping_zipcode: string;
  shipping_addr1: string;
  shipping_addr2: string | null;
  shipping_message_code: string | null;
  shipping_message_custom: string | null;
  payment_method: DbPaymentMethod;
  bank_name: string | null;
  depositor_name: string | null;
  subtotal: number;
  shipping_fee: number;
  discount_amount: number;
  total_amount: number;
  status: DbOrderStatus;
  terms_version: string;
  agreed_at: string;
  created_at: string;
  updated_at: string;
  /** 016 배송 출고 — 송장/택배사 페어 (orders_tracking_pair 제약 · 미발송 시 둘 다 null) */
  tracking_number: string | null;
  carrier: string | null;
  shipped_at: string | null;
  order_items: OrderItemRow[];
};

/* ── INSERT (RPC) ─────────────────────────────────────────────────────── */

/**
 * 원자적 주문 생성. 010 마이그레이션의 plpgsql 함수 호출.
 *
 * @throws DB 오류 (제약 위반·네트워크 등) — 호출자가 catch.
 */
export async function createOrder(
  params: CreateOrderRpcParams,
): Promise<CreateOrderRpcResult> {
  const admin = getSupabaseAdmin();

  /* BUG-FIX 2026-04-23: Vercel Turbopack 프로덕션 번들에서 외부 import 된 상수/함수가
     함수 객체로 치환되는 버그 확인. orderService 에서 외부 import 제거로 근본 대응했으나,
     재발 시 총액이 잘못된 값으로 silently 저장되는 것을 막기 위해 한 겹 더 방어.
     fallback 발동 시 서버 로그에 경고를 남겨 재발을 즉시 감지 가능하게 한다. */
  const toInt = (v: unknown, fallback: number, field: string): number => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    console.error(
      `[createOrder] ${field} invalid (type=${typeof v}, isFinite=${
        typeof v === 'number' ? Number.isFinite(v) : 'n/a'
      }) — falling back to ${fallback}. Turbopack scope bug 재발 가능성 확인 필요.`,
    );
    return fallback;
  };
  const shippingFee = toInt(params.shippingFee, 0, 'shippingFee');
  const discountAmount = toInt(params.discountAmount, 0, 'discountAmount');
  const totalAmount = toInt(
    params.totalAmount,
    params.subtotal + shippingFee - discountAmount,
    'totalAmount',
  );

  const { data, error } = await admin
    .rpc('create_order', {
      p_user_id: params.userId,
      p_guest_email: params.guestEmail,
      p_guest_pin_hash: params.guestPinHash,
      p_contact_email: params.contactEmail,
      p_contact_phone: params.contactPhone,
      p_shipping_name: params.shipping.name,
      p_shipping_phone: params.shipping.phone,
      p_shipping_zipcode: params.shipping.zipcode,
      p_shipping_addr1: params.shipping.addr1,
      p_shipping_addr2: params.shipping.addr2,
      p_shipping_msg_code: params.shipping.messageCode,
      p_shipping_msg_cust: params.shipping.messageCustom,
      p_payment_method: params.payment.method,
      p_bank_name: params.payment.bankName,
      p_depositor_name: params.payment.depositorName,
      p_subtotal: params.subtotal,
      p_shipping_fee: shippingFee,
      p_discount_amount: discountAmount,
      p_total_amount: totalAmount,
      p_terms_version: params.termsVersion,
      p_items: params.items,
    })
    .single<{
      id: string;
      order_number: string;
      total_amount: number;
      created_at: string;
      subscription_count: number;
    }>();

  if (error) throw error;
  if (!data) throw new Error('create_order_rpc_empty_result');

  return {
    id: data.id,
    orderNumber: data.order_number,
    totalAmount: data.total_amount,
    createdAt: data.created_at,
    subscriptionCount: data.subscription_count,
  };
}

/* ── SELECT ───────────────────────────────────────────────────────────── */

/** ORDER_SELECT_COLUMNS — join 포함 전체 */
const ORDER_SELECT = `
  id, order_number, public_token, user_id, guest_email,
  contact_email, contact_phone,
  shipping_name, shipping_phone, shipping_zipcode,
  shipping_addr1, shipping_addr2,
  shipping_message_code, shipping_message_custom,
  payment_method, bank_name, depositor_name,
  subtotal, shipping_fee, discount_amount, total_amount,
  status, terms_version, agreed_at,
  created_at, updated_at,
  tracking_number, carrier, shipped_at,
  order_items (
    id, product_slug, product_name, product_category, product_volume,
    product_image_src, product_image_bg,
    quantity, unit_price, original_unit_price, line_total,
    item_type, subscription_period
  )
` as const;

/**
 * 회원 본인 주문 목록 (최신순).
 * RLS `orders_select_own` 에 의해 본인 주문만 반환.
 * pending 제외 (S171): 결제 미확정 row 는 사용자 재진입 경로 부재 → 노출 가치 없음.
 * (S173: abandoned 는 DELETE 정책으로 변경 → cancelled = 진짜 운영 취소만, 노출 OK)
 */
export async function findOrdersForUser(limit = 20, offset = 0): Promise<OrderRow[]> {
  const supabase = await createRouteHandlerClient();
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .neq('status', 'pending')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data as OrderRow[]) ?? [];
}

/**
 * 회원 본인 주문 개수 (사이드 nav 카운트용 · S253 마이페이지 최적화).
 * `head: true` + `count: 'exact'` → row 데이터 fetch 없이 count 만 반환.
 * RLS `orders_select_own` 적용 → 본인 주문만 카운트.
 * pending 제외 — findOrdersForUser 와 정합.
 */
export async function getOrdersCountForUser(): Promise<number> {
  const supabase = await createRouteHandlerClient();
  const { count, error } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .neq('status', 'pending');

  if (error) throw error;
  return count ?? 0;
}

/**
 * 회원 본인 주문 조회.
 * RLS `orders_select_own` 에 의해 타인 주문은 자동 차단(= null 반환).
 * pending 제외 (S171): URL 조작으로도 결제 미확정 row 노출 차단.
 */
export async function findOrderForUser(
  orderNumber: string,
): Promise<OrderRow | null> {
  const supabase = await createRouteHandlerClient();
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('order_number', orderNumber)
    .neq('status', 'pending')
    .maybeSingle<OrderRow>();

  if (error) throw error;
  return data ?? null;
}

/**
 * 게스트 주문 조회. service_role 로 PIN 검증 전 레코드 로드.
 *
 * 흐름:
 * 1) (orderNumber, guest_email, user_id is null) 3중 조건으로 맞는 행 선택
 * 2) 반환값에 `guest_lookup_pin_hash` 포함 → 호출자(orderService)가 argon2 verify
 * 3) 검증 실패 / 주문 미존재 모두 호출자에서 동일한 404 로 매핑 (enumeration 방어)
 *
 * 주의:
 * - service_role 을 사용하므로 RLS 우회. PIN 해시 검증 책임은 반드시 호출자가 진다.
 * - email 비교는 DB level exact match — 정규화(소문자)는 insert 시점에서 보장.
 */
export async function findGuestOrderWithHash(
  orderNumber: string,
  email: string,
): Promise<(OrderRow & { guest_lookup_pin_hash: string | null }) | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('orders')
    .select(`${ORDER_SELECT}, guest_lookup_pin_hash`)
    .eq('order_number', orderNumber)
    .eq('guest_email', email)
    .is('user_id', null)
    .neq('status', 'pending')
    .maybeSingle<OrderRow & { guest_lookup_pin_hash: string | null }>();

  if (error) throw error;
  return data ?? null;
}

/* ── ABANDON (DELETE) ─────────────────────────────────────────────────────

   S173: pending 주문은 결제 미완료 흔적 → row 보존 가치 없음.
   "Toss 위젯에서 이전" 은 사용자 취소가 아니라 UX 네비게이션이므로
   cancelled status 로 남기지 않고 DELETE.

   순서:
   1) 026 RPC 가 pending 시점에 subscriptions 도 active 로 INSERT 하므로
      먼저 관련 subscription DELETE (initial_order_id 매칭).
   2) orders DELETE (order_items 는 ON DELETE CASCADE 로 자동 삭제).
   - payments / payment_transactions 는 결제 confirm 후 생성이라
     pending 시점에 row 가 없음 → RESTRICT FK 무관.
*/

/**
 * 로그인 사용자의 pending 주문을 DELETE.
 * - 이미 pending 이 아니면 no-op (paid 이상은 환불 흐름으로).
 * - service_role + user_id 명시 필터로 타인 주문 보호.
 * - 관련 subscription 도 함께 DELETE (dead active subscription 방지).
 * @returns 실제 DELETE 발생 시 true, no-op 이면 false.
 */
export async function deletePendingOrderForUser(
  orderNumber: string,
  userId: string,
): Promise<boolean> {
  const admin = getSupabaseAdmin();

  /* 1) 대상 order id 확인 + pending 가드 */
  const { data: target, error: lookupError } = await admin
    .from('orders')
    .select('id')
    .eq('order_number', orderNumber)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .maybeSingle<{ id: string }>();

  if (lookupError) throw lookupError;
  if (!target) return false;

  /* 2) 연관 subscription 선제 DELETE.
        042 cutover 후 create_order RPC 는 subscription INSERT 를 하지 않으므로
        pending order 에는 항상 0 row 영향이지만, FK initial_order_id ON DELETE SET NULL
        의 dead row 방지 + 사후 마이그레이션 호환을 위해 defensive 보존. */
  const { error: subError } = await admin
    .from('subscriptions')
    .delete()
    .eq('initial_order_id', target.id);
  if (subError) throw subError;

  /* 3) order DELETE — order_items 는 CASCADE 로 자동 삭제 */
  const { error: orderError } = await admin
    .from('orders')
    .delete()
    .eq('id', target.id);
  if (orderError) throw orderError;

  return true;
}
