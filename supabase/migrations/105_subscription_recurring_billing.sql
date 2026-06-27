-- ═══════════════════════════════════════════════════════════════════════════
-- 105_subscription_recurring_billing.sql — 정기배송 2회차+ 자동 반복 청구 (R-1)
--
-- 목적:
--   정기배송 첫 회차(빌링키 발급 + 즉시 결제)까지만 구현돼 있던 상태에서,
--   2회차 이후 자동 반복 청구 엔진의 DB 레이어를 추가한다.
--   (스케줄러 pg_cron 자동화는 R-2 별도 마이그.)
--
-- 변경 사항:
--   1) subscriptions 가격/수량 스냅샷 — unit_price · quantity 컬럼 추가 + backfill
--      · 가입 시점 단가/수량 고정(스냅샷). 정기 할인 미적용(현행).
--      · 회차 청구 금액 = unit_price * quantity + 배송비.
--      · nullable 유지(기존 row 안전) + 양수 CHECK. 회차 RPC 가 NULL 거부.
--   2) process_billing_charge_success() 재정의 — 첫 회차 INSERT 시 스냅샷 저장
--      · 시그니처 동일(p_subscription_items jsonb 내용에 unit_price/quantity 추가).
--      · billingService.chargeFirstCycle 가 jsonb 에 두 필드를 함께 전달(코드 동시 수정).
--   3) create_recurring_order() 신규 — 회차 주문(orders + order_items) 원자 생성
--      · subscription FOR UPDATE + active/스냅샷/빌링수단 검증.
--      · 멱등 가드: next_delivery_at > now() 면 already_charged_this_cycle 거부.
--      · 금액(subtotal/total)은 subscription 스냅샷 단일 출처로 RPC 가 계산.
--   4) process_recurring_billing_charge() 신규 — 회차 결제 성공 atomic 후처리
--      · payments INSERT + orders.status=paid + next_delivery_at 전진 + last_delivery_at.
--      · 첫 회차(042/077)와 달리 subscriptions INSERT 안 함(기존 구독 갱신만).
--
-- webhook_secret 주의(S91/S336 경로 동형):
--   payments INSERT 에 webhook_secret 을 넣지 않는다(NULL). 빌링 자동결제는
--   가상계좌(입금대기)가 아니라 즉시 출금형이므로 DEPOSIT_CALLBACK secret 이 없다.
--   단발 계좌이체(confirm_payment 075)·첫 회차(077) 와 동일 패턴.
--   ※ 실 DB 의 payments_virtual_secret_required CHECK 는 012 파일과 달리 완화돼 있음
--      (S91 수동 적용 — 2026-06 DB 직접 확인):
--        CHECK (method <> 'transfer'
--               OR (raw_response -> 'virtualAccount' ->> 'accountNumber') IS NULL
--               OR webhook_secret IS NOT NULL)
--      → 빌링 결제 응답(TossBillingPaymentResponse)에는 virtualAccount 필드가 없으므로
--        accountNumber 가 NULL → transfer 빌링도 webhook_secret 없이 통과(확정).
--      마이그 파일(012)↔DB 정합 회복은 별도 후속(범위 밖).
--
-- 의존:
--   - 003_orders.sql (orders · order_status · payment_method · 채번 트리거)
--   - 004_order_items.sql (order_items · order_item_type · subscription_period)
--   - 005_subscriptions.sql (subscriptions · subscription_status)
--   - 012_payments_hardening.sql (payments · payment_status · 상태전이 트리거)
--   - 040_billing_methods_schema.sql (billing_methods · subscriptions.billing_method_id)
--   - 077_billing_charge_transfer_support.sql (process_billing_charge_success 직전 정의)
--
-- 참조:
--   - docs/adr/ADR-008-toss-billing-integration.md §D-7, §D-8
--   - ~/.claude/plans/reactive-swinging-elephant.md (R-1)
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. subscriptions 가격/수량 스냅샷 ─────────────────────────────────────
alter table public.subscriptions
  add column if not exists unit_price integer,
  add column if not exists quantity   integer;

comment on column public.subscriptions.unit_price is
  '가입 시점 단가 스냅샷(원). 회차 청구 금액 = unit_price * quantity + 배송비. 정기 할인 미적용(현행).';
comment on column public.subscriptions.quantity is
  '가입 시점 수량 스냅샷. 정기배송도 1~99 가변(PurchaseRow). 회차 청구 수량 고정.';

-- 기존 active/paused 구독 backfill — initial_order 의 정기 항목에서 단가/수량 복원.
-- distinct on 으로 (order,상품,주기) 당 1건만 선택(이론적 중복 라인 방어 — 가장 이른 created_at).
update public.subscriptions s
set unit_price = src.unit_price,
    quantity   = src.quantity
