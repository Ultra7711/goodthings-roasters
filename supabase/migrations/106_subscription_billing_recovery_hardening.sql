-- ═══════════════════════════════════════════════════════════════════════════
-- 106_subscription_billing_recovery_hardening.sql — 회차 청구 복구 하드닝 (R-2a)
--
-- 배경 (S338 검증 — architect·database·security·silent-failure 4갈래 적대 검증):
--   R-1(105)은 회차 청구 엔진을 추가했으나, 스케줄러로 자동화하기 전에 닫아야 할
--   동시성·복구 갭이 드러났다. 자동화되면 무인(無人)으로 매일 발생하는 결함이다.
--
--   ① 토스 출금 성공 후 process RPC 직전 크래시 → 토스=출금완료, DB=order pending·
--      payments 미기록·next_delivery 미전진 (고아 출금).
--   ② 038(delete_stale_pending_orders)이 30분 후 그 회차 pending 주문을 DELETE →
--      주문 기록까지 소실.
--   ③ 재시도가 새 order_number 로 청구 → 토스 멱등키 동작상 "같은 멱등키 + 다른
--      orderId(body)" = 422 Unprocessable Entity → 자동 복구 불가.
--      (토스 공식: 멱등 판단 = 멱등키+API키+주소+메서드. body(orderId)는 제외 →
--       같은 키 다른 body = 422. https://docs.tosspayments.com/guides/using-api/idempotency-key)
--   ④ process RPC 멱등성 부재 → 재시도 시 payments.payment_key UNIQUE 위반 크래시.
--
-- 해법 (근본: 회차 주문 보존 + 재사용):
--   1) orders.subscription_id 추가 — 회차 주문 ↔ 구독 링크 + 구독당 pending 1건
--      partial unique (동시 INSERT 중복 차단).
--   2) create_recurring_order → get-or-create. 이번 주기 pending 회차 주문이 있으면
--      재사용(같은 order_number) → 재시도가 토스 정상 멱등(첫 결과 반환)으로 복구.
--      FOR UPDATE + get-or-create + partial unique 로 동시성·재시도 모두 직렬화.
--      (별도 advisory lock / last_charge_attempt_at claim 불요 — get-or-create 가 잉여화.)
--   3) process_recurring_billing_charge → payment 사전 체크(이미 있으면 NO-OP) 로 멱등.
--   4) 038 → 회차 주문(subscription_id IS NOT NULL) 은 cleanup 제외(보존).
--
-- 잠금 순서(105 규칙 유지): 정기배송 RPC 는 subscription → orders 순 FOR UPDATE.
--
-- 의존: 003(orders) · 005(subscriptions) · 012(payments UNIQUE) · 105(R-1 RPC).
-- 참조: ~/.claude/plans/reactive-swinging-elephant.md §R-2, memory/project_session337_complete.md
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. orders.subscription_id — 회차 주문 ↔ 구독 링크 ──────────────────────
alter table public.orders
  add column if not exists subscription_id uuid
    references public.subscriptions(id) on delete set null;

comment on column public.orders.subscription_id is
  '회차(2회차+) 주문 ↔ 구독 링크. 일반/첫 회차 주문은 NULL. '
  'get-or-create 재사용 기준 + 038 cleanup 제외 기준(R-2a).';

-- 구독당 미결제(pending) 회차 주문 1건 보장.
-- 부분 인덱스: paid 로 전이되면 조건 탈락 → 다음 회차에 새 pending 생성 가능.
-- 동시 신규 INSERT 의 중복은 23505 로 차단(get-or-create 안전망 — FOR UPDATE 직렬화의 이중 방어).
create unique index if not exists orders_subscription_pending_uniq
  on public.orders(subscription_id)
  where subscription_id is not null and status = 'pending';


-- ── 2. create_recurring_order 재정의 — get-or-create ──────────────────────
-- 105 본문 + 이번 주기 pending 회차 주문 재사용 분기 추가.
-- 시그니처 동일(billingService.chargeRecurringCycle 호출 불변).
--
-- 멱등 2축:
--   · next_delivery_at > now() 가드 → 정상 완료된 주기의 중복 청구 차단(주 방어).
--   · get(재사용) → 결제 실패로 남은 pending 회차 주문을 재시도가 같은 order_number 로
--     재사용 → 토스 멱등키+orderId 둘 다 동일 → 토스 첫 결과 반환(422 회피, 복구).
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
  v_sub             public.subscriptions%rowtype;
  v_method          public.payment_method;
  v_bank_name       text;
  v_subtotal        integer;
  v_total           integer;
  v_order_id        uuid;
  v_order_no        text;
  v_existing_total  integer;
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

  -- 멱등 가드(주 방어): 정상 완료된 주기는 next_delivery_at 이 미래로 전진해 있음.
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

  -- ── GET: 이번 주기 미결제 회차 주문 재사용 (재시도/동시호출 멱등 복구) ──
  -- subscription FOR UPDATE 보유 중이라 동시 신규 진입은 여기서 직렬화된다.
  -- 결제 실패로 남은 pending 회차 주문이 있으면 같은 order_number 로 재사용 →
  -- 토스 멱등키+orderId 동일 → 422 회피 + 중복 출금 0. 금액은 기존 주문 유지(멱등).
  select o.id, o.order_number, o.total_amount
    into v_order_id, v_order_no, v_existing_total
    from public.orders o
   where o.subscription_id = p_subscription_id
     and o.status = 'pending';
  if found then
    return query select v_order_id, v_order_no, v_existing_total;
    return;
  end if;

  -- ── CREATE: 신규 회차 주문 ──
  v_subtotal := v_sub.unit_price * v_sub.quantity;
  v_total    := v_subtotal + p_shipping_fee;

  insert into public.orders (
    user_id, guest_email, guest_lookup_pin_hash,
    contact_email, contact_phone,
    shipping_name, shipping_phone, shipping_zipcode,
    shipping_addr1, shipping_addr2,
    shipping_message_code, shipping_message_custom,
    payment_method, bank_name, depositor_name,
    subtotal, shipping_fee, discount_amount, total_amount,
    status, agreed_at, terms_version, subscription_id
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
    'pending', now(), p_terms_version, p_subscription_id
  )
  returning orders.id, orders.order_number into v_order_id, v_order_no;

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
  'R-1(105)·R-2a(106): 회차 주문 get-or-create. subscription FOR UPDATE + active/스냅샷/빌링수단 '
  '검증 + 멱등 가드(next_delivery_at>now). 이번 주기 pending 회차 주문 있으면 재사용(같은 order_number → '
  '토스 정상 멱등 복구). 금액=스냅샷 단일출처. service_role 전용.';

