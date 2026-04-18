-- ═══════════════════════════════════════════════════════════════════════════
-- 021_session8_13_review_hardening.sql — Session 8~13 4-병렬 리뷰 HARDENING
--
-- 목적:
--   Session 8~13 범위에서 4-병렬 리뷰(security / database / typescript / code)
--   가 발견한 CRITICAL 1 / HIGH 4 건을 마이그레이션 하나로 묶어 처리.
--
-- 이슈:
--   [CRIT-2] apply_webhook_event: raise exception 롤백 → idempotency 재진입
--            → payment_transactions.status 컬럼 도입 + early return
--            (앱 레이어 503 이 선차단 중이나 RPC 경로 방어 유지)
--
--   [H-1]    cart_items_set_updated_at: SECURITY DEFINER + search_path 누락
--            → 001~020 전체 패턴과 일관성 위반, 009 에서 동일 Lint 선례
--
--   [H-2]    profiles_update_admin: 불변 컬럼(id, created_at) 보호 트리거 없음
--            → prevent_profiles_immutable_columns 트리거 추가
--
--   [H-3]    revoke_admin: 마지막 admin 강등 가능
--            → count(*) <= 1 시 raise exception (admin 0명 상태 차단)
--
--   [H-4]    get_refund_ledger: idempotency_key 에 Toss paymentKey 노출
--            → 관리자 API 에서 호출되는 경로이므로 DB 레이어에서 마스킹
--              (앞 4자 + 뒤 4자만 노출, 중간 마스킹)
--
-- 리뷰 참조:
--   memory/review_session8_13_20260417_{security,database,typescript,code}.md
-- ═══════════════════════════════════════════════════════════════════════════


-- ── [H-1] cart_items_set_updated_at 하드닝 ─────────────────────────────
-- SECURITY DEFINER + set search_path 패턴으로 일관성 확보.
-- 기존 트리거 본체는 유지 (로직 변경 없음).
create or replace function public.cart_items_set_updated_at()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_catalog
  as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.cart_items_set_updated_at is
  '[H-1] SECURITY DEFINER + search_path 고정. search_path 하이재킹 방어.';


-- ── [H-2] profiles 불변 컬럼 보호 ──────────────────────────────────────
-- profiles_update_admin RLS 는 admin 에게 행 단위 UPDATE 권한만 부여.
-- WITH CHECK 는 컬럼 단위 제약을 강제하지 못하므로 트리거로 방어.
-- id / created_at 은 어떤 경로로도 변경 불가.
create or replace function public.prevent_profiles_immutable_columns()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_catalog
  as $$
begin
  if new.id is distinct from old.id then
    raise exception 'profiles.id is immutable'
      using errcode = 'insufficient_privilege';
  end if;
  if new.created_at is distinct from old.created_at then
    raise exception 'profiles.created_at is immutable'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_immutable_columns on public.profiles;
create trigger profiles_prevent_immutable_columns
  before update on public.profiles
  for each row execute function public.prevent_profiles_immutable_columns();

comment on function public.prevent_profiles_immutable_columns is
  '[H-2] profiles.id / created_at 불변 보호. profiles_update_admin RLS 보완.';


-- ── [H-3] revoke_admin 마지막 admin 강등 차단 ──────────────────────────
-- admin 이 1명 뿐일 때 강등하면 admin 0명 → grant_admin RPC 도 호출 불가.
-- 복구는 Supabase 대시보드 SQL Editor 수동 승격만 가능.
-- 2인 이상 admin 정책 강제.
create or replace function public.revoke_admin(
  target_id uuid,
  reason text default null
) returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  actor uuid := auth.uid();
  v_admin_count integer;
begin
  if actor is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;
  if not public.is_admin(actor) then
    raise exception 'admin role required' using errcode = 'insufficient_privilege';
  end if;
  if actor = target_id then
    raise exception 'cannot self-revoke admin' using errcode = 'insufficient_privilege';
  end if;

  -- [H-3] 강등 대상이 admin 인지, 마지막 admin 인지 확인.
  select count(*) into v_admin_count
    from public.profiles
    where role = 'admin';

  if v_admin_count <= 1 then
    raise exception 'cannot revoke the last admin (minimum 1 required)'
      using errcode = 'check_violation';
  end if;

  perform set_config('app.allow_role_change', 'true', true);
  update public.profiles set role = 'customer' where id = target_id;
  perform set_config('app.allow_role_change', 'false', true);

  insert into public.admin_audit (actor_id, target_user_id, action, reason)
  values (actor, target_id, 'revoke_admin', reason);
end;
$$;

comment on function public.revoke_admin(uuid, text) is
  'admin 역할 강등. 호출자 본인 admin 필수, self-revoke 차단, 마지막 admin 강등 차단([H-3]). '
  'admin_audit 자동 기록.';


