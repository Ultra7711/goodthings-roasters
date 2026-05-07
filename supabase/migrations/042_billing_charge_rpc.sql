-- ═══════════════════════════════════════════════════════════════════════════
-- 042_billing_charge_rpc.sql — Phase 3-A cutover (ADR-008 D-9)
--
-- 변경 사항:
--   1) create_order RPC 재정의 — subscriptions INSERT 블록 제거 (D-9)
--      · 빌링 첫 회차 결제 성공 시점으로 책임 이전
--      · subscription_count 반환값은 0 고정 (호출자 호환 — 후속 정리)
--      · 사전 중복 검증은 빌링 호출 전 billingService 가 SELECT 로 수행
--
--   2) process_billing_charge_success() 신규 — 빌링 결제 성공 atomic 후처리
--      · subscriptions INSERT (active, billing_method_id, next_delivery_at)
--      · orders.status = 'paid'
--      · payments INSERT (method='card' 만 처리, transfer 빌링은 Phase 3-D 후속)
--      · 반환: { subscription_ids: uuid[], payment_id: uuid }
--
--   3) set_default_billing_method() 신규 — default 카드 변경 atomic 처리
--      · partial unique index `billing_methods_user_default_uniq` 보호 하 두 UPDATE
--
-- Cutover 의존:
--   - billingService.ts (chargeFirstCycle / setDefaultBillingMethod) 가 본 RPC 호출
--   - 기존 026 의 subscription INSERT 흐름은 본 마이그레이션 적용 시 사라짐
--   - production 정기 활성 사용자 0 (출시 전) → 회귀 영향 staging 만
--
-- 호출자 영향 (S176 조사):
--   - orderRepo.createOrder: subscription_count = 0 항상 반환 (type 그대로)
--   - OrderCompletePage: "정기배송 N건 등록" 메시지 → 0 분기로 미표시
--     (빌링 success 시점에 별도 안내 추가는 Phase 3-B)
--   - duplicate_subscription error 흐름: 빌링 호출 전 billingService 사전 SELECT 로 이전
--     orderRepo:188-196 의 23505 감지 로직은 dead code (정리 별도 sprint)
--
-- 참조:
--   - docs/adr/ADR-008-toss-billing-integration.md §3.1, §4
--   - 026_create_order_subscription_insert.sql (변경 대상)
--   - 040_billing_methods_schema.sql (billing_methods · subscriptions.billing_method_id)
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. create_order 재정의 (026 → subscription INSERT 제거) ────────────────
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
  id                  uuid,
  order_number        text,
  total_amount        integer,
  created_at          timestamptz,
  subscription_count  integer
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_order_id    uuid;
  v_order_no    text;
  v_created_at  timestamptz;
  v_item        jsonb;
  v_items_len   integer;