-- 권한 재부여(create or replace 는 유지하나 명시).
revoke execute on function public.create_recurring_order(
  uuid, text, text, text, text, text, text, text, text, integer, text
) from public, anon, authenticated;
grant execute on function public.create_recurring_order(
  uuid, text, text, text, text, text, text, text, text, integer, text
) to service_role;


-- ── 3. process_recurring_billing_charge 재정의 — payment 사전 체크(멱등) ──
-- 105 본문 + 동일 order 에 payment 가 이미 있으면 NO-OP 반환(재시도 안전).
-- process 는 단일 트랜잭션(payments INSERT + order paid + next_delivery 전진)이라
-- payment 존재 = 전체 완료. 사전 체크로 payment_key UNIQUE 위반 크래시 제거.
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
  v_existing_pid uuid;
  v_cycle_days   integer;
  v_next         timestamptz;
begin
  -- subscription 잠금 (잠금 순서: subscription → orders)
  select * into v_sub
    from public.subscriptions
   where id = p_subscription_id
   for update;
  if not found then
    raise exception 'process_recurring_billing_charge: subscription not found (%)', p_subscription_id
      using errcode = 'no_data_found';
  end if;

  -- order 잠금 (소유권: 같은 user)
  select status into v_order_status
    from public.orders
   where id = p_order_id
     and user_id = v_sub.user_id
   for update;
  if not found then
    raise exception 'process_recurring_billing_charge: order not found (%)', p_order_id
      using errcode = 'no_data_found';
  end if;

  -- 멱등 사전 체크: 이미 결제 처리된 주문이면 NO-OP(재시도/동시호출 안전).
  -- process 는 atomic 이므로 payment 존재 = 전체 완료. 현재 next_delivery 반환.
  select id into v_existing_pid
    from public.payments
   where order_id = p_order_id;
  if found then
    return query select v_existing_pid, v_sub.next_delivery_at;
    return;
  end if;

  -- payment 없는데 order 가 pending 아니면 비정상 상태.
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
  -- 직전 예정일 기준 전진(드리프트 방지). 과도 지연 시 now() 기준 보정.
  v_next := greatest(v_sub.next_delivery_at, now()) + (v_cycle_days || ' days')::interval;

  update public.subscriptions
     set next_delivery_at = v_next,
         last_delivery_at = now()
   where id = p_subscription_id;

  return query select v_payment_id, v_next;
end;
$$;

comment on function public.process_recurring_billing_charge is
  'R-1(105)·R-2a(106): 회차 결제 성공 atomic 후처리 — payments INSERT + orders.status=paid + '
  'next_delivery_at 전진 + last_delivery_at. payment 사전 체크로 멱등(재시도 시 NO-OP). '
  '잠금 순서 subscription→orders. service_role 전용.';

revoke execute on function public.process_recurring_billing_charge(
  uuid, uuid, text, integer, public.payment_method, jsonb
) from public, anon, authenticated;
grant execute on function public.process_recurring_billing_charge(
  uuid, uuid, text, integer, public.payment_method, jsonb
) to service_role;


-- ── 4. delete_stale_pending_orders 재정의 — 회차 주문 보존 ─────────────────
-- 038 본문 + 회차 주문(subscription_id IS NOT NULL) 은 cleanup 제외.
-- 이유: 토스 출금 성공 후 process 실패한 회차 pending 주문을 30분 DELETE 하면
--       고아 출금 + 재시도가 새 order_number 로 422. 보존해야 같은 주문 재사용 복구.
-- 회차 pending 은 get-or-create 로 구독당 1건만 유지되어 누적 폭증 없음.
-- 영구 실패 구독의 잔여 정리는 R-3(dunning paused 전환)에서 처리.
create or replace function public.delete_stale_pending_orders()
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_count integer;
begin
  -- 2-a) 대상 pending 주문에 딸린 subscriptions 명시 DELETE (initial_order 경로 — 첫 주문 한정)
  delete from public.subscriptions s
  using public.orders o
  where s.initial_order_id = o.id
    and o.status = 'pending'
    and o.subscription_id is null
    and o.created_at < now() - interval '30 minutes';

  -- 2-b) pending 주문 DELETE — 회차 주문(subscription_id NOT NULL) 제외(보존)
  delete from public.orders
  where status = 'pending'
    and subscription_id is null
    and created_at < now() - interval '30 minutes';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.delete_stale_pending_orders() is
  'TTL 안전망: 30분 이상 경과된 pending 주문 + 연관 subscription DELETE. '
  '회차 주문(subscription_id NOT NULL)은 제외 — 토스 출금 후 복구 보존(R-2a). pg_cron 15분 주기.';

revoke execute on function public.delete_stale_pending_orders() from public, anon, authenticated;
