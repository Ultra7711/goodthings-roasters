-- ═══════════════════════════════════════════════════════════════════════════
-- 096_create_order_points.sql — 포인트 사용(redeem) 통합 (Phase 2 · DEC-S325-1)
--
-- 목적 (docs/points-implementation-plan.md §13 Δ1·Δ5):
--   체크아웃 시 포인트를 현금처럼 차감한다. 차감 시점 = 주문 생성(pending)
--   시점(DEC-S325-1) — 생성 시 즉시 `use_points`(FOR UPDATE) 차감으로 중복 사용
--   원천 차단. 주문이 paid 도달 못 하고 폐기되면 097 복원 경로가 되돌린다.
--
-- 변경 사항:
--   1) orders.points_used 컬럼 신설 (Δ5 — discount_amount 재사용 대신 전용 컬럼).
--      total_amount = subtotal + shipping_fee − discount_amount − points_used.
--      orders_total_matches CHECK 재정의 (기존 행 points_used=0 → 불변식 유지).
--   2) create_order RPC v2 — p_points_used 인자 추가 (drop+recreate · 반환 4컬럼 동일).
--      · 포인트 사용은 회원만(p_user_id NOT NULL) — DEC-P6/P7.
--      · 주문 INSERT 직후 use_points(p_user_id, p_points_used, order_id, 'use:'||id)
--        호출. use_points 가 FOR UPDATE + 잔액검증(T2) + 'used' ledger(-N) INSERT.
--        잔액 부족 시 raise → 전체 트랜잭션 롤백(주문 미생성). 원자성.
--      · 총액 무결성은 orders_total_matches CHECK 가 강제(별도 assertion 불요).
--
-- 보안(§3 위협모델):
--   T1 클라 조작 → orderService 가 서버 잔액으로 previewRedeem 재계산 후 호출.
--   T2 초과/음수 → use_points FOR UPDATE 사전검증 + point_balance CHECK(>=0).
--   T3 이중 → use_points idempotency_key='use:'||order_id (주문당 1회).
--
-- 참조:
--   - 042_billing_charge_rpc.sql (직전 create_order 본체 = 현재 정의 · 5컬럼 반환
--     [id·order_number·total_amount·created_at·subscription_count] · subscription INSERT 제거됨)
--   - 017_create_order_rpc_created_at.sql (created_at 반환 추가 · drop+recreate 패턴)
--   - 094_point_rpcs.sql (use_points)
--   - 003_orders.sql (orders_total_matches 원본 CHECK)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. orders.points_used 컬럼 + 총액 불변식 재정의 ───────────────────────
alter table public.orders
  add column points_used integer not null default 0;

comment on column public.orders.points_used is
  '결제 시 사용한 적립 포인트(원 단위). pending 생성 시 use_points 로 차감. '
  'total_amount = subtotal + shipping_fee − discount_amount − points_used.';

alter table public.orders
  add constraint orders_points_used_nonneg check (points_used >= 0);

-- total_amount = 소계 + 배송비 − 할인 − 포인트사용 (기존 행 points_used=0 → 호환)
alter table public.orders
  drop constraint orders_total_matches;

alter table public.orders
  add constraint orders_total_matches check (
    total_amount = subtotal + shipping_fee - discount_amount - points_used
  );

-- 포인트 사용액이 결제 대상액을 넘지 못하게(=total >= 0 backstop · Δ6 ₩0 엣지 방어선)
alter table public.orders
  add constraint orders_points_within_payable check (
    points_used <= subtotal + shipping_fee - discount_amount
  );

-- ── 2. create_order RPC v2 — p_points_used 인자 추가 (drop+recreate) ──────
-- 기존 21-인자 함수 제거 (인자 추가 = 시그니처 변경 → drop 필수)
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
  p_items              jsonb,
  p_points_used        integer       -- NEW(22): 사용 포인트(>=0). >0 이면 회원만.
)
returns table (
  id                  uuid,
  order_number        text,
  total_amount        integer,
  created_at          timestamptz,
  subscription_count  integer        -- 042 cutover 후 항상 0 (호출자 type 호환).
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

  -- ── 포인트 사용 가드 (DEC-P6/P7) ────────────────────────────────
  if p_points_used is null or p_points_used < 0 then
    raise exception 'create_order: p_points_used must be >= 0 (got %)', p_points_used
      using errcode = 'invalid_parameter_value';
  end if;
  if p_points_used > 0 and p_user_id is null then
    raise exception 'create_order: guests cannot redeem points'
      using errcode = 'invalid_parameter_value';
  end if;

  -- ── orders INSERT (points_used 포함 · total 무결성은 CHECK 가 강제) ──
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
    points_used,
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
    p_points_used,
    p_total_amount,
    'pending',
    now(),
    p_terms_version
  )
  returning orders.id, orders.order_number, orders.created_at
    into v_order_id, v_order_no, v_created_at;

  -- ── 포인트 차감 — 주문 생성 직후(order_id 확보) · 원자 ──────────────
  --    use_points: FOR UPDATE 잔액검증(T2) + 'used' ledger(-N) INSERT(T3 멱등).
  --    잔액 부족 시 raise(insufficient_balance) → 본 트랜잭션 전체 롤백(주문 미생성).
  --    아이템 INSERT 전에 호출하여 실패 시 불필요 작업 회피.
  if p_points_used > 0 then
    perform public.use_points(
      p_user_id,
      p_points_used,
      v_order_id,
      'use:' || v_order_id::text,
      'order_checkout_points_used'
    );
  end if;

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

  -- subscription_count 항상 0 (042 cutover · 호출자 type 호환 유지)
  return query
    select v_order_id, v_order_no, p_total_amount, v_created_at, 0;
end;
$$;

comment on function public.create_order is
  'P2(S325): 주문 + 아이템 원자 INSERT + 포인트 사용 차감(use_points). '
  '반환 created_at 포함(017). 회원만 포인트 사용(DEC-P6/P7). service_role 전용.';

-- 권한 재부여 — drop 후 재생성이므로 필수 (22-인자 시그니처)
revoke execute on function public.create_order(
  uuid, text, text, text, text,
  text, text, text, text, text, text, text,
  public.payment_method, text, text,
  integer, integer, integer, integer,
  text, jsonb, integer
) from public, anon, authenticated;

grant execute on function public.create_order(
  uuid, text, text, text, text,
  text, text, text, text, text, text, text,
  public.payment_method, text, text,
  integer, integer, integer, integer,
  text, jsonb, integer
) to service_role;
