-- ═══════════════════════════════════════════════════════════════════════════
-- 075_confirm_payment_clear_cart.sql — 결제 성공 시 cart_items 정리 (S292)
--
-- 배경:
--   confirm_payment RPC 가 orders.status='paid' 전환 시 cart_items 를 비우지
--   않음. 모바일에서 결제 완료 후 PC 에서 같은 계정 결제 시도 → PC 가 stale
--   cart_items 를 서버에서 fetch → 주문 요약에 모바일 결제 항목이 부풀어
--   보임 (사용자 보고 — GT-20260528-000071 시나리오).
--
--   useClearCart() (next/src/hooks/useCart.ts:380) 주석은 "주문 RPC 가 이미
--   정리" 한다고 가정했으나, 017_create_order_rpc_created_at.sql 의
--   create_order 와 본 confirm_payment 어디에도 cart_items 삭제 호출이 없음.
--
-- 조치:
--   confirm_payment 본체에 cart_items DELETE 추가 (orders.status='paid' 전환
--   직후 동일 트랜잭션). 결제한 order_items 의 (product_slug, product_volume,
--   item_type, subscription_period) 매칭으로 정확히 해당 항목만 삭제. 미래에
--   부분 결제 도입 시에도 자동 정합.
--
-- Atomic 보장:
--   RPC 단일 트랜잭션 → orders.status='paid' + cart_items DELETE 가 함께
--   커밋되거나 함께 롤백. cart 부분 정리 위험 차단.
--
-- 게스트 분기:
--   회원: orders.user_id NOT NULL → cart_items 삭제
--   게스트: orders.user_id NULL → cart_items 미사용 (localStorage) → skip
--
-- 시그니처 변경 없음 — 본체만 교체. revoke/grant 재선언 불요.
--
-- 참조:
--   - 024_payment_easypay_columns.sql (직전 confirm_payment 본체)
--   - 019_cart_items.sql (cart_items 테이블 + RLS)
--   - next/src/hooks/useCart.ts useClearCart 주석 (별도 commit 으로 정정)
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.confirm_payment(
  p_order_id          uuid,
  p_payment_key       text,
  p_method            public.payment_method,
  p_webhook_secret    text,
  p_approved_amount   integer,
  p_approved_at       timestamptz,
  p_raw               jsonb,
  p_easypay_provider  public.easypay_provider default null
)
returns table (order_number text, status public.order_status)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_current public.order_status;
  v_user_id uuid;
begin
  -- 행 잠금 (동시 confirm 직렬화) — user_id 동시 조회 (cart 정리용)
  select o.status, o.user_id into v_current, v_user_id
    from public.orders o
    where o.id = p_order_id
    for update;

  if not found then
    raise exception 'order not found' using errcode = 'no_data_found';
  end if;

  -- 멱등: 이미 paid 면 조용히 현재 상태 반환 (3중 방어 레이어 2)
  if v_current = 'paid' then
    return query
      select o.order_number, o.status
        from public.orders o
        where o.id = p_order_id;
    return;
  end if;

  if v_current <> 'pending' then
    raise exception 'illegal state for confirm: %', v_current
      using errcode = 'check_violation';
  end if;

  -- payments 1:1 upsert (가상계좌 재발급은 앱 레이어에서 차단 — payments-flow §5.2)
  insert into public.payments (
    order_id, payment_key, method, webhook_secret,
    approved_amount, approved_at, raw_response, status,
    easypay_provider
  )
  values (
    p_order_id, p_payment_key, p_method, p_webhook_secret,
    p_approved_amount, p_approved_at, p_raw, 'approved',
    p_easypay_provider
  )
  on conflict (order_id) do update
    set payment_key       = excluded.payment_key,
        method            = excluded.method,
        webhook_secret    = excluded.webhook_secret,
        approved_amount   = excluded.approved_amount,
        approved_at       = excluded.approved_at,
        raw_response      = excluded.raw_response,
        status            = 'approved',
        easypay_provider  = excluded.easypay_provider,
        updated_at        = now();

  -- orders 갱신:
  -- · status = 'paid' (status_transition trigger 가 pending→paid 검증)
  -- · payment_method/easypay_provider 를 webhook 권위값으로 갱신 (BUG-115)
  -- · method <> 'transfer' 이면 bank_name/depositor_name NULL 클리어
  update public.orders
    set status            = 'paid',
        payment_method    = p_method,
        easypay_provider  = p_easypay_provider,
        bank_name         = case when p_method = 'transfer' then bank_name else null end,
        depositor_name    = case when p_method = 'transfer' then depositor_name else null end,
        updated_at        = now()
    where id = p_order_id;

  -- S292: cart_items 정리 (회원만 — 게스트는 localStorage 사용)
  --       order_items 와 (product_slug, product_volume, item_type,
  --       subscription_period) 매칭으로 결제한 항목만 정확히 삭제.
  --       `is not distinct from` 으로 null-safe 비교 (product_volume /
  --       subscription_period 가 nullable 인 경우 대응).
  if v_user_id is not null then
    delete from public.cart_items ci
    where ci.user_id = v_user_id
      and exists (
        select 1
        from public.order_items oi
        where oi.order_id = p_order_id
          and oi.product_slug = ci.product_slug
          and oi.product_volume is not distinct from ci.product_volume
          and oi.item_type = ci.item_type
          and oi.subscription_period is not distinct from ci.subscription_period
      );
  end if;

  -- payment_transactions 감사 로그. idempotency_key UNIQUE 로 중복 confirm 차단 (레이어 3).
  insert into public.payment_transactions (
    order_id, provider_payment_key, event_type, amount, raw_payload, idempotency_key
  )
  values (
    p_order_id, p_payment_key, 'payment_approved',
    p_approved_amount, p_raw, 'confirm:' || p_payment_key
  );

  return query
    select o.order_number, o.status
      from public.orders o
      where o.id = p_order_id;
end;
$$;

comment on function public.confirm_payment(
  uuid, text, public.payment_method, text, integer, timestamptz, jsonb, public.easypay_provider
) is
  'S292: payment 승인 + orders.status=paid + cart_items 정리 (회원만) 원자 처리. '
  'webhook method/provider 권위값 갱신. service_role 전용.';
