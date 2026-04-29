-- ═══════════════════════════════════════════════════════════════════════════
-- 026_create_order_subscription_insert.sql — create_order RPC 정기배송 INSERT
--
-- Group B (subscription-full-implementation-plan.md):
--   B-1: subscription item → subscriptions 테이블 자동 INSERT (트랜잭션 내)
--   B-2: next_delivery_at = now() + cycle_days * '1 day'
--        (2주→14일 / 4주→28일 / 6주→42일 / 8주→56일)
--   B-5: unique partial index — 동일 사용자·상품·주기 중복 구독 차단
--
-- 반환값 변경: (id, order_number, total_amount, created_at, subscription_count)
--
-- 주의:
--   - subscription_period='3주' 는 DB enum 에 존재하지 않음 (005 정책).
--     UI 타입(subscription.ts)과 order.ts zod 스키마 모두 '3주' 제거 완료.
--   - 게스트 주문 (p_user_id IS NULL): subscriptions INSERT 스킵
--     (subscriptions.user_id NOT NULL 제약 — 게스트는 회원가입 후 구독 등록).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 기존 함수 제거 (반환 타입 변경 필수) ────────────────────────────────
drop function if exists public.create_order(
  uuid, text, text, text, text,
  text, text, text, text, text, text, text,
  public.payment_method, text, text,
  integer, integer, integer, integer,
  text, jsonb
);

-- ── create_order 재생성 ──────────────────────────────────────────────────
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
  v_order_id            uuid;
  v_order_no            text;
  v_created_at          timestamptz;
  v_item                jsonb;
  v_items_len           integer;
  v_subscription_count  integer := 0;
  v_cycle_days          integer;
begin
  -- ── 입력 검증 (DB/H-2 유지) ─────────────────────────────────────────
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

  -- ── orders INSERT ────────────────────────────────────────────────────
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

  -- ── order_items + subscriptions INSERT (반복) ─────────────────────────
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

    -- B-1/B-2: subscription item 이고 로그인 사용자인 경우 subscriptions INSERT
    if (v_item ->> 'item_type') = 'subscription' and p_user_id is not null then
      -- B-2: 주기별 일수 매핑 (DB enum 4종만 — 3주 없음)
      v_cycle_days := case v_item ->> 'subscription_period'
        when '2주' then 14
        when '4주' then 28
        when '6주' then 42
        when '8주' then 56
        else 28  -- 예외 방어 (zod 에서 이미 걸러짐)
      end;

      -- 중복 구독 시 unique constraint "subscriptions_active_unique" (23505) 발생
      insert into public.subscriptions (
        user_id,
        initial_order_id,
        product_slug,
        product_name,
        product_volume,
        product_image_src,
        cycle,
        next_delivery_at,
        status
      ) values (
        p_user_id,
        v_order_id,
        v_item ->> 'product_slug',
        v_item ->> 'product_name',
        nullif(v_item ->> 'product_volume', ''),
        nullif(v_item ->> 'product_image_src', ''),
        (v_item ->> 'subscription_period')::public.subscription_period,
        now() + (v_cycle_days || ' days')::interval,
        'active'
      );

      v_subscription_count := v_subscription_count + 1;
    end if;
  end loop;

  -- ── 반환 ─────────────────────────────────────────────────────────────
  return query
    select v_order_id, v_order_no, p_total_amount, v_created_at, v_subscription_count;
end;
$$;

comment on function public.create_order is
  'B-1/B-2 (026): 주문 + 주문 아이템 + 정기배송(로그인 사용자) 원자 INSERT.
   반환값에 subscription_count 포함. service_role 전용.';

-- ── 권한 재부여 (drop 후 재생성이므로 필수) ─────────────────────────────
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

-- ── B-5: 동일 사용자·상품·주기 중복 구독 차단 (active 상태 한정) ──────────
-- 위 INSERT 에서 unique violation 발생 시 → orderRepo.ts 가 23505 감지 →
-- OrderServiceError('duplicate_subscription') → 409 conflict 응답.
create unique index if not exists subscriptions_active_unique
  on public.subscriptions (user_id, product_slug, cycle)
  where status = 'active';

comment on index subscriptions_active_unique is
  'B-5 (026): 동일 user·product·cycle 의 active 구독 중복 생성 차단.';
