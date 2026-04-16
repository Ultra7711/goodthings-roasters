-- ═══════════════════════════════════════════════════════════════════════════
-- 010_create_order_rpc.sql — 주문 생성 원자 함수
--
-- 목적:
--   Supabase REST 는 다중 테이블 트랜잭션을 제공하지 않음.
--   orders + order_items 를 원자적으로 INSERT 하여
--   반쯤 생성된 주문(헤더는 있고 아이템은 없는) 가 남지 않도록 한다.
--
-- 호출자:
--   lib/services/orderService.ts — service_role 클라이언트에서 RPC 호출.
--
-- 보안:
--   SECURITY DEFINER + search_path 고정. RLS 는 service_role 에서 자동 우회되지만,
--   입력 검증은 서버 레이어(zod + 서비스)에서 완료된 상태로 호출된다고 가정한다.
--   본 함수는 "신뢰된 입력 → 원자적 INSERT" 만 수행한다.
--
-- 참고:
--   - docs/backend-architecture-plan.md §7.2 (레이어 분리)
--   - 003_orders.sql / 004_order_items.sql (CHECK 제약)
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.create_order(
  p_user_id            uuid,
  p_guest_email        text,
  p_guest_pin_hash     text,
  p_contact_email      text,
  p_contact_phone      text,
  p_shipping_name      text,
  p_shipping_phone     text,
  p_shipping_zipcode   text,
  p_shipping_addr1     text,
  p_shipping_addr2     text,
  p_shipping_msg_code  text,
  p_shipping_msg_cust  text,
  p_payment_method     public.payment_method,
  p_bank_name          text,
  p_depositor_name     text,
  p_subtotal           integer,
  p_shipping_fee       integer,
  p_discount_amount    integer,
  p_total_amount       integer,
  p_terms_version      text,
  p_items              jsonb
)
returns table (
  id            uuid,
  order_number  text,
  total_amount  integer
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_order_id   uuid;
  v_order_no   text;
  v_item       jsonb;
begin
  -- ── orders INSERT ────────────────────────────────────────────────
  -- order_number 는 BEFORE INSERT 트리거(set_order_number)가 자동 채번.
  insert into public.orders (
    user_id,
    guest_email,
    guest_lookup_pin_hash,
    contact_email,
    contact_phone,
    shipping_name,
    shipping_phone,
    shipping_zipcode,
    shipping_addr1,
    shipping_addr2,
    shipping_message_code,
    shipping_message_custom,
    payment_method,
    bank_name,
    depositor_name,
    subtotal,
    shipping_fee,
    discount_amount,
    total_amount,
    status,
    agreed_at,
    terms_version
  ) values (
    p_user_id,
    p_guest_email,
    p_guest_pin_hash,
    p_contact_email,
    p_contact_phone,
    p_shipping_name,
    p_shipping_phone,
    p_shipping_zipcode,
    p_shipping_addr1,
    nullif(p_shipping_addr2, ''),
    p_shipping_msg_code,
    p_shipping_msg_cust,
    p_payment_method,
    p_bank_name,
    p_depositor_name,
    p_subtotal,
    p_shipping_fee,
    p_discount_amount,
    p_total_amount,
    'pending',
    now(),
    p_terms_version
  )
  returning orders.id, orders.order_number
    into v_order_id, v_order_no;

  -- ── order_items INSERT (반복) ────────────────────────────────────
  -- p_items jsonb 는 서비스 레이어에서 서버 권위 가격으로 재계산된 배열.
  -- 형식:
  --   [{
  --     product_slug, product_name, product_category, product_volume,
  --     product_image_src, product_image_bg,
  --     quantity, unit_price, original_unit_price, line_total,
  --     item_type, subscription_period
  --   }, ...]
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.order_items (
      order_id,
      product_slug,
      product_name,
      product_category,
      product_volume,
      product_image_src,
      product_image_bg,
      quantity,
      unit_price,
      original_unit_price,
      line_total,
      item_type,
      subscription_period
    ) values (
      v_order_id,
      v_item ->> 'product_slug',
      v_item ->> 'product_name',
      v_item ->> 'product_category',
      nullif(v_item ->> 'product_volume', ''),
      nullif(v_item ->> 'product_image_src', ''),
      nullif(v_item ->> 'product_image_bg', ''),
      (v_item ->> 'quantity')::integer,
      (v_item ->> 'unit_price')::integer,
      (v_item ->> 'original_unit_price')::integer,
      (v_item ->> 'line_total')::integer,
      (v_item ->> 'item_type')::public.order_item_type,
      nullif(v_item ->> 'subscription_period', '')::public.subscription_period
    );
  end loop;

  -- ── 반환 ─────────────────────────────────────────────────────────
  return query
    select v_order_id, v_order_no, p_total_amount;
end;
$$;

comment on function public.create_order is
  '주문 + 주문 아이템을 원자적으로 INSERT. service_role 전용 RPC (orderService 호출).';

-- 권한: service_role 만 EXECUTE 가능. anon/authenticated 는 차단.
revoke execute on function public.create_order(
  uuid, text, text, text, text,
  text, text, text, text, text, text, text,
  public.payment_method, text, text,
  integer, integer, integer, integer,
  text, jsonb
) from public, anon, authenticated;

grant execute on function public.create_order(
  uuid, text, text, text, text,
  text, text, text, text, text, text, text,
  public.payment_method, text, text,
  integer, integer, integer, integer,
  text, jsonb
) to service_role;
