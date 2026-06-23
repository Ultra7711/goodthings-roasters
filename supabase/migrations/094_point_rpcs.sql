-- ═══════════════════════════════════════════════════════════════════════════
-- 094_point_rpcs.sql — 포인트 변동 RPC (Phase 1)
--
-- 목적 (docs/points-implementation-plan.md §3·§9):
--   모든 포인트 변동의 단일 경로. 클라이언트·일반 authenticated 는 호출 불가
--   (service_role 전용). orderService(P2)·어드민(P4)·환불 훅(P3)이 호출한다.
--
-- 공통 규약:
--   - SECURITY DEFINER + search_path 고정(092 RLS 우회는 service_role RPC 만).
--   - 멱등(T3): point_ledger.idempotency_key UNIQUE + ON CONFLICT DO NOTHING.
--     중복 호출은 applied=false 로 조용히 반환(이중 적립/사용 방지). 23505 미발생.
--   - 동시성(T2): 잔액 감소 RPC(use/adjust 음수)는 profiles 행 FOR UPDATE 잠금 후
--     사전 잔액 검증. 090 CHECK(>=0) 가 최종 방어선(트리거 동기화 시점).
--   - 잔액 갱신은 093 sync_point_balance 트리거가 ledger INSERT 에 반응해 수행.
--     RPC 는 ledger 에만 INSERT 한다(잔액 직접 UPDATE 안 함).
--
-- 반환: jsonb { applied: bool, ledger_id: uuid|null, balance: int }
--   - applied=false → 멱등 중복(이미 처리됨). balance 는 현재 잔액.
--
-- 에러 매핑(호출자 PostgrestError.code):
--   - user_not_found      → no_data_found
--   - invalid_amount      → 22023
--   - insufficient_balance→ P0001 (use/adjust 음수)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 공통: 현재 잔액 조회 헬퍼(잠금 없음) ──────────────────────────────────
create or replace function public.point_balance_of(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select point_balance from public.profiles where id = p_user_id;
$$;

comment on function public.point_balance_of(uuid) is
  '포인트 잔액 조회 헬퍼(RPC 내부 반환값 구성용). service_role 전용.';

revoke execute on function public.point_balance_of(uuid) from public, anon, authenticated;
grant execute on function public.point_balance_of(uuid) to service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- earn_points — 적립 (결제 확정·행동)
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.earn_points(
  p_user_id         uuid,
  p_amount          integer,
  p_source          public.point_source,
  p_order_id        uuid,
  p_idempotency_key text,
  p_expires_at      timestamptz default null,
  p_description     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_ledger_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'user_not_found' using errcode = 'no_data_found';
  end if;

  insert into public.point_ledger (
    user_id, order_id, event_type, source, amount,
    idempotency_key, expires_at, description
  )
  values (
    p_user_id, p_order_id, 'earned', p_source, p_amount,
    p_idempotency_key, p_expires_at, p_description
  )
  on conflict (idempotency_key) do nothing
  returning id into v_ledger_id;

  -- 멱등 중복(이미 적립됨)
  if v_ledger_id is null then
    return jsonb_build_object(
      'applied', false,
      'ledger_id', null,
      'balance', public.point_balance_of(p_user_id)
    );
  end if;

  return jsonb_build_object(
    'applied', true,
    'ledger_id', v_ledger_id,
    'balance', public.point_balance_of(p_user_id)
  );
end;
$$;

comment on function public.earn_points is
  '포인트 적립(earned). 멱등(idempotency_key). 잔액은 093 트리거가 동기화. service_role 전용.';

revoke execute on function public.earn_points(uuid, integer, public.point_source, uuid, text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.earn_points(uuid, integer, public.point_source, uuid, text, timestamptz, text)
  to service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- use_points — 사용 (결제 시 차감)
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.use_points(
  p_user_id         uuid,
  p_amount          integer,        -- 사용액(양수). ledger 에는 -amount 기록.
  p_order_id        uuid,
  p_idempotency_key text,
  p_description     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_balance   integer;
  v_ledger_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  -- T2 동시성: 잔액 행 잠금 후 사전 검증(동시 use 직렬화)
  select point_balance into v_balance
    from public.profiles where id = p_user_id
    for update;

  if not found then
    raise exception 'user_not_found' using errcode = 'no_data_found';
  end if;

  -- 멱등: 동일 키가 이미 있으면 잔액 재차감 없이 현재 잔액 반환
  if exists (select 1 from public.point_ledger where idempotency_key = p_idempotency_key) then
    return jsonb_build_object('applied', false, 'ledger_id', null, 'balance', v_balance);
  end if;

  if v_balance < p_amount then
    raise exception 'insufficient_balance' using errcode = 'P0001';
  end if;

  insert into public.point_ledger (
    user_id, order_id, event_type, source, amount, idempotency_key, description
  )
  values (
    p_user_id, p_order_id, 'used', 'order', -p_amount, p_idempotency_key, p_description
  )
  returning id into v_ledger_id;

  return jsonb_build_object(
    'applied', true,
    'ledger_id', v_ledger_id,
    'balance', public.point_balance_of(p_user_id)
  );
end;
$$;

comment on function public.use_points is
  '포인트 사용(used, -amount). FOR UPDATE 잠금 + 사전 잔액 검증(T2). 멱등. service_role 전용.';

revoke execute on function public.use_points(uuid, integer, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.use_points(uuid, integer, uuid, text, text)
  to service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- reverse_points — 환불 시 사용분 복원 (Phase 3 주 사용, RPC 는 Phase 1 신설)
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.reverse_points(
  p_user_id         uuid,
  p_amount          integer,        -- 복원액(양수)
  p_order_id        uuid,
  p_idempotency_key text,
  p_reversing_id    uuid default null,
  p_description     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_ledger_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'user_not_found' using errcode = 'no_data_found';
  end if;

  insert into public.point_ledger (
    user_id, order_id, event_type, source, amount,
    idempotency_key, reversing_id, description
  )
  values (
    p_user_id, p_order_id, 'reversed', 'refund', p_amount,
    p_idempotency_key, p_reversing_id, p_description
  )
  on conflict (idempotency_key) do nothing
  returning id into v_ledger_id;

  if v_ledger_id is null then
    return jsonb_build_object('applied', false, 'ledger_id', null, 'balance', public.point_balance_of(p_user_id));
  end if;

  return jsonb_build_object(
    'applied', true,
    'ledger_id', v_ledger_id,
    'balance', public.point_balance_of(p_user_id)
  );
end;
$$;

comment on function public.reverse_points is
  '환불 시 사용 포인트 복원(reversed, +amount). 멱등(이중 복원 차단 T6). service_role 전용.';

revoke execute on function public.reverse_points(uuid, integer, uuid, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.reverse_points(uuid, integer, uuid, text, uuid, text)
  to service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- adjust_points — 어드민 수동 가감 (분쟁/보상)
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.adjust_points(
  p_user_id         uuid,
  p_amount          integer,        -- 가감액(양수=지급, 음수=차감). 0 금지.
  p_idempotency_key text,
  p_description     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_balance   integer;
  v_ledger_id uuid;
begin
  if p_amount is null or p_amount = 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  -- 차감(음수)은 잔액 잠금 + 사전 검증
  select point_balance into v_balance
    from public.profiles where id = p_user_id
    for update;

  if not found then
    raise exception 'user_not_found' using errcode = 'no_data_found';
  end if;

  if exists (select 1 from public.point_ledger where idempotency_key = p_idempotency_key) then
    return jsonb_build_object('applied', false, 'ledger_id', null, 'balance', v_balance);
  end if;

  if p_amount < 0 and v_balance + p_amount < 0 then
    raise exception 'insufficient_balance' using errcode = 'P0001';
  end if;

  insert into public.point_ledger (
    user_id, event_type, source, amount, idempotency_key, description
  )
  values (
    p_user_id, 'adjusted', 'manual', p_amount, p_idempotency_key, p_description
  )
  returning id into v_ledger_id;

  return jsonb_build_object(
    'applied', true,
    'ledger_id', v_ledger_id,
    'balance', public.point_balance_of(p_user_id)
  );
end;
$$;

comment on function public.adjust_points is
  '어드민 수동 가감(adjusted, ±). 음수는 잔액 검증(T2). 멱등. service_role 전용. '
  '어드민 owner-only 가드는 Phase 4 서버 액션에서 적용.';

revoke execute on function public.adjust_points(uuid, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.adjust_points(uuid, integer, text, text)
  to service_role;