from (
  select distinct on (oi.order_id, oi.product_slug, oi.subscription_period)
         oi.order_id, oi.product_slug, oi.subscription_period,
         oi.unit_price, oi.quantity
  from public.order_items oi
  where oi.item_type = 'subscription'
  order by oi.order_id, oi.product_slug, oi.subscription_period, oi.created_at asc
) src
where src.order_id          = s.initial_order_id
  and src.product_slug      = s.product_slug
  and src.subscription_period = s.cycle
  and s.unit_price is null;

-- 양수 CHECK (NULL 허용 — backfill 못한 row 는 회차 RPC 가 거부).
alter table public.subscriptions
  drop constraint if exists subscriptions_unit_price_positive;
alter table public.subscriptions
  add constraint subscriptions_unit_price_positive
    check (unit_price is null or unit_price > 0);

alter table public.subscriptions
  drop constraint if exists subscriptions_quantity_positive;
alter table public.subscriptions
  add constraint subscriptions_quantity_positive
    check (quantity is null or quantity > 0);


-- ── 2. process_billing_charge_success 재정의 (첫 회차 스냅샷 저장) ─────────
-- 077 본문 + subscriptions INSERT 에 unit_price/quantity 추가.
-- p_subscription_items jsonb: [{ product_slug, product_name, product_volume,
--   product_image_src, cycle, unit_price, quantity }]
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
  v_method           public.payment_method;
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

  -- billing_method 검증 (소유권 + active) + method 동적 조회 (077)
  select method into v_method
    from public.billing_methods
   where id = p_billing_method_id
     and user_id = v_user_id
     and deleted_at is null;
  if v_method is null then
    raise exception 'process_billing_charge_success: billing_method invalid (%)', p_billing_method_id
      using errcode = 'no_data_found';
  end if;

  -- subscriptions INSERT (active, billing_method_id, next_delivery_at, 스냅샷)
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

    insert into public.subscriptions (
      user_id, initial_order_id,
      product_slug, product_name, product_volume, product_image_src,
      cycle, next_delivery_at, status, billing_method_id,
      unit_price, quantity
    ) values (
      v_user_id, p_order_id,
      v_item ->> 'product_slug',
      v_item ->> 'product_name',
      nullif(v_item ->> 'product_volume', ''),
      nullif(v_item ->> 'product_image_src', ''),
      v_cycle,
      now() + (v_cycle_days || ' days')::interval,
      'active',
      p_billing_method_id,
      nullif(v_item ->> 'unit_price', '')::integer,
      nullif(v_item ->> 'quantity', '')::integer
    )
    returning id into v_sub_id;

    v_sub_ids := array_append(v_sub_ids, v_sub_id);
  end loop;

  -- payments INSERT — method 동적 (v_method = 'card' | 'transfer'), webhook_secret 없음
  insert into public.payments (
    order_id, payment_key, method,
    approved_amount, status, approved_at, raw_response
  ) values (
    p_order_id, p_payment_key, v_method,
    p_total_amount, 'approved', now(), p_raw_response
  )
  returning id into v_payment_id;

  -- orders.status = 'paid'
  update public.orders
     set status = 'paid'
   where id = p_order_id;

  return query select v_sub_ids, v_payment_id;
end;
$$;

comment on function public.process_billing_charge_success is
  '042 정의 · 077 transfer · 105 스냅샷 — 빌링 첫 회차 status=DONE 후 atomic 후처리. '
  'subscriptions INSERT(unit_price/quantity 스냅샷) + payments INSERT + orders.status=paid. '
  'card + transfer 모두 처리. service_role 전용.';

-- 권한 — 042 와 동일 (create or replace 는 권한 유지).


