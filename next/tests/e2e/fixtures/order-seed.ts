/* ══════════════════════════════════════════════════════════════════════════
   order-seed.ts — E2E 임시 주문(paid) 생성/정리 helper (S250-5 ④)

   - service_role 로 create_order RPC(010/017) 호출 → orders + order_items 원자 INSERT.
     RPC 가 만드는 초기 status = 'pending' → 곧바로 'paid' 로 전환(전이 트리거 012 허용).
     'paid' 여야 ShippingDialog 의 발송 처리 버튼이 활성(OrderDetailClient isPaid).
   - 결제 토큰/payments 행 없이 service_role 직접 호출 — 결제 SDK 의존 X.
   - 격리: 고정 guest_email 로 이전 잔존 E2E 주문 선삭제(order_items cascade).
   - cleanup: orders hard delete (order_items ON DELETE CASCADE · payments 행 없음).

   create_order 인자(017) = guest 주문 + card 결제로 구성:
     · guest: user_id=null + guest_email/pin_hash (orders_user_or_guest 제약)
     · card : bank_name/depositor_name=null (orders_transfer_fields 제약)
     · 금액: total = subtotal + shipping_fee - discount (orders_total_matches)

   product-seed.ts / cafe-menu-seed.ts 패턴 답습.
   ══════════════════════════════════════════════════════════════════════════ */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

/* 격리 식별자 — 이 email 의 주문은 모두 E2E 잔존물로 간주하고 선삭제. */
export const E2E_ORDER_GUEST_EMAIL = 'e2e-order@example.com';

export interface SeedOrder {
  id: string;
  orderNumber: string;
}

function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      'order-seed: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 누락',
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** 이전 실행 잔존 주문 삭제 (order_items cascade). teardown 실패 격리 보호. */
async function purgePriorOrders(admin: SupabaseClient): Promise<void> {
  await admin.from('orders').delete().eq('guest_email', E2E_ORDER_GUEST_EMAIL);
}

/**
 * E2E 전용 임시 주문 1건 생성 후 'paid' 로 전환.
 *
 * 반환값의 orderNumber 로 `/admin/orders/{orderNumber}` 직접 진입.
 */
export async function seedTestOrder(): Promise<SeedOrder> {
  const admin = adminClient();

  /* 격리 — 고정 guest_email 의 이전 잔존 주문 삭제 */
  await purgePriorOrders(admin);

  /* 1) create_order RPC — guest + card + 1 item. 초기 status='pending'. */
  const { data, error } = await admin.rpc('create_order', {
    p_user_id: null,
    p_guest_email: E2E_ORDER_GUEST_EMAIL,
    p_guest_pin_hash: 'e2e-pin-hash',
    p_contact_email: E2E_ORDER_GUEST_EMAIL,
    p_contact_phone: '01000000000',
    p_shipping_name: '[E2E] 발송 테스트',
    p_shipping_phone: '01000000000',
    p_shipping_zipcode: '06241',
    p_shipping_addr1: '서울특별시 강남구 테헤란로 1',
    p_shipping_addr2: '',
    p_shipping_msg_code: null,
    p_shipping_msg_cust: null,
    p_payment_method: 'card',
    p_bank_name: null,
    p_depositor_name: null,
    p_subtotal: 10_000,
    p_shipping_fee: 0,
    p_discount_amount: 0,
    p_total_amount: 10_000,
    p_terms_version: '2026-04-01',
    p_items: [
      {
        product_slug: 'e2e-ship-item',
        product_name: '[E2E] 발송 테스트 상품',
        product_category: 'coffee_bean',
        quantity: 1,
        unit_price: 10_000,
        original_unit_price: 10_000,
        line_total: 10_000,
        item_type: 'normal',
      },
    ],
  });
  if (error) throw new Error(`seedTestOrder create_order 실패: ${error.message}`);

  const row = (data as Array<{ id: string; order_number: string }>)?.[0];
  if (!row?.id || !row?.order_number) {
    throw new Error('seedTestOrder: create_order 반환값 누락');
  }

  /* 2) pending → paid 전환 (전이 트리거 012 가 허용 · 발송 처리 버튼 활성화 전제) */
  const { error: paidErr } = await admin
    .from('orders')
    .update({ status: 'paid' })
    .eq('id', row.id);
  if (paidErr) {
    /* 부분 seed 방지 — 주문 롤백 후 throw */
    await admin.from('orders').delete().eq('id', row.id);
    throw new Error(`seedTestOrder paid 전환 실패: ${paidErr.message}`);
  }

  return { id: row.id, orderNumber: row.order_number };
}

/** seed 주문 hard delete (order_items cascade). teardown — 실패해도 throw 안 함. */
export async function cleanupTestOrder(seed: SeedOrder): Promise<void> {
  const admin = adminClient();
  const { error } = await admin.from('orders').delete().eq('id', seed.id);
  if (error) {
    console.warn(`[order-seed] delete 실패 (id=${seed.id}): ${error.message}`);
  }
}

/** seed 주문의 현재 status/tracking/carrier 조회 — 발송 검증용. */
export async function getOrderShipState(orderId: string): Promise<{
  status: string;
  trackingNumber: string | null;
  carrier: string | null;
  shippedAt: string | null;
}> {
  const admin = adminClient();
  const { data, error } = await admin
    .from('orders')
    .select('status, tracking_number, carrier, shipped_at')
    .eq('id', orderId)
    .maybeSingle();
  if (error || !data) {
    throw new Error(`getOrderShipState 실패: ${error?.message ?? 'no row'}`);
  }
  const row = data as {
    status: string;
    tracking_number: string | null;
    carrier: string | null;
    shipped_at: string | null;
  };
  return {
    status: row.status,
    trackingNumber: row.tracking_number,
    carrier: row.carrier,
    shippedAt: row.shipped_at,
  };
}
