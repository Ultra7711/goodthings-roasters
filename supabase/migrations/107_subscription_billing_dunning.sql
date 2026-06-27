-- ═══════════════════════════════════════════════════════════════════════════
-- 107_subscription_billing_dunning.sql — 정기배송 dunning R-3a (S338)
--
-- 배경:
--   R-2(105·106)로 회차 자동 청구 + 복구 하드닝 완료. R-3a 는 실패 재시도(dunning)와
--   영구/소진 실패 시 구독 자동 일시정지(paused)를 추가한다. 핵심 가치 = 영구 실패
--   (카드 만료·정지 등) 구독이 매일 무한 재청구되는 것을 차단(silent-failure 지적).
--
-- 변경:
--   1) process_recurring_billing_charge — 성공 시 해당 구독의 미해결
--      subscription_billing_failures 를 resolved_at=now() 로 마감(성공=해소, atomic).
--   2) pause_subscription_for_billing(uuid) 신규 — active 구독을 paused 전환
--      (status='paused', paused_at=now). 005 상태 일관성 제약 충족. 멱등(active 만 전환).
--
-- 재시도/일시정지 정책 (billingErrorPolicy.computeRetryAt 와 정합):
--   - 일시 오류: 24h → 48h → 72h 재시도, 소진(retry_at null) → paused.
--   - 영구 오류: retry_at null → 즉시 paused.
--   - paused 전환은 코드(recordBillingFailure)가 retry_at===null 일 때 본 RPC 호출.
--
-- 잠금 순서(105/106 규칙): subscription → orders. 본 RPC 는 subscription 만 잠금.
-- 의존: 005(subscriptions) · 040(subscription_billing_failures) · 106(process RPC).
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. process_recurring_billing_charge — 성공 시 failures resolve 추가 ────
-- 106 본문 + 정상 결제 후처리 끝에 미해결 failures 마감.
-- (멱등 NO-OP 경로는 이미 처리된 회차 → failures 도 이전에 마감됐으므로 건드리지 않음.)
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
  v_next := greatest(v_sub.next_delivery_at, now()) + (v_cycle_days || ' days')::interval;

  update public.subscriptions
     set next_delivery_at = v_next,
         last_delivery_at = now()
   where id = p_subscription_id;

  -- R-3a: 청구 성공 → 이 구독의 미해결 실패 큐 마감(dunning 해소).
  update public.subscription_billing_failures
     set resolved_at = now()
   where subscription_id = p_subscription_id
     and resolved_at is null;

  return query select v_payment_id, v_next;
end;
$$;

comment on function public.process_recurring_billing_charge is
  'R-1(105)·R-2a(106)·R-3a(107): 회차 결제 성공 atomic 후처리 — payments + orders.paid + '
  'next_delivery 전진 + last_delivery + 미해결 billing_failures resolve. payment 사전체크 멱등. '
  '잠금 순서 subscription→orders. service_role 전용.';

revoke execute on function public.process_recurring_billing_charge(
  uuid, uuid, text, integer, public.payment_method, jsonb
) from public, anon, authenticated;
grant execute on function public.process_recurring_billing_charge(
  uuid, uuid, text, integer, public.payment_method, jsonb
) to service_role;


-- ── 2. pause_subscription_for_billing — 영구/소진 실패 시 구독 일시정지 ────
-- active 구독만 paused 전환(멱등 — paused/cancelled/expired 는 no-op).
-- 005 상태 일관성: paused → paused_at NOT NULL, cancelled_at NULL(active 에서 전환이라 충족).
create or replace function public.pause_subscription_for_billing(
  p_subscription_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_status public.subscription_status;
begin
  select status into v_status
    from public.subscriptions
   where id = p_subscription_id
   for update;
  if not found then
    raise exception 'pause_subscription_for_billing: subscription not found (%)', p_subscription_id
      using errcode = 'no_data_found';
  end if;

  -- active 만 전환(멱등). 이미 paused/cancelled/expired 면 변경 없음.
  if v_status <> 'active' then
    return false;
  end if;

  update public.subscriptions
     set status = 'paused',
         paused_at = now()
   where id = p_subscription_id;

  return true;
end;
$$;

comment on function public.pause_subscription_for_billing is
  'R-3a(107): 빌링 영구/소진 실패 시 active 구독을 paused 전환(무한 재청구 차단). '
  '멱등(active 만 전환). 결제수단 재등록 후 사용자가 재개. service_role 전용.';

revoke execute on function public.pause_subscription_for_billing(uuid)
  from public, anon, authenticated;
grant execute on function public.pause_subscription_for_billing(uuid)
  to service_role;