-- ── 3. create_recurring_order (회차 주문 원자 생성) ──────────────────────
-- 회차 청구 직전 호출. orders(pending) + order_items(정기 1건) 생성.
-- 금액은 subscription 스냅샷 단일 출처로 RPC 가 계산(단가/수량 변조 차단).
-- 배송비(p_shipping_fee)만 호출자가 site_settings 로 계산해 전달.
--
-- 잠금 순서 규칙(deadlock 방지): 본 RPC 와 process_recurring_billing_charge 는
--   모두 subscription → orders 순으로만 FOR UPDATE 한다. 정기배송 관련 신규 RPC 는
--   이 순서를 따를 것(역순 잠금 금지).
create or replace function public.create_recurring_order(
  p_subscription_id  uuid,
  p_contact_email    text,
  p_contact_phone    text,
  p_shipping_name    text,
  p_shipping_phone   text,
  p_shipping_zipcode text,
  p_shipping_addr1   text,
  p_shipping_addr2   text,
  p_product_category text,
  p_shipping_fee     integer,
  p_terms_version    text
)
returns table (
  order_id      uuid,
  order_number  text,
  total_amount  integer
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_sub        public.subscriptions%rowtype;
  v_method     public.payment_method;
  v_bank_name  text;
  v_subtotal   integer;
  v_total      integer;
  v_order_id   uuid;
  v_order_no   text;
begin
  if p_shipping_fee is null or p_shipping_fee < 0 then
    raise exception 'create_recurring_order: invalid shipping_fee (%)', p_shipping_fee
      using errcode = 'invalid_parameter_value';
  end if;

  -- subscription 잠금 + 상태/스냅샷 검증
  select * into v_sub
    from public.subscriptions
   where id = p_subscription_id
   for update;
  if not found then
    raise exception 'create_recurring_order: subscription not found (%)', p_subscription_id
      using errcode = 'no_data_found';
  end if;
  if v_sub.status <> 'active' then
    raise exception 'create_recurring_order: subscription_not_active (% : %)', p_subscription_id, v_sub.status
      using errcode = 'check_violation';
  end if;
  if v_sub.unit_price is null or v_sub.quantity is null then
    raise exception 'create_recurring_order: snapshot_missing (%)', p_subscription_id
      using errcode = 'check_violation';
  end if;
  if v_sub.billing_method_id is null then
    raise exception 'create_recurring_order: billing_method_missing (%)', p_subscription_id
      using errcode = 'check_violation';
  end if;

  -- 멱등 가드: 이번 주기 청구가 끝나면 next_delivery_at 이 미래로 전진한다.
  -- 미래면 이미 청구됨 → 중복 회차 주문 생성 차단(수동 재호출·동시 cron 직렬화).
  if v_sub.next_delivery_at > now() then
    raise exception 'create_recurring_order: already_charged_this_cycle (% : %)', p_subscription_id, v_sub.next_delivery_at
      using errcode = 'check_violation';
  end if;

  -- billing_method active 확인 + 실 method/은행 조회
  select method, bank_name into v_method, v_bank_name
    from public.billing_methods
   where id = v_sub.billing_method_id
     and user_id = v_sub.user_id
     and deleted_at is null;
  if v_method is null then
    raise exception 'create_recurring_order: billing_method invalid (%)', v_sub.billing_method_id
      using errcode = 'no_data_found';
  end if;

  -- 금액 — 스냅샷 단일 출처
  v_subtotal := v_sub.unit_price * v_sub.quantity;
  v_total    := v_subtotal + p_shipping_fee;

  -- orders INSERT (order_number 는 트리거 자동 채번)
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
    v_sub.user_id, null, null,
    p_contact_email, p_contact_phone,
    p_shipping_name, p_shipping_phone, p_shipping_zipcode,
    p_shipping_addr1, nullif(p_shipping_addr2, ''),
    null, null,
    v_method,
    case when v_method = 'transfer' then v_bank_name else null end,
    case when v_method = 'transfer' then p_shipping_name else null end,
    v_subtotal, p_shipping_fee, 0, v_total,
    'pending', now(), p_terms_version
  )
  returning orders.id, orders.order_number into v_order_id, v_order_no;

  -- order_items INSERT (정기 항목 1건 — 스냅샷 기반)
  insert into public.order_items (
    order_id, product_slug, product_name, product_category,
    product_volume, product_image_src, product_image_bg,
    quantity, unit_price, original_unit_price, line_total,
    item_type, subscription_period
  ) values (
    v_order_id, v_sub.product_slug, v_sub.product_name, p_product_category,
    v_sub.product_volume, v_sub.product_image_src, null,
    v_sub.quantity, v_sub.unit_price, v_sub.unit_price, v_subtotal,
    'subscription', v_sub.cycle
  );

  return query select v_order_id, v_order_no, v_total;
end;
$$;

comment on function public.create_recurring_order is
  'R-1 (105): 정기배송 회차 주문(pending) + order_items 원자 생성. subscription FOR UPDATE + '
  'active/스냅샷/빌링수단 검증 + 멱등 가드(next_delivery_at>now 거부). 금액=스냅샷 단일출처. service_role 전용.';

revoke execute on function public.create_recurring_order(
  uuid, text, text, text, text, text, text, text, text, integer, text
) from public, anon, authenticated;

grant execute on function public.create_recurring_order(
  uuid, text, text, text, text, text, text, text, text, integer, text
) to service_role;


