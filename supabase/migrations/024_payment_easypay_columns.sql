-- ═══════════════════════════════════════════════════════════════════════════
-- 024_payment_easypay_columns.sql — BUG-115 PR1 / 옵션 Z 확장 (2/2)
--
-- 선행: 023_payment_easypay_enum.sql (payment_method += 'easypay', easypay_provider 신규)
--
-- 변경 사항:
--   1) orders / payments 테이블에 easypay_provider 컬럼 추가 (nullable)
--   2) orders 의 orders_transfer_fields CHECK 제약을 orders_payment_method_fields 로 교체
--      - card     : bank_name/depositor_name/easypay_provider 모두 NULL
--      - transfer : easypay_provider IS NULL (bank_name/depositor_name 는 NULL 허용)
--      - easypay  : bank_name/depositor_name NULL, easypay_provider NOT NULL
--   3) payments 에 method/easypay_provider 정합성 CHECK 추가
--   4) confirm_payment RPC 에 p_easypay_provider 추가 (drop + create — PG 시그니처 변경 제약)
--      - INSERT payments 에 easypay_provider 전달
--      - UPDATE orders 시 payment_method/easypay_provider 를 webhook 권위값으로 갱신,
--        bank_name/depositor_name 은 method <> 'transfer' 면 NULL 클리어
--   5) get_easypay_provider_breakdown(p_from, p_to) 신규 RPC — provider 별 집계
--
-- 호환성 (PR1 단계):
--   - 클라이언트는 여전히 payment_method 'card' | 'transfer' 송신 (PR2 에서 정리).
--   - 백엔드는 client 의 'card'/'transfer' 와 webhook 의 'easypay' 모두 처리:
--     · paymentService.ts 의 method_mismatch 비교 검증을 제거하고,
--     · confirm_payment RPC 가 webhook method/provider 로 orders.payment_method 를 update.
--   - transfer 의 bank_name/depositor_name 강제 NOT NULL 제약 완화 — webhook 이 채울 수
--     있으나 미수신도 가능한 시나리오를 허용 (Step 2 후속 정밀화 여지).
--
-- 데이터 영향 (기존 행):
--   - 모든 기존 orders 행은 payment_method ∈ {'card','transfer'} → 신규 CHECK 만족
--     (card 행: bank/depositor=NULL, transfer 행: bank/depositor 가 NOT NULL 또는 NULL 모두 OK).
--   - 모든 기존 payments 행은 method ∈ {'card','transfer'} → easypay_provider 컬럼은
--     기본값 NULL → 신규 CHECK 만족 (method <> 'easypay' AND easypay_provider IS NULL).
--   - 데이터 손실 위험 없음. 기존 행 모두 신규 제약 조건을 충족.
--
-- 롤백:
--   본 파일 하단 "롤백 스니펫" 참조. enum 자체(023) 는 ADD VALUE 라 롤백 불가하지만
--   본 파일의 컬럼/CHECK/RPC 변경은 모두 가역적.
--
-- 참조:
--   - docs/bug115-payment-easypay-design.md §3 (DB 설계) · §4 (백엔드 코드)
--   - 003_orders.sql §139 orders_transfer_fields (구 제약)
--   - 012_payments_hardening.sql §4.3 confirm_payment (원본 RPC)
--   - 014_settlement_report.sql §3.3 get_method_breakdown (집계 패턴)
--   - 015_account_delete.sql §3 PII 마스킹 (CHECK 호환 확인)
-- ═══════════════════════════════════════════════════════════════════════════


-- ── §1. orders 컬럼 추가 ─────────────────────────────────────────────────
alter table public.orders
  add column if not exists easypay_provider public.easypay_provider;

comment on column public.orders.easypay_provider is
  'payment_method = ''easypay'' 일 때 토스 9종 provider 중 1. 그 외 NULL. '
  'webhook 시점에 confirm_payment RPC 가 권위값으로 갱신.';


-- ── §2. payments 컬럼 추가 ───────────────────────────────────────────────
alter table public.payments
  add column if not exists easypay_provider public.easypay_provider;

comment on column public.payments.easypay_provider is
  'method = ''easypay'' 일 때 토스 9종 provider 중 1. 그 외 NULL. '
  'confirm_payment RPC INSERT 시 채워짐.';


