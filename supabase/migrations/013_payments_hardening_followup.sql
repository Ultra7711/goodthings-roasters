-- ═══════════════════════════════════════════════════════════════════════════
-- 013_payments_hardening_followup.sql — P2-B Session 6 리뷰 반영
--
-- 목적:
--   012_payments_hardening.sql 의 `apply_webhook_event` / `confirm_payment`
--   RPC 에서 발견된 CRITICAL / HIGH 이슈를 수정한다. 기능 추가 없음, 기존
--   함수의 본문만 재정의하여 동시성·데이터 정합성 결함을 제거한다.
--
-- 이슈 요약 (B-7 3총사 + database-reviewer 4-병렬 리뷰 — 2026-04-16):
--
--   [CRITICAL C-1] apply_webhook_event 잠금 순서 역전
--     기존: INSERT payment_transactions → SELECT orders FOR UPDATE
--     변경: SELECT orders FOR UPDATE → INSERT payment_transactions
--     이유: confirm_payment 는 orders FOR UPDATE 를 먼저 잡고 payments / transactions
--           를 그 뒤에 만진다. apply_webhook_event 가 역순이면 `idx1 → idx2` vs
--           `idx2 → idx1` 패턴이 되어 교차 호출 시 PostgreSQL 교착 감지 → 40P01
--           한 쪽이 롤백된다. 특히 confirm 과 웹훅이 거의 동시 도착할 때 발생.
--           재시도가 있어도 Toss 재시도 간격 안에 수렴 못 하면 유실 위험.
--
--   [CRITICAL C-2] refund_completed 에서 payments 가 FOR UPDATE 없이 UPDATE
--     기존: `update public.payments set refunded_amount = refunded_amount + abs(...)`
--           case 조건 내부에서 refunded_amount 를 다시 읽어 status 분기.
--     변경: `select … from payments where order_id = ... for update` 선제 잠금
--           → 변수에 보관한 금액으로 status 분기 후 UPDATE.
--     이유: 현재 문법도 단일 UPDATE 라 row lock 은 확보되지만, 동일 행에 대한
--           두 번째 UPDATE 가 첫 UPDATE 의 결과를 읽지 않고 snapshot 기반으로
--           compute 되면 partial_refunded / refunded 판정이 흔들릴 수 있다.
--           특히 case 내부에서 refunded_amount 를 다시 참조하므로 planner 가
--           해당 표현을 미리 평가할 여지를 남긴다. 명시 FOR UPDATE 로 봉쇄.
--
--   [HIGH H-2] payment_approved 이벤트에서 payments 행 부재 시 조용히 통과
--     기존: `update public.payments set status = 'approved' where order_id = ...`
--           → payments 가 아직 INSERT 되지 않은 타이밍이면 0 row affected, 그런데
--           orders.status 는 'paid' 로 승격됨. "결제 없는 주문" 불일치 발생.
--     변경: GET FOUND 체크 → 없으면 raise exception 으로 트랜잭션 롤백.
--     이유: §5.3.1 타이밍 역전은 앱 레이어(webhookService.handleCardWebhook)
--           에서 `findPaymentByOrderNumber` 부재 시 503 으로 끊어내고 있다.
--           그럼에도 RPC 자체의 방어도 남겨두어 서비스 우회 경로 차단.
--
--   [HIGH H-5] confirm_payment 의 upsert 가 payment_key 를 무조건 덮어씀
--     기존: on conflict do update set payment_key = excluded.payment_key
--     변경: `payment_key = coalesce(public.payments.payment_key, excluded.payment_key)`
--           기존 값이 있으면 덮지 않는다. MVP 는 1 order ↔ 1 payment UNIQUE 라
--           이 경로는 실서비스에서 발생 안 하지만, confirm 중복 호출 혹은 버그로
--           다른 paymentKey 가 들어와도 payment_transactions 의 "첫 번째 confirm"
--           이 권위로 남는 속성을 보장한다.
--
-- 참조:
--   - docs/payments-flow.md §4.3 / §4.4
--   - docs/adr/ADR-002-payment-webhook-verification.md
--   - 012_payments_hardening.sql (원본)
-- ═══════════════════════════════════════════════════════════════════════════


-- ── §4.3 확장: confirm_payment — upsert 시 payment_key 보존 (H-5) ─────────
create or replace function public.confirm_payment(
  p_order_id          uuid,
  p_payment_key       text,
  p_method            public.payment_method,
  p_webhook_secret    text,
  p_approved_amount   integer,
  p_approved_at       timestamptz,
  p_raw               jsonb
)
returns table (order_number text, status public.order_status)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_current public.order_status;
begin
  -- 행 잠금 (동시 confirm 직렬화)
  select o.status into v_current
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

  -- payments 1:1 upsert — H-5: 기존 payment_key 는 보존(coalesce)
  insert into public.payments (
    order_id, payment_key, method, webhook_secret,
    approved_amount, approved_at, raw_response, status
  )
  values (
    p_order_id, p_payment_key, p_method, p_webhook_secret,
    p_approved_amount, p_approved_at, p_raw, 'approved'
  )
  on conflict (order_id) do update
    set payment_key     = coalesce(public.payments.payment_key, excluded.payment_key),
        webhook_secret  = coalesce(public.payments.webhook_secret, excluded.webhook_secret),
        approved_amount = excluded.approved_amount,
        approved_at     = excluded.approved_at,
        raw_response    = excluded.raw_response,
        status          = 'approved',
        updated_at      = now();

  -- orders.status='paid' (trigger 가 pending→paid 허용 여부 검증)
  update public.orders
    set status = 'paid', updated_at = now()
    where id = p_order_id;

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

