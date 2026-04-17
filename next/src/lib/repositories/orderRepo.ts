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
      p_shipping_fee: params.shippingFee,
      p_discount_amount: params.discountAmount,
      p_total_amount: params.totalAmount,
      p_terms_version: params.termsVersion,
      p_items: params.items,
    })
    .single<{
      id: string;
      order_number: string;
      total_amount: number;
      created_at: string;
    }>();

  if (error) throw error;
  if (!data) throw new Error('create_order_rpc_empty_result');

  return {
    id: data.id,
    orderNumber: data.order_number,
    totalAmount: data.total_amount,
    createdAt: data.created_at,
  };
}

/* ── SELECT ───────────────────────────────────────────────────────────── */

/** ORDER_SELECT_COLUMNS — join 포함 전체 */
const ORDER_SELECT = `
  id, order_number, user_id, guest_email,
  contact_email, contact_phone,
  shipping_name, shipping_phone, shipping_zipcode,
  shipping_addr1, shipping_addr2,
  shipping_message_code, shipping_message_custom,
  payment_method, bank_name, depositor_name,
  subtotal, shipping_fee, discount_amount, total_amount,
  status, terms_version, agreed_at,
  created_at, updated_at,
  order_items (
    id, product_slug, product_name, product_category, product_volume,
    product_image_src, product_image_bg,
    quantity, unit_price, original_unit_price, line_total,
    item_type, subscription_period
  )
` as const;

/**
 * 회원 본인 주문 조회.
 * RLS `orders_select_own` 에 의해 타인 주문은 자동 차단(= null 반환).
 */
export async function findOrderForUser(
  orderNumber: string,
): Promise<OrderRow | null> {
  const supabase = await createRouteHandlerClient();
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('order_number', orderNumber)
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
    .maybeSingle<OrderRow & { guest_lookup_pin_hash: string | null }>();

  if (error) throw error;
  return data ?? null;
}