-- ── 4. process_recurring_billing_charge (회차 결제 후처리) ────────────────
-- 회차 빌링 결제 status='DONE' 후 호출. payments INSERT + orders.status=paid +
-- subscriptions.next_delivery_at 전진 + last_delivery_at. 모두 atomic.
-- 첫 회차(process_billing_charge_success)와 달리 subscriptions 는 갱신만(INSERT 안 함).
create or replace function public.process_recurring_billing_charge(
  p_order_id        uuid,
  p_subscription_id uuid,
  p_payment_key     text,
  p_total_amount    integer,
  p_method          public.payment_method,
  p_raw_response    jsonb
)
returns table (
  payment_id      uuid,
  next_delivery_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_sub          public.subscriptions%rowtype;
  v_order_status public.order_status;
  v_payment_id   uuid;
  v_cycle_days   integer;
  v_next         timestamptz;
begin
  -- subscription 잠금
  select * into v_sub
    from public.subscriptions
   where id = p_subscription_id
   for update;
  if not found then
    raise exception 'process_recurring_billing_charge: subscription not found (%)', p_subscription_id
      using errcode = 'no_data_found';
  end if;

  -- order 잠금 + pending 가드 (소유권: 같은 user)
  select status into v_order_status
    from public.orders
   where id = p_order_id
     and user_id = v_sub.user_id
   for update;
  if not found then
    raise exception 'process_recurring_billing_charge: order not found (%)', p_order_id
      using errcode = 'no_data_found';
  end if;
  if v_order_status <> 'pending' then
    raise exception 'process_recurring_billing_charge: order not pending (% : %)', p_order_id, v_order_status
      using errcode = 'check_violation';
  end if;

  -- payments INSERT (webhook_secret 없음 — 빌링 출금형)
  insert into public.payments (
    order_id, payment_key, method,
    approved_amount, status, approved_at, raw_response
  ) values (
    p_order_id, p_payment_key, p_method,
    p_total_amount, 'approved', now(), p_raw_response
  )
  returning id into v_payment_id;

  -- orders.status = 'paid'
  update public.orders
     set status = 'paid'
   where id = p_order_id;

  -- subscriptions 갱신 — next_delivery_at 전진 + last_delivery_at
  v_cycle_days := case v_sub.cycle
    when '2주' then 14
    when '4주' then 28
    when '6주' then 42
    when '8주' then 56
    else 28
  end;
  -- 직전 예정일 기준으로 전진(드리프트 방지). 단 과도 지연 시 now() 기준으로 보정.
  v_next := greatest(v_sub.next_delivery_at, now()) + (v_cycle_days || ' days')::interval;

  update public.subscriptions
     set next_delivery_at = v_next,
         last_delivery_at = now()
   where id = p_subscription_id;

  return query select v_payment_id, v_next;
end;
$$;

comment on function public.process_recurring_billing_charge is
  'R-1 (105): 회차 빌링 결제 status=DONE 후 atomic 후처리 — payments INSERT + orders.status=paid + '
  'subscriptions.next_delivery_at 전진 + last_delivery_at. 기존 구독 갱신만(INSERT 안 함). '
  '잠금 순서 subscription→orders. 동시 호출의 중복 결제는 payments.payment_key UNIQUE/orders 1:1 차단. service_role 전용.';

revoke execute on function public.process_recurring_billing_charge(
  uuid, uuid, text, integer, public.payment_method, jsonb
) from public, anon, authenticated;

grant execute on function public.process_recurring_billing_charge(
  uuid, uuid, text, integer, public.payment_method, jsonb
) to service_role;


-- ── 5. payments_virtual_secret_required 정합 (012 파일 stale 복구) ────────
-- 실 DB 제약은 S91(2026-04-27)에서 수동 완화됐으나 마이그 파일(012)은 strict 로 남아
-- 환경 불일치 위험이 있었다(2026-06 DB 직접 확인). 본 마이그가 transfer 빌링 payments
-- INSERT 를 확대(회차 청구)하므로, 파일↔DB 정합 + 로컬/CI 환경 일치를 위해 실 DB 정의로
-- 명시 재선언한다. 빌링 결제 응답에는 virtualAccount 가 없어 transfer 도 통과(즉시 출금형).
-- 일반 가상계좌(virtualAccount.accountNumber 존재)는 여전히 webhook_secret 필수.
alter table public.payments
  drop constraint if exists payments_virtual_secret_required;
alter table public.payments
  add constraint payments_virtual_secret_required check (
    method <> 'transfer'
    or (raw_response -> 'virtualAccount' ->> 'accountNumber') is null
    or webhook_secret is not null
  );