begin
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

  -- orders INSERT
  insert into public.orders (
    user_id, guest_email, guest_lookup_pin_hash,
    contact_email, contact_phone,
    shipping_name, shipping_phone, shipping_zipcode,
    shipping_addr1, shipping_addr2,
    shipping_message_code, shipping_message_custom,
    payment_method, bank_name, depositor_name,
    subtotal, shipping_fee, discount_amount, total_amount,
    status, agreed_at, terms_version
  ) values (
    p_user_id, p_guest_email, p_guest_pin_hash,
    p_contact_email, p_contact_phone,
    p_shipping_name, p_shipping_phone, p_shipping_zipcode,
    p_shipping_addr1, nullif(p_shipping_addr2, ''),
    p_shipping_msg_code, p_shipping_msg_cust,
    p_payment_method, p_bank_name, p_depositor_name,
    p_subtotal, p_shipping_fee, p_discount_amount, p_total_amount,
    'pending', now(), p_terms_version
  )
  returning orders.id, orders.order_number, orders.created_at
    into v_order_id, v_order_no, v_created_at;

  -- order_items INSERT (subscription INSERT 는 빌링 결제 성공 시점으로 이전 — D-9)
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.order_items (
      order_id, product_slug, product_name, product_category,
      product_volume, product_image_src, product_image_bg,
      quantity, unit_price, original_unit_price, line_total,
      item_type, subscription_period
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

  -- subscription_count 항상 0 (호출자 type 호환 유지, 의미는 deprecated)
  return query select v_order_id, v_order_no, p_total_amount, v_created_at, 0;
end;
$$;

comment on function public.create_order is
  'D-9 (042): pending order + items 만 INSERT. subscription INSERT 책임은 빌링 결제 성공 시점으로 이전 (process_billing_charge_success). subscription_count 는 항상 0 — 호출자 호환 유지.';

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


-- ── 2. process_billing_charge_success (atomic 후처리) ─────────────────────
-- 빌링 결제 응답 status='DONE' 후 호출. 모든 변경은 트랜잭션 내 atomic.
--
-- p_subscription_items jsonb format:
--   [{ product_slug, product_name, product_volume, product_image_src, cycle }]
--   cycle = '2주' | '4주' | '6주' | '8주' (subscription_period enum)
create or replace function public.process_billing_charge_success(
  p_order_id            uuid,
  p_billing_method_id   uuid,
  p_payment_key         text,
  p_total_amount        integer,
  p_subscription_items  jsonb,
  p_raw_response        jsonb
)
returns table (
  subscription_ids  uuid[],
  payment_id        uuid
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id          uuid;
  v_payment_id       uuid;
  v_sub_id           uuid;
  v_sub_ids          uuid[] := array[]::uuid[];
  v_item             jsonb;
  v_cycle            public.subscription_period;
  v_cycle_days       integer;
begin
  -- order 검증 + user_id 추출
  select user_id into v_user_id
    from public.orders
   where id = p_order_id and status = 'pending'
   for update;
  if v_user_id is null then
    raise exception 'process_billing_charge_success: order not found or not pending (%)', p_order_id
      using errcode = 'no_data_found';
  end if;

  -- billing_method 검증 (소유권 + active)
  if not exists (
    select 1 from public.billing_methods
     where id = p_billing_method_id
       and user_id = v_user_id
       and deleted_at is null
       and method = 'card'  -- Phase 3-A: 카드만 처리. transfer 빌링은 Phase 3-D 후속.
  ) then
    raise exception 'process_billing_charge_success: billing_method invalid or not card (%)', p_billing_method_id
      using errcode = 'no_data_found';
  end if;

  -- subscriptions INSERT (active, billing_method_id, next_delivery_at)
  for v_item in select * from jsonb_array_elements(p_subscription_items)
  loop
    v_cycle := (v_item ->> 'cycle')::public.subscription_period;
    v_cycle_days := case v_cycle
      when '2주' then 14
      when '4주' then 28
      when '6주' then 42
      when '8주' then 56
      else 28
    end;

    -- subscriptions_active_unique (026) 가 race condition 최종 방어.
    -- 사전 SELECT (billingService) + 본 INSERT 사이 중복 발생 시 23505 raise.
    insert into public.subscriptions (
      user_id, initial_order_id,
      product_slug, product_name, product_volume, product_image_src,
      cycle, next_delivery_at, status, billing_method_id
    ) values (
      v_user_id, p_order_id,
      v_item ->> 'product_slug',
      v_item ->> 'product_name',
      nullif(v_item ->> 'product_volume', ''),
      nullif(v_item ->> 'product_image_src', ''),
      v_cycle,
      now() + (v_cycle_days || ' days')::interval,
      'active',
      p_billing_method_id
    )
    returning id into v_sub_id;

    v_sub_ids := array_append(v_sub_ids, v_sub_id);
  end loop;

  -- payments INSERT (method='card' 만 — Phase 3-A 범위)
  insert into public.payments (
    order_id, payment_key, method,
    approved_amount, status, approved_at, raw_response
  ) values (
    p_order_id, p_payment_key, 'card',
    p_total_amount, 'approved', now(), p_raw_response
  )
  returning id into v_payment_id;

  -- orders.status = 'paid' (전이 트리거 통과: pending → paid)
  update public.orders
     set status = 'paid'
   where id = p_order_id;

  return query select v_sub_ids, v_payment_id;
end;
$$;

comment on function public.process_billing_charge_success is
  'D-9 (042): 빌링 결제 status=DONE 후 atomic 후처리 — subscriptions INSERT + payments INSERT + orders.status=paid. method=card 만 처리 (transfer 는 Phase 3-D).';

revoke execute on function public.process_billing_charge_success(
  uuid, uuid, text, integer, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.process_billing_charge_success(
  uuid, uuid, text, integer, jsonb, jsonb
) to service_role;


-- ── 3. set_default_billing_method (default 변경 atomic) ───────────────────
-- partial unique index `billing_methods_user_default_uniq` 보호.
-- 두 UPDATE 순서 (기존 false → 신규 true) 트랜잭션 내 처리.
create or replace function public.set_default_billing_method(
  p_billing_method_id uuid,
  p_user_id           uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  -- 소유권 + active 검증
  if not exists (
    select 1 from public.billing_methods
     where id = p_billing_method_id
       and user_id = p_user_id
       and deleted_at is null
  ) then
    raise exception 'set_default_billing_method: not_found (%)', p_billing_method_id
      using errcode = 'no_data_found';
  end if;

  -- 기존 default false (있을 수도 없을 수도)
  update public.billing_methods
     set is_default = false
   where user_id = p_user_id
     and is_default = true
     and deleted_at is null
     and id <> p_billing_method_id;

  -- 신규 default true
  update public.billing_methods
     set is_default = true
   where id = p_billing_method_id;
end;
$$;

comment on function public.set_default_billing_method is
  'default 카드 변경 atomic — billing_methods_user_default_uniq partial index 보호 하 두 UPDATE 순서 처리.';

revoke execute on function public.set_default_billing_method(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.set_default_billing_method(uuid, uuid)
  to service_role;
