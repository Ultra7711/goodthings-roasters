-- ═══════════════════════════════════════════════════════════════════════════
-- 017_create_order_rpc_created_at.sql — create_order RPC 반환값 확장
--
-- 목적:
--   P2-A 리뷰 MEDIUM M-3 해소 — create_order 가 `(id, order_number, total_amount)`
--   만 반환해 클라가 주문 완료 페이지·MyPage 에서 timezone 일관된 주문 일시를 얻지 못함.
--   서버 기준 `created_at` 을 반환값에 추가한다.
--
-- 변경 사항:
--   - `returns table` 시그니처 변경 (id, order_number, total_amount, created_at).
--   - PostgreSQL `create or replace function` 은 반환 타입 변경을 허용하지 않으므로
--     `drop function` 후 재생성. 호출 권한 재부여 필수.
--
-- 상호 영향:
--   - orderRepo.ts `.single<...>()` 제네릭과 CreateOrderRpcResult 타입을 같이 업데이트.
--   - 응답 본문에 `createdAt` 이 추가되어도 기존 클라이언트는 무시하므로 backward-safe.
--
-- 참조:
--   - 011_orders_hardening.sql (이전 버전 — DB/H-2 입력 검증 포함)
--   - .claude/memory/project_p2a_review_deferred.md M-3
-- ═══════════════════════════════════════════════════════════════════════════

-- 기존 함수 제거 (반환 타입 변경 필수)
drop function if exists public.create_order(
  uuid, text, text, text, text,
  text, text, text, text, text, text, text,
  public.payment_method, text, text,
  integer, integer, integer, integer,
  text, jsonb
);

create function public.create_order(
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
  total_amount  integer,
  created_at    timestamptz
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_order_id     uuid;
  v_order_no     text;
  v_created_at   timestamptz;
  v_item         jsonb;
  v_items_len    integer;
begin
  -- ── DB/H-2: 입력 검증 — items 타입·길이 ──────────────────────────
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'create_order: p_items must be a jsonb array (got %)', jsonb_typeof(p_items)
      using errcode = 'invalid_parameter_value';
  end if;

  v_items_len := jsonb_array_length(p_items);
  if v_items_len = 0 then
    raise exception 'create_order: p_items must contain at least 1 item'
      using errcode = 'invalid_parameter_value';
  end if;
  if v_items_len > 50 then
    raise exception 'create_order: p_items must contain at most 50 items (got %)', v_items_len
      using errcode = 'invalid_parameter_value';
  end if;

  -- ── orders INSERT ────────────────────────────────────────────────
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
  returning orders.id, orders.order_number, orders.created_at
    into v_order_id, v_order_no, v_created_at;

  -- ── order_items INSERT (반복) ────────────────────────────────────
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

  return query
    select v_order_id, v_order_no, p_total_amount, v_created_at;
end;
$$;

comment on function public.create_order is
  'M-3: 주문 + 주문 아이템 원자 INSERT. 반환값에 created_at 포함 (timezone 일관성).';

-- 권한 재부여 — drop 후 재생성이므로 필수.
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
