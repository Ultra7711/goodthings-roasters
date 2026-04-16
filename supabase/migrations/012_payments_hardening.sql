-- ═══════════════════════════════════════════════════════════════════════════
-- 012_payments_hardening.sql — Phase 2-B / B-3 결제 파이프라인 DB 레이어
--
-- 목적:
--   TossPayments confirm API · 웹훅 수신 엔드포인트의 원자성·멱등성·상태 정합성
--   을 DB 레이어에서 강제한다. 앱 레이어(route handler) 는 이 RPC 를 호출하는
--   단일 경로로 수렴하여 authenticated 클라이언트의 직접 UPDATE 를 차단한다.
--
-- 이슈 / 설계 결정 (payments-flow.md v1.0.7 §4 · ADR-002):
--   §4.1 · payments 테이블 신설 (옵션 A: 주문/결제 역할 분리)
--         1 order ↔ 1 payment UNIQUE (MVP). 부분환불·재결제는 payment_transactions
--         로그로 표현. webhook_secret 은 가상계좌 DEPOSIT_CALLBACK 검증용 (카드는 NULL).
--   §4.2 · orders_status_transition_check() BEFORE UPDATE 트리거
--         authenticated 가 우회해 임의 상태 전이 시도 시 RPC 밖에서도 최종 방어.
--   §4.3 · confirm_payment(...) RPC — 원자 커밋
--         SELECT FOR UPDATE 로 행 잠금 → payments upsert → orders.status='paid'
--         → payment_transactions INSERT (idempotency_key='confirm:'||paymentKey).
--         이미 paid 이면 멱등 RETURN. 3중 방어 §3.1.3 중 "레이어 2".
--   §4.4 · apply_webhook_event(...) RPC
--         웹훅 이벤트 → payment_transactions UNIQUE INSERT (멱등성 키로 중복 차단)
--         → 이벤트 타입별 orders · payments 상태 전이.
--   §4.5 · sweep_stale_pending_orders(interval) 함수
--         ⚠️ Fallback 용. **자동 cron 연동 금지**. Phase H 에서 tossClient.getPayment()
--         로 Toss 측 상태 재확인 후 호출하는 앱 엔드포인트가 래핑할 것.
--         블로커 #3 (v1.0.7): 기본 임계값 24h.
--
-- 권한 원칙:
--   - payments 테이블: RLS enable + force + 정책 미선언 = 전면 차단 (service_role 전용).
--   - confirm_payment / apply_webhook_event / sweep_stale_pending_orders:
--     public·anon·authenticated REVOKE + service_role GRANT. SECURITY DEFINER +
--     search_path 고정으로 RLS bypass · 이스케이프 방어.
--
-- 관련 문서:
--   - docs/payments-flow.md v1.0.7 §4 (원문 SQL)
--   - docs/adr/ADR-002-payment-webhook-verification.md §3 (수단별 하이브리드)
--   - docs/backend-architecture-plan.md §6.2 (ADR-002 이관 표기)
--   - 003_orders.sql (order_status · payment_method ENUM)
--   - 006_payment_transactions.sql (payment_event_type ENUM + idempotency_key UNIQUE)
--   - 011_orders_hardening.sql (create_order RPC 단일 경로 패턴)
-- ═══════════════════════════════════════════════════════════════════════════


-- ── §4.1: payment_status ENUM ────────────────────────────────────────────
create type public.payment_status as enum (
  'pending',           -- 결제 승인 전 (가상계좌 입금 대기 포함)
  'approved',          -- 승인 완료
  'partial_refunded',  -- 부분 환불 상태
  'refunded',          -- 전액 환불
  'failed',            -- 승인 실패
  'cancelled'          -- 결제 중단 (EXPIRED/ABORTED)
);


-- ── §4.1: payments 테이블 (1 order ↔ 1 payment) ──────────────────────────
create table public.payments (
  id uuid primary key default gen_random_uuid(),

  -- 1 order ↔ 1 payment UNIQUE. on delete restrict: 결제 이력은 주문 삭제에도 보존.
  order_id uuid not null unique references public.orders(id) on delete restrict,

  -- Toss paymentKey (confirm 성공 후 채움). UNIQUE 는 동일 paymentKey 의 중복 결제 방어.
  payment_key text unique,

  -- orders.payment_method 와 동일. 가상계좌(transfer) 는 webhook_secret 필수.
  method public.payment_method not null,

  -- 가상계좌 DEPOSIT_CALLBACK 검증용. MVP: 평문 저장 + service_role 전용 RLS 로 보호.
  -- Phase 3: pgcrypto 이행 예정 (payments-flow.md §6.5.4~5).
  webhook_secret text,

  approved_amount integer not null check (approved_amount > 0),
  refunded_amount integer not null default 0 check (refunded_amount >= 0),

  -- 실시간 잔액 = 승인 금액 - 환불 금액. GENERATED STORED 로 상시 일치 보장.
  balance_amount integer generated always as (approved_amount - refunded_amount) stored,

  status public.payment_status not null default 'pending',
  approved_at timestamptz,

  -- Toss confirm API 응답 원본 (감사·디버깅용).
  raw_response jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- §4.1 무결성: 환불 누적 ≤ 승인 금액.
  constraint payments_refunded_within_approved
    check (refunded_amount <= approved_amount),

  -- §4.1 무결성: 가상계좌는 webhook_secret 필수 (DEPOSIT_CALLBACK 검증 전제).
  constraint payments_virtual_secret_required
    check (method <> 'transfer' or webhook_secret is not null)
);

