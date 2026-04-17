-- ═══════════════════════════════════════════════════════════════════════════
-- 014_settlement_report.sql — Phase 2-B / B-5 정산 리포트 RPC
--
-- 목적:
--   어드민용 매출 집계 RPC 4종 + 부분 인덱스 2건을 추가한다.
--
--   RPC 설계 근거: docs/settlement-report.md §2~§3
--   - get_daily_settlement(p_from, p_to, p_tz)  — Q1 "오늘/어제 얼마 팔렸나?"
--   - get_method_breakdown(p_from, p_to)        — Q2 "어떤 결제수단으로 팔렸나?"
--   - get_pending_transfer_snapshot()           — Q3 "지금 입금 대기는?"
--   - get_refund_ledger(p_from, p_to)           — Q4 부분환불 원장
--
-- 보안 모델:
--   - LANGUAGE sql STABLE SECURITY DEFINER + search_path = public, pg_catalog.
--   - revoke execute ... from public, anon, authenticated;
--   - grant  execute ... to service_role;
--   Session 7 단계에서는 Supabase Studio 또는 supabaseAdmin.rpc() 경로로만 호출.
--   Session 9 (F-3) 어드민 가드 도입 이후 /api/admin/reports/settlement/* 래핑.
--
-- 인덱스 2건 (docs/settlement-report.md §4.2):
--   - payments_approved_at_idx                  — Q1·Q2·Q4 approved_at 레인지
--   - payment_transactions_refund_created_at_idx — Q1·Q4 refund 이벤트 시계열
--
-- PII 최소 노출:
--   get_refund_ledger 만 order_number 포함 (운영 필수 · Toss Dashboard 대조).
--   그 외 RPC 는 집계 수치만 반환. raw_response · user_id · guest_email 모두 제외.
--
-- approved_at NULL 폴백 포함 정책 (M-3 폴리시):
--   payments-flow §6.7 — Toss approvedAt 누락 시 서버가 new Date().toISOString() +
--   _fallback.approved_at=true 플래그를 기록. 본 RPC 는 폴백 값도 집계에 포함
--   (approved_at is not null 필터링만). 감사 전용 RPC 는 Phase 3 에서 분리.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- §4.2  인덱스 보강
-- ───────────────────────────────────────────────────────────────────────────

create index if not exists payments_approved_at_idx
  on public.payments (approved_at)
  where approved_at is not null;

create index if not exists payment_transactions_refund_created_at_idx
  on public.payment_transactions (created_at desc)
  where event_type = 'refund_completed';


-- ───────────────────────────────────────────────────────────────────────────
-- §3.2  get_daily_settlement(p_from, p_to, p_tz)
--
-- 기간 내 KST 일별 승인·환불·가상계좌 pending 발급 집계.
-- p_from 포함(>=), p_to 제외(<). p_tz 는 KST 기본.
-- net_amount 는 approved_amount - refund_amount (음수 가능).
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.get_daily_settlement(
  p_from timestamptz,
  p_to   timestamptz,
  p_tz   text default 'Asia/Seoul'
)
returns table (
  bucket_date             date,
  approved_count          integer,
  approved_amount         bigint,
  refund_count            integer,
  refund_amount           bigint,
  net_amount              bigint,
  pending_transfer_count  integer
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with
  -- 승인(approved) 집계: payments.approved_at 기준 KST 버킷팅
  approved_bucket as (
    select
      (p.approved_at at time zone p_tz)::date     as bucket_date,
      count(*)::integer                            as approved_count,
      coalesce(sum(p.approved_amount), 0)::bigint  as approved_amount
    from public.payments p
    where p.approved_at is not null
      and p.approved_at >= p_from
      and p.approved_at <  p_to
      and p.status in ('approved', 'partial_refunded', 'refunded')
    group by 1
  ),
  -- 환불(refund) 집계: payment_transactions.created_at 기준
  refund_bucket as (
    select
      (t.created_at at time zone p_tz)::date      as bucket_date,
      count(*)::integer                            as refund_count,
      coalesce(sum(abs(t.amount)), 0)::bigint      as refund_amount
    from public.payment_transactions t
    where t.event_type = 'refund_completed'
      and t.created_at >= p_from
      and t.created_at <  p_to
    group by 1
  ),
  -- 가상계좌 pending 발급 버킷: orders.created_at 기준
  --
  -- 시맨틱 주의 (db-review M-3):
  --   pending_transfer_count = "해당 일자에 발급되었고 **조회 시점에 여전히** pending 인 가상계좌".
  --   과거 일자 조회 시 그 날 발급된 후 입금/만료되어 상태가 변한 행은 포함되지 않는다.
  --   "발급 당시 건수" 가 아닌 "조회 시점 기준 잔존 건수". 실시간 운영 지표는
  --   get_pending_transfer_snapshot() 을 사용한다.
  pending_bucket as (
    select
      (o.created_at at time zone p_tz)::date      as bucket_date,
      count(*)::integer                            as pending_transfer_count
    from public.orders o
    join public.payments p on p.order_id = o.id
    where o.status = 'pending'
      and p.method = 'transfer'
      and o.created_at >= p_from
      and o.created_at <  p_to
    group by 1
  ),
  -- UNION 후 날짜 축 정합 (어느 한쪽만 있는 날짜도 표시)
  all_dates as (
    select bucket_date from approved_bucket
    union
    select bucket_date from refund_bucket
    union
    select bucket_date from pending_bucket
  )
  select
    d.bucket_date,
    coalesce(a.approved_count, 0)::integer,
    coalesce(a.approved_amount, 0)::bigint,
    coalesce(r.refund_count, 0)::integer,
    coalesce(r.refund_amount, 0)::bigint,
    (coalesce(a.approved_amount, 0) - coalesce(r.refund_amount, 0))::bigint as net_amount,
    coalesce(b.pending_transfer_count, 0)::integer
  from all_dates d
  left join approved_bucket a using (bucket_date)
  left join refund_bucket   r using (bucket_date)
  left join pending_bucket  b using (bucket_date)
  order by d.bucket_date asc;
$$;

revoke execute on function public.get_daily_settlement(timestamptz, timestamptz, text)
  from public, anon, authenticated;
grant  execute on function public.get_daily_settlement(timestamptz, timestamptz, text)
  to service_role;

comment on function public.get_daily_settlement(timestamptz, timestamptz, text) is
  'Phase 2-B B-5 정산: 기간 내 KST 일별 승인·환불·pending 발급 집계. '
  'SECURITY DEFINER + service_role only. '
  'approved_at 은 _fallback.approved_at=true 행도 포함. '
  /* db M-1 정책 (Session 8): 가상계좌 0-amount 행 처리
     - approved_at IS NULL (미입금/발급만) 행은 approved_amount 집계에서 자동 제외
       (WHERE p.approved_at BETWEEN ... 필터). pending_transfer_count 는 별도 집계.
     - approved_amount=0 (회계 0원 승인) 행은 실제 발생 시 정상 승인으로 간주하여
       포함한다 — 미래에 프로모션·전액쿠폰 결제 도입 시 신호 보존이 필요하므로
       추가 필터 없이 그대로 노출. Session 11 결제 훅 최종 연동 시 재검토. */';