comment on function public.confirm_payment is
  '§4.3: Toss confirm 응답을 payments/orders/payment_transactions 에 원자 커밋. '
  '이미 paid 면 멱등 반환. payment_key / webhook_secret 은 기존 값 보존(H-5). '
  'service_role 전용.';


-- ── §4.4 확장: apply_webhook_event — 잠금 순서 + 방어 강화 (C-1/C-2/H-2) ──
create or replace function public.apply_webhook_event(
  p_order_id          uuid,
  p_event_type        public.payment_event_type,
  p_amount            integer,
  p_raw               jsonb,
  p_idempotency_key   text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_current          public.order_status;
  v_payment_row      public.payments%rowtype;
  v_next_refunded    integer;
begin
  -- [C-1] 1단계: orders FOR UPDATE 를 가장 먼저 획득한다.
  --        confirm_payment 와 잠금 순서를 일치시킨다 (orders → payments → transactions).
  select o.status into v_current
    from public.orders o
    where o.id = p_order_id
    for update;

  if not found then
    raise exception 'order not found' using errcode = 'no_data_found';
  end if;

  -- [C-1] 2단계: idempotency UNIQUE 삽입. 중복이면 23505 → 호출자가 catch 해 skip.
  insert into public.payment_transactions (
    order_id, event_type, amount, raw_payload, idempotency_key
  )
  values (
    p_order_id, p_event_type, p_amount, p_raw, p_idempotency_key
  );

  -- 이벤트 → 상태 전이. trigger 가 최종 방어.
  case p_event_type
    when 'payment_approved' then
      if v_current = 'pending' then
        -- [C-2] payments 행 선제 잠금.
        select * into v_payment_row
          from public.payments
          where order_id = p_order_id
          for update;

        -- [H-2] payments 행이 없으면 "결제 없는 주문" 불일치를 막기 위해 롤백.
        --       실서비스에서는 앱 레이어(webhookService.handleCardWebhook)가
        --       `findPaymentByOrderNumber` 부재 시 503 으로 끊어내므로 이 경로는
        --       버그·우회 경로에서만 도달한다.
        if not found then
          raise exception 'payments row missing for payment_approved event'
            using errcode = 'no_data_found';
        end if;

        update public.orders set status = 'paid', updated_at = now() where id = p_order_id;
        update public.payments set status = 'approved', updated_at = now() where order_id = p_order_id;
      end if;

    when 'payment_cancelled' then
      if v_current = 'pending' then
        -- payments 행이 없어도 주문 취소는 진행 (결제 자체가 안 일어났을 수 있음)
        update public.orders set status = 'cancelled', updated_at = now() where id = p_order_id;
        update public.payments
          set status = 'cancelled', updated_at = now()
          where order_id = p_order_id;
      end if;

    when 'refund_completed' then
      -- [C-2] payments 행 선제 잠금 + 변수 기반 분기.
      select * into v_payment_row
        from public.payments
        where order_id = p_order_id
        for update;

      if not found then
        raise exception 'payments row missing for refund_completed event'
          using errcode = 'no_data_found';
      end if;

      v_next_refunded := v_payment_row.refunded_amount + abs(p_amount);

      update public.payments
        set refunded_amount = v_next_refunded,
            status = case
              when v_next_refunded >= v_payment_row.approved_amount then 'refunded'
              else 'partial_refunded'
            end,
            updated_at = now()
        where order_id = p_order_id;

      -- 전액 환불 도달 시에만 orders 도 refunded. 부분환불은 paid 유지.
      if v_next_refunded >= v_payment_row.approved_amount then
        if v_current in ('paid', 'refund_processing') then
          update public.orders set status = 'refunded', updated_at = now() where id = p_order_id;
        end if;
      end if;

    else
      null;  -- webhook_received 등은 로그만 남김
  end case;
end;
$$;

comment on function public.apply_webhook_event is
  '§4.4: Toss 웹훅 이벤트를 orders/payments 상태에 반영. '
  'idempotency_key UNIQUE 로 중복 웹훅 차단. '
  '잠금 순서: orders → payments → transactions (confirm_payment 와 동일, C-1). '
  'payments 부재 시 payment_approved / refund_completed 는 롤백(H-2). '
  'service_role 전용.';