-- ── §3. orders 의 CHECK 제약 교체 ────────────────────────────────────────
-- 003 의 orders_transfer_fields 가 transfer ⇒ bank_name/depositor_name NOT NULL 을
-- 강제했으나, BUG-115 옵션 Z 도입으로 클라이언트가 더 이상 해당 필드를 입력 받지 않는다.
-- 새 제약은 (1) easypay 카테고리 추가, (2) transfer 의 bank/depositor NULL 허용, (3) 각
-- method 별 비호환 컬럼 NULL 강제를 동시에 표현.
alter table public.orders
  drop constraint if exists orders_transfer_fields;

alter table public.orders
  add constraint orders_payment_method_fields check (
    -- card: 결제 정보 컬럼 모두 NULL
    (payment_method = 'card'
      and bank_name is null
      and depositor_name is null
      and easypay_provider is null)
    or
    -- transfer: bank/depositor 는 webhook 으로 채울 수 있고 미수신도 가능 → NULL 허용.
    --           easypay_provider 는 NULL 강제.
    (payment_method = 'transfer'
      and easypay_provider is null)
    or
    -- easypay: provider 필수, bank/depositor NULL.
    (payment_method = 'easypay'
      and bank_name is null
      and depositor_name is null
      and easypay_provider is not null)
  );

comment on constraint orders_payment_method_fields on public.orders is
  'BUG-115 PR1: payment_method ∈ {card, transfer, easypay} 별 부속 컬럼 정합성. '
  'transfer 의 bank/depositor 는 NOT NULL 강제 해제 (webhook 채움 / 미수신 모두 허용).';


-- ── §4. payments method/provider 정합성 CHECK ────────────────────────────
-- payments 테이블도 동일 정합성 강제. method='easypay' ⇔ easypay_provider IS NOT NULL.
alter table public.payments
  add constraint payments_easypay_provider_consistency check (
    (method = 'easypay' and easypay_provider is not null)
    or
    (method <> 'easypay' and easypay_provider is null)
  );

comment on constraint payments_easypay_provider_consistency on public.payments is
  'BUG-115 PR1: method=''easypay'' ⇔ easypay_provider NOT NULL. 그 외 method 는 NULL.';


-- ── §5. confirm_payment RPC 시그니처 확장 ────────────────────────────────
-- 012 §4.3 의 confirm_payment 를 drop + create.
-- 변경:
--   (a) 새 파라미터 p_easypay_provider public.easypay_provider DEFAULT NULL
--   (b) INSERT payments 에 easypay_provider 포함
--   (c) UPDATE orders 시 payment_method/easypay_provider 를 webhook 권위값으로 갱신,
--       method <> 'transfer' 일 때 bank_name/depositor_name 을 NULL 클리어
--   (d) on conflict UPDATE 시에도 easypay_provider 동기화

drop function if exists public.confirm_payment(
  uuid, text, public.payment_method, text, integer, timestamptz, jsonb
);