create index payments_order_id_idx
  on public.payments(order_id);

create index payments_payment_key_idx
  on public.payments(payment_key)
  where payment_key is not null;

create index payments_status_idx
  on public.payments(status);

comment on table public.payments is
  '결제 단일 소스 오브 트루스. 1 order ↔ 1 payment UNIQUE. '
  'service_role 전용 RLS (정책 미선언 = 전면 차단).';
comment on column public.payments.webhook_secret is
  '가상계좌 DEPOSIT_CALLBACK 검증용 secret. 카드는 NULL. '
  'MVP 평문 저장, Phase 3 pgcrypto 이행 예정.';
comment on column public.payments.balance_amount is
  'GENERATED STORED: approved_amount - refunded_amount. 환불 누적 시 자동 갱신.';
comment on column public.payments.raw_response is
  'Toss /v1/payments/confirm 응답 원본 (jsonb). 감사 로그.';


-- ── §4.1: payments RLS — service_role 전용 ───────────────────────────────
alter table public.payments enable row level security;
alter table public.payments force row level security;
-- 정책 미선언 = 전면 차단. service_role (SECURITY DEFINER RPC 경유) 만 접근.


-- ── payments updated_at 자동 갱신 트리거 ──────────────────────────────────
-- set_updated_at() 는 001_profiles.sql 에 정의된 공용 함수.
create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();


-- ── §4.2: orders 상태 전이 트리거 ────────────────────────────────────────
-- RPC 밖에서 authenticated 가 우회 UPDATE 를 시도하더라도 불법 전이 차단.
-- 전이 매트릭스: payments-flow.md §2.2.
create or replace function public.orders_status_transition_check()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  allowed boolean;
begin
  if OLD.status = NEW.status then
    return NEW;  -- no-op
  end if;

  allowed := case
    when OLD.status = 'pending'           and NEW.status in ('paid', 'cancelled')                          then true
    when OLD.status = 'paid'              and NEW.status in ('shipping', 'refund_requested', 'refunded')   then true
    when OLD.status = 'shipping'          and NEW.status in ('delivered', 'refund_requested')              then true
    when OLD.status = 'delivered'         and NEW.status in ('refund_requested')                           then true
    when OLD.status = 'refund_requested'  and NEW.status in ('refund_processing')                          then true
    when OLD.status = 'refund_processing' and NEW.status in ('refunded')                                   then true
    else false
  end;

  if not allowed then
    raise exception 'illegal order_status transition: % -> %', OLD.status, NEW.status
      using errcode = 'check_violation';
  end if;

  return NEW;
end;
$$;

comment on function public.orders_status_transition_check is
  '§4.2: orders.status 전이 매트릭스 강제. RPC 밖 직접 UPDATE 최종 방어.';

drop trigger if exists orders_status_transition on public.orders;
create trigger orders_status_transition
  before update of status on public.orders
  for each row
  when (OLD.status is distinct from NEW.status)
  execute function public.orders_status_transition_check();