-- ───────────────────────────────────────────────────────────────────────────
-- §3.3  get_method_breakdown(p_from, p_to)
--
-- 결제수단(card / transfer / future easy_pay) 별 승인·환불 집계.
-- 반환 행 수 = enum payment_method 의 사용된 값 수 (1~2행).
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.get_method_breakdown(
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  method           public.payment_method,
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
  approved_by_method as (
    select
      p.method,
      count(*)::integer                            as approved_count,
      coalesce(sum(p.approved_amount), 0)::bigint  as approved_amount
    from public.payments p
    where p.approved_at is not null
      and p.approved_at >= p_from
      and p.approved_at <  p_to
      and p.status in ('approved', 'partial_refunded', 'refunded')
    group by p.method
  ),
  refund_by_method as (
    select
      p.method,
      count(*)::integer                            as refund_count,
      coalesce(sum(abs(t.amount)), 0)::bigint      as refund_amount
    from public.payment_transactions t
    -- 주의: payments.order_id 는 UNIQUE (012 §59) → 1 order ↔ 1 payment.
    -- 장래 "1 order 다중 payment" 허용 시 이 조인은 팬아웃 → 집계 중복.
    -- 스키마 변경 시 본 CTE 를 먼저 재검토할 것.
    --
    -- 크로스-피리어드 환불 주의 (db-review H-2):
    -- 환불 시점(t.created_at)만 범위 필터 → 과거 기간에 승인된 결제의 환불이
    -- 현재 기간 refund_by_method 에 집계될 수 있다.
    -- 결과: approved_amount=0, refund_amount>0 인 method 행 (net<0) 정상 출현.
    -- docs/settlement-report.md §9 "크로스-피리어드 환불" 참조.
    join public.payments p on p.order_id = t.order_id
    where t.event_type = 'refund_completed'
      and t.created_at >= p_from
      and t.created_at <  p_to
    group by p.method
  ),
  all_methods as (
    select method from approved_by_method
    union
    select method from refund_by_method
  )
  select
    m.method,
    coalesce(a.approved_count, 0)::integer,
    coalesce(a.approved_amount, 0)::bigint,
    coalesce(r.refund_count, 0)::integer,
    coalesce(r.refund_amount, 0)::bigint,
    (coalesce(a.approved_amount, 0) - coalesce(r.refund_amount, 0))::bigint as net_amount
  from all_methods m
  left join approved_by_method a using (method)
  left join refund_by_method   r using (method)
  order by m.method;
$$;

revoke execute on function public.get_method_breakdown(timestamptz, timestamptz)
  from public, anon, authenticated;
grant  execute on function public.get_method_breakdown(timestamptz, timestamptz)
  to service_role;

comment on function public.get_method_breakdown(timestamptz, timestamptz) is
  'Phase 2-B B-5 정산: 기간 내 결제수단별 승인·환불 집계. '
  'SECURITY DEFINER + service_role only.';


-- ───────────────────────────────────────────────────────────────────────────
-- §3.4  get_pending_transfer_snapshot()
--
-- 현재 시점 가상계좌 미입금 건수·금액 + TTL 임박(24h) + TTL 만료 건수.
-- TTL 7일 고정 (payments-flow §5.2). expired_count > 0 이면 EXPIRED 웹훅 누락 의심.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.get_pending_transfer_snapshot()
returns table (
  total_count           integer,
  total_amount          bigint,
  due_within_24h_count  integer,
  expired_count         integer
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  -- TTL 계산 기준 (db-review H-2):
  --   Toss 가상계좌 TTL = `virtualAccount.dueDate` (≈ 발급 시각 + 7일 기본).
  --   발급 시각은 payments.approved_at 에 기록되므로(= WAITING_FOR_DEPOSIT 진입 시점)
  --   o.created_at 이 아닌 p.approved_at 을 기준으로 만료를 판정해야 실제 Toss TTL 과
  --   일치한다. o.created_at 은 장바구니 → 결제위젯 전환 지연이 포함되어 과다 집계됨.
  with base as (
    select
      p.approved_at,
      p.approved_amount
    from public.orders o
    join public.payments p on p.order_id = o.id
    where o.status = 'pending'
      and p.method  = 'transfer'
      and p.status  = 'approved'   -- WAITING_FOR_DEPOSIT 발급 완료 시점에도 approved 로 기록
      and p.approved_at is not null
  )
  select
    count(*)::integer                                               as total_count,
    coalesce(sum(approved_amount), 0)::bigint                       as total_amount,
    count(*) filter (
      where approved_at <  now() - interval '6 days'
        and approved_at >= now() - interval '7 days'
    )::integer                                                       as due_within_24h_count,
    count(*) filter (where approved_at < now() - interval '7 days')::integer as expired_count
  from base;
$$;

revoke execute on function public.get_pending_transfer_snapshot()
  from public, anon, authenticated;
grant  execute on function public.get_pending_transfer_snapshot()
  to service_role;

comment on function public.get_pending_transfer_snapshot() is
  'Phase 2-B B-5 정산: 현재 시점 가상계좌 pending 스냅샷 (TTL 7일 기준). '
  'TTL 기준 시각 = payments.approved_at (WAITING_FOR_DEPOSIT 발급 시점). '
  'expired_count > 0 이면 Toss EXPIRED 웹훅 누락 의심.';


-- ───────────────────────────────────────────────────────────────────────────
-- §3.5  get_refund_ledger(p_from, p_to)
--
-- 기간 내 환불 이벤트 원장. 부분환불 PARTIAL_CANCELED 다회 구분을 위해
-- idempotency_key 포함. balance_after = payments.balance_amount (조회 시점 잔액).
-- PII: order_number 만 노출 (Toss Dashboard 대조용).
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.get_refund_ledger(
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  transaction_created_at timestamptz,
  order_number           text,
  method                 public.payment_method,
  refund_amount          bigint,
  approved_amount        bigint,
  balance_after          bigint,
  is_partial             boolean,
  idempotency_key        text
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select
    t.created_at                     as transaction_created_at,
    o.order_number,
    p.method,
    abs(t.amount)::bigint             as refund_amount,
    p.approved_amount::bigint,
    p.balance_amount::bigint          as balance_after,
    (p.balance_amount > 0)            as is_partial,
    t.idempotency_key
  from public.payment_transactions t
  join public.orders   o on o.id = t.order_id
  join public.payments p on p.order_id = t.order_id
  where t.event_type = 'refund_completed'
    and t.created_at >= p_from
    and t.created_at <  p_to
  order by t.created_at desc;
$$;

revoke execute on function public.get_refund_ledger(timestamptz, timestamptz)
  from public, anon, authenticated;
grant  execute on function public.get_refund_ledger(timestamptz, timestamptz)
  to service_role;

comment on function public.get_refund_ledger(timestamptz, timestamptz) is
  'Phase 2-B B-5 정산: 기간 내 환불 원장. order_number + idempotency_key 포함. '
  'balance_after 는 조회 시점 payments.balance_amount (과거 이벤트 행도 현재 잔액 반환). '
  'SECURITY NOTE: idempotency_key 는 refund:{paymentKey}:{timestamp} 패턴으로 '
  'Toss paymentKey 가 포함될 수 있어 Session 9 API Route 에서 어드민 응답에 포함 여부 재검토 필요.';


-- ═══════════════════════════════════════════════════════════════════════════
-- 롤백 스니펫 (운영 런북 참조, 자동 실행 안 함):
--
--   drop function if exists public.get_refund_ledger(timestamptz, timestamptz);
--   drop function if exists public.get_pending_transfer_snapshot();
--   drop function if exists public.get_method_breakdown(timestamptz, timestamptz);
--   drop function if exists public.get_daily_settlement(timestamptz, timestamptz, text);
--   drop index if exists public.payment_transactions_refund_created_at_idx;
--   drop index if exists public.payments_approved_at_idx;
--
-- 함수·인덱스만 제거 — 데이터 손실 없음.
-- ═══════════════════════════════════════════════════════════════════════════
