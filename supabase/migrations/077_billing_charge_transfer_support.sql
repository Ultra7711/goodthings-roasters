-- ═══════════════════════════════════════════════════════════════════════════
-- 077_billing_charge_transfer_support.sql — Phase 3-C 흡수 (S294)
--
-- 변경 사항:
--   process_billing_charge_success() 재정의 — method='card' 가드 해제
--   · billing_methods 의 실 method 조회 → payments.method 동적 분기
--   · transfer (계좌이체 빌링) 도 atomic 후처리 지원
--
-- 배경:
--   042 마이그는 Phase 3-A 범위 = card 만 처리 (transfer 는 Phase 3-D carry).
--   S294 — 토스 라이브 신청 카드 + 계좌이체 빌링 둘 다 신청 결정 (ADR-008 §D-2).
--   라이브 심사 1~2달 동안 transfer 백엔드 통합 완료 → 출시 시 두 결제수단 모두 제공.
--
-- 변경 범위:
--   · billing_method 가드 — method='card' 제거 + 실 method 조회 (v_method 추출)
--   · payments INSERT — method 컬럼을 v_method 로 동적 분기
--
-- 무영향:
--   · 시그니처 동일 (p_order_id, p_billing_method_id, p_payment_key, p_total_amount,
--     p_subscription_items, p_raw_response)
--   · 반환 타입 동일 (subscription_ids uuid[], payment_id uuid)
--   · 호출자 (billingService.chargeFirstCycle) 변경 불요 — backend 가 method 알아서 처리
--
-- 참조:
--   - docs/adr/ADR-008-toss-billing-integration.md §D-2 (카드 + 계좌이체 빌링)
--   - supabase/migrations/042_billing_charge_rpc.sql (변경 대상)
-- ═══════════════════════════════════════════════════════════════════════════

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

  -- billing_method 검증 (소유권 + active) + method 동적 조회
  -- S294: method='card' 가드 해제. transfer 빌링도 지원.
  select method into v_method
    from public.billing_methods
   where id = p_billing_method_id
     and user_id = v_user_id
     and deleted_at is null;
  if v_method is null then
    raise exception 'process_billing_charge_success: billing_method invalid (%)', p_billing_method_id
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

  -- payments INSERT — method 동적 (v_method = 'card' | 'transfer')
  insert into public.payments (
    order_id, payment_key, method,
    approved_amount, status, approved_at, raw_response
  ) values (
    p_order_id, p_payment_key, v_method,
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
  '042 정의 · 077 갱신 — 빌링 결제 status=DONE 후 atomic 후처리 (subscriptions INSERT + payments INSERT + orders.status=paid). card + transfer 모두 처리 (S294 Phase 3-C 흡수).';

-- 권한 — 042 와 동일 (재선언 불요. create or replace 는 권한 유지)