-- ── §4.3: confirm_payment RPC — 원자 커밋 ────────────────────────────────
-- 호출 경로: POST /api/payments/confirm → paymentService.confirm()
-- Toss 승인 응답을 받은 후 원자적으로 payments upsert + orders.status='paid'
-- + payment_transactions INSERT. 3중 멱등 방어 §3.1.3 의 "레이어 2".
create or replace function public.confirm_payment(
  p_order_id          uuid,
  p_payment_key       text,
  p_method            public.payment_method,
  p_webhook_secret    text,        -- 가상계좌만 not null
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

  -- payments 1:1 upsert (가상계좌 재발급은 앱 레이어에서 차단 — §5.2)
  insert into public.payments (
    order_id, payment_key, method, webhook_secret,
    approved_amount, approved_at, raw_response, status
  )
  values (
    p_order_id, p_payment_key, p_method, p_webhook_secret,
    p_approved_amount, p_approved_at, p_raw, 'approved'
  )
  on conflict (order_id) do update
    set payment_key     = excluded.payment_key,
        webhook_secret  = excluded.webhook_secret,
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
  '이미 paid 면 멱등 반환. service_role 전용.';

revoke execute on function public.confirm_payment(
  uuid, text, public.payment_method, text, integer, timestamptz, jsonb
) from public, anon, authenticated;

grant execute on function public.confirm_payment(
  uuid, text, public.payment_method, text, integer, timestamptz, jsonb
) to service_role;


-- ── §4.4: apply_webhook_event RPC ────────────────────────────────────────
-- 호출 경로: POST /api/payments/webhook → paymentRepo.applyWebhookEvent()
-- payment_transactions INSERT 가 idempotency_key UNIQUE 위반 시 23505 → 호출자
-- catch 후 200 skip. 중복 웹훅 자연 흡수.
create or replace function public.apply_webhook_event(
  p_order_id          uuid,
  p_event_type        public.payment_event_type,
  p_amount            integer,         -- 환불 이벤트는 음수 허용 (payment_transactions.amount)
  p_raw               jsonb,
  p_idempotency_key   text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_current public.order_status;
begin
  -- idempotency_key UNIQUE 가 중복 호출을 23505 로 차단. 호출자가 catch 후 skip.
  insert into public.payment_transactions (
    order_id, event_type, amount, raw_payload, idempotency_key
  )
  values (
    p_order_id, p_event_type, p_amount, p_raw, p_idempotency_key
  );

  select o.status into v_current
    from public.orders o
    where o.id = p_order_id
    for update;

  -- 이벤트 → 상태 전이. trigger 가 최종 방어.
  case p_event_type
    when 'payment_approved' then
      if v_current = 'pending' then
        update public.orders set status = 'paid' where id = p_order_id;
        update public.payments set status = 'approved' where order_id = p_order_id;
      end if;

    when 'payment_cancelled' then
      if v_current = 'pending' then
        update public.orders set status = 'cancelled' where id = p_order_id;
        update public.payments set status = 'cancelled' where order_id = p_order_id;
      end if;

    when 'refund_completed' then
      -- 부분환불 누적. 전액 환불 도달 시 status='refunded' 로 승격.
      update public.payments
        set refunded_amount = refunded_amount + abs(p_amount),
            status = case
              when refunded_amount + abs(p_amount) >= approved_amount then 'refunded'
              else 'partial_refunded'
            end,
            updated_at = now()
        where order_id = p_order_id;

      -- 전액 환불 도달 시에만 orders 도 refunded. 부분환불은 paid 유지.
      if exists (
        select 1 from public.payments
        where order_id = p_order_id and status = 'refunded'
      ) then
        if v_current in ('paid', 'refund_processing') then
          update public.orders set status = 'refunded' where id = p_order_id;
        end if;
      end if;

    else
      null;  -- webhook_received 등은 로그만 남김
  end case;
end;
$$;

comment on function public.apply_webhook_event is
  '§4.4: Toss 웹훅 이벤트를 orders/payments 상태에 반영. '
  'idempotency_key UNIQUE 로 중복 웹훅 차단. service_role 전용.';

revoke execute on function public.apply_webhook_event(
  uuid, public.payment_event_type, integer, jsonb, text
) from public, anon, authenticated;

grant execute on function public.apply_webhook_event(
  uuid, public.payment_event_type, integer, jsonb, text
) to service_role;


-- ── §4.5: sweep_stale_pending_orders Fallback 함수 ───────────────────────
-- ⚠️ 주의 (payments-flow.md §4.5):
--   본 함수는 "Toss 재확인 없이 pending 을 일괄 cancel" 하는 단순 Fallback 이다.
--   **자동 cron 연동 금지** — 유저가 실제 결제 완료했으나 서버 지연으로 confirm 이
--   안 된 경우를 cancel 로 오인할 수 있다.
--
--   Phase H (인프라 단계) 도입 시에는 §5.3.2 의 App 레이어 엔드포인트
--   (/api/internal/payments/sweep) 가 tossClient.getPayment() 로 Toss 측 상태를
--   재확인한 뒤 복구·취소를 분기하도록 감싸서 호출해야 한다.
--
--   v1.0.7 블로커 #3 결정: 기본 임계값 24h.
create or replace function public.sweep_stale_pending_orders(
  p_ttl interval default '24 hours'
)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_count integer;
begin
  with s as (
    update public.orders
      set status = 'cancelled', updated_at = now()
      where status = 'pending'
        and created_at < now() - p_ttl
      returning 1
  )
  select count(*) into v_count from s;
  return coalesce(v_count, 0);
end;
$$;

comment on function public.sweep_stale_pending_orders is
  '§4.5 Fallback: TTL 경과 pending 주문을 일괄 cancel. '
  '⚠️ 자동 cron 금지. Phase H 앱 엔드포인트가 Toss 재확인 후 래핑 호출. '
  'v1.0.7 기본 24h.';

revoke execute on function public.sweep_stale_pending_orders(interval)
  from public, anon, authenticated;

grant execute on function public.sweep_stale_pending_orders(interval)
  to service_role;