-- ── [H-4] get_refund_ledger idempotency_key 마스킹 ─────────────────────
-- 기존 idempotency_key = 'refund:{paymentKey}:{timestamp}' 형식으로 Toss paymentKey 노출.
-- 마스킹 규칙: 'refund:' prefix 유지, paymentKey 앞 4자 + '*'*N + 뒤 4자 + ':{timestamp}'.
-- 정산 식별자로서의 추적성은 유지 (동일 paymentKey 는 동일 마스킹 결과).
create or replace function public.get_refund_ledger(
  p_from timestamptz,
  p_to   timestamptz
) returns table (
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
    -- [H-4] paymentKey 마스킹. 'refund:ABCD****WXYZ:timestamp' 형태.
    regexp_replace(
      t.idempotency_key,
      '^(refund:)(.{0,4}).*(.{4})(:.*)$',
      '\1\2' || repeat('*', 4) || '\3\4'
    ) as idempotency_key
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
  '[H-4] Phase 2-B B-5 정산: 기간 내 환불 원장. idempotency_key 는 paymentKey 마스킹 적용. '
  'balance_after 는 조회 시점 payments.balance_amount. service_role 전용.';


-- ── [CRIT-2] payment_transactions.status 컬럼 + apply_webhook_event 개선 ───
-- 목적: raise exception 으로 트랜잭션 전체 롤백 시 idempotency_key INSERT 도
--       함께 사라져 재진입이 가능하던 경로를 차단. status 컬럼으로 실패/성공 분기.
--
-- 기존 payment_transactions 행을 'applied' 로 backfill (리뷰 이전 이벤트는 모두 성공).

alter table public.payment_transactions
  add column if not exists status text not null default 'applied'
    check (status in ('applied', 'skipped_missing_payment', 'skipped_state_mismatch'));

comment on column public.payment_transactions.status is
  '[CRIT-2] 이벤트 적용 결과. applied=정상 반영, skipped_missing_payment=payments 행 없음, '
  'skipped_state_mismatch=상태 전이 불가. 앱 레이어 감시 쿼리: WHERE status != ''applied''.';

create index if not exists payment_transactions_status_idx
  on public.payment_transactions (status)
  where status != 'applied';


-- apply_webhook_event: raise exception 대신 status 업데이트 + return.
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

        -- [CRIT-2] payments 행 부재 시 status 업데이트 + 반환 (idempotency 보존).
        --          앱 레이어(webhookService)가 503 으로 선차단 중이나 RPC 경로 방어.
        if not found then
          update public.payment_transactions
            set status = 'skipped_missing_payment'
            where idempotency_key = p_idempotency_key;
          return;
        end if;

        update public.orders   set status = 'paid',     updated_at = now() where id = p_order_id;
        update public.payments set status = 'approved', updated_at = now() where order_id = p_order_id;
      else
        -- pending 이 아닌 상태에서 approved 이벤트는 멱등 skip 으로 기록.
        update public.payment_transactions
          set status = 'skipped_state_mismatch'
          where idempotency_key = p_idempotency_key;
      end if;

    when 'payment_cancelled' then
      if v_current = 'pending' then
        update public.orders set status = 'cancelled', updated_at = now() where id = p_order_id;
        update public.payments
          set status = 'cancelled', updated_at = now()
          where order_id = p_order_id;
      else
        update public.payment_transactions
          set status = 'skipped_state_mismatch'
          where idempotency_key = p_idempotency_key;
      end if;

    when 'refund_completed' then
      select * into v_payment_row
        from public.payments
        where order_id = p_order_id
        for update;

      -- [CRIT-2] payments 부재 시 status 업데이트 + 반환 (idempotency 보존).
      if not found then
        update public.payment_transactions
          set status = 'skipped_missing_payment'
          where idempotency_key = p_idempotency_key;
        return;
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
  '§4.4: Toss 웹훅 이벤트 반영. idempotency_key UNIQUE 로 중복 차단. '
  '[CRIT-2] payments 부재 시 raise 대신 payment_transactions.status 업데이트 후 return — '
  'idempotency 보존. service_role 전용.';


-- ═══════════════════════════════════════════════════════════════════════════
-- 롤백 스니펫 (운영 런북 참조):
--
--   -- CRIT-2 롤백: 013_payments_hardening_followup.sql 의 apply_webhook_event 재적용
--   alter table public.payment_transactions drop column if exists status;
--   drop index if exists public.payment_transactions_status_idx;
--
--   -- H-2 롤백
--   drop trigger if exists profiles_prevent_immutable_columns on public.profiles;
--   drop function if exists public.prevent_profiles_immutable_columns();
--
-- 마이그레이션 021 은 함수·트리거·컬럼 추가만 있어 데이터 손실 없음.
-- ═══════════════════════════════════════════════════════════════════════════