create function public.confirm_payment(
  p_order_id          uuid,
  p_payment_key       text,
  p_method            public.payment_method,
  p_webhook_secret    text,        -- 가상계좌(transfer)만 not null
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
  --   (CHECK 제약 orders_payment_method_fields 충족용)
  update public.orders
    set status            = 'paid',
        payment_method    = p_method,
        easypay_provider  = p_easypay_provider,
        bank_name         = case when p_method = 'transfer' then bank_name else null end,
        depositor_name    = case when p_method = 'transfer' then depositor_name else null end,
        updated_at        = now()
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

comment on function public.confirm_payment(
  uuid, text, public.payment_method, text, integer, timestamptz, jsonb, public.easypay_provider
) is
  'BUG-115 PR1: §4.3 + easypay_provider 확장. webhook method/provider 가 권위값으로 '
  'orders.payment_method · easypay_provider 갱신. service_role 전용.';

revoke execute on function public.confirm_payment(
  uuid, text, public.payment_method, text, integer, timestamptz, jsonb, public.easypay_provider
) from public, anon, authenticated;

grant execute on function public.confirm_payment(
  uuid, text, public.payment_method, text, integer, timestamptz, jsonb, public.easypay_provider
) to service_role;


-- ── §6. get_easypay_provider_breakdown 신규 RPC ──────────────────────────
-- get_method_breakdown 의 provider 단위 변형. easypay 행만 집계.
-- 환불 집계는 method='easypay' AND provider 매칭으로 join.
create or replace function public.get_easypay_provider_breakdown(
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  provider         public.easypay_provider,
  approved_count   integer,
  approved_amount  bigint,
  refund_count     integer,
  refund_amount    bigint,
  net_amount       bigint
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with
  approved_by_provider as (
    select
      p.easypay_provider                            as provider,
      count(*)::integer                              as approved_count,
      coalesce(sum(p.approved_amount), 0)::bigint    as approved_amount
    from public.payments p
    where p.method = 'easypay'
      and p.easypay_provider is not null
      and p.approved_at is not null
      and p.approved_at >= p_from
      and p.approved_at <  p_to
      and p.status in ('approved', 'partial_refunded', 'refunded')
    group by p.easypay_provider
  ),
  refund_by_provider as (
    -- 크로스-피리어드 환불 주의 (014 §3.3 동일 패턴):
    -- 환불 시점 기준이라 과거 기간에 승인된 결제가 현재 기간 refund 에 들어올 수 있음.
    select
      p.easypay_provider                            as provider,
      count(*)::integer                              as refund_count,
      coalesce(sum(abs(t.amount)), 0)::bigint        as refund_amount
    from public.payment_transactions t
    join public.payments p on p.order_id = t.order_id
    where t.event_type = 'refund_completed'
      and p.method = 'easypay'
      and p.easypay_provider is not null
      and t.created_at >= p_from
      and t.created_at <  p_to
    group by p.easypay_provider
  ),
  all_providers as (
    select provider from approved_by_provider
    union
    select provider from refund_by_provider
  )
  select
    m.provider,
    coalesce(a.approved_count, 0)::integer,
    coalesce(a.approved_amount, 0)::bigint,
    coalesce(r.refund_count, 0)::integer,
    coalesce(r.refund_amount, 0)::bigint,
    (coalesce(a.approved_amount, 0) - coalesce(r.refund_amount, 0))::bigint as net_amount
  from all_providers m
  left join approved_by_provider a using (provider)
  left join refund_by_provider   r using (provider)
  order by m.provider;
$$;

revoke execute on function public.get_easypay_provider_breakdown(timestamptz, timestamptz)
  from public, anon, authenticated;
grant  execute on function public.get_easypay_provider_breakdown(timestamptz, timestamptz)
  to service_role;

comment on function public.get_easypay_provider_breakdown(timestamptz, timestamptz) is
  'BUG-115 PR1 정산: 기간 내 간편결제 provider 별 승인·환불 집계. '
  'SECURITY DEFINER + service_role only. 014 §3.3 get_method_breakdown 의 provider 변형.';


-- ═══════════════════════════════════════════════════════════════════════════
-- 롤백 스니펫 (운영 런북 참조, 자동 실행 안 함):
--
--   -- §6 RPC
--   drop function if exists public.get_easypay_provider_breakdown(timestamptz, timestamptz);
--
--   -- §5 confirm_payment 시그니처 복귀 (012 원본으로)
--   drop function if exists public.confirm_payment(
--     uuid, text, public.payment_method, text, integer, timestamptz, jsonb, public.easypay_provider
--   );
--   -- 012 의 원본 함수를 다시 생성해야 한다 (012_payments_hardening.sql §4.3 복사).
--
--   -- §4 payments CHECK
--   alter table public.payments drop constraint if exists payments_easypay_provider_consistency;
--
--   -- §3 orders CHECK 복귀 (003 원본)
--   alter table public.orders drop constraint if exists orders_payment_method_fields;
--   alter table public.orders add constraint orders_transfer_fields check (
--     (payment_method = 'transfer' and bank_name is not null and depositor_name is not null)
--     or
--     (payment_method = 'card' and bank_name is null and depositor_name is null)
--   );
--   -- 주의: 'easypay' 행이 이미 존재하면 위 제약 추가 시 실패. 사전에 데이터 정리 필요.
--
--   -- §2/§1 컬럼 제거
--   alter table public.payments drop column if exists easypay_provider;
--   alter table public.orders   drop column if exists easypay_provider;
--
--   -- enum 자체 (023) 는 ADD VALUE 후 DROP 불가. 전체 enum 재생성 필요.
-- ═══════════════════════════════════════════════════════════════════════════
