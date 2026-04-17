-- ═══════════════════════════════════════════════════════════════════════════
-- 016_shipping_dispatch.sql — 배송 출고 (Shipping Dispatch) 인프라
--
-- 목적 (Session 8-B B-2):
--   어드민이 결제 완료(paid) 주문을 배송 중(shipping) 으로 전환할 때
--   송장번호·택배사·출고시각을 원자적으로 기록하고, orders 상태 전이 트리거
--   (012 §4.2) 가 강제하는 `paid → shipping` 룰을 준수한다.
--
-- 설계 결정:
--   A. 컬럼 추가: `orders.shipped_at timestamptz` (출고 시각 감사 추적).
--      기존 `tracking_number`, `carrier` 는 003_orders.sql 에 이미 존재 —
--      재정의하지 않음. `orders_tracking_pair` 제약으로 페어 무결성 유지.
--   B. RPC 원자 커밋: `dispatch_order(p_order_id, p_tracking, p_carrier)`
--      - 행 잠금 (동시 호출 직렬화)
--      - 상태 체크: 'paid' 만 허용 (가상계좌 입금 완료 후 → paid 이미 전환된 상태)
--      - tracking/carrier 저장 + status='shipping' + shipped_at=now()
--      - orders_status_transition_check 트리거가 최종 방어
--   C. 권한: service_role 전용 — API route 가 어드민 API 키 검증 후 호출.
--
-- 에러 매핑:
--   RPC 'order_not_found'      → 404
--   RPC 'illegal_state:{cur}'  → 409 conflict (현재 status 반환)
--   RPC 'invalid_tracking'     → 400 (tracking/carrier 빈 문자열 차단)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. orders.shipped_at 컬럼 추가 ───────────────────────────────────────
alter table public.orders
  add column shipped_at timestamptz;

comment on column public.orders.shipped_at is
  '배송 출고 시각 (status=shipping 전환 시점). 감사 추적 + 배송 리드타임 집계용.';

-- 배송 현황 대시보드용 부분 인덱스 (출고된 주문만)
create index orders_shipped_at_idx
  on public.orders (shipped_at desc)
  where shipped_at is not null;

-- ── 2. RPC: dispatch_order(p_order_id, p_tracking, p_carrier) ─────────────
-- 단일 트랜잭션:
--   (0) 입력 검증 — tracking/carrier 빈 문자열 차단
--   (1) 행 잠금 후 현재 status 조회
--   (2) 'paid' 아니면 raise 'illegal_state:{status}' (409)
--   (3) tracking_number/carrier/shipped_at/status 동시 UPDATE
--       orders_status_transition_check 트리거가 paid→shipping 전이 재검증
--
-- 반환: { order_number, shipped_at }
create or replace function public.dispatch_order(
  p_order_id uuid,
  p_tracking text,
  p_carrier text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_current public.order_status;
  v_order_number text;
  v_shipped_at timestamptz;
begin
  -- (0) 입력 검증
  if p_order_id is null then
    raise exception 'order_id_required' using errcode = '22023';
  end if;
  if p_tracking is null or char_length(btrim(p_tracking)) = 0 then
    raise exception 'invalid_tracking' using errcode = '22023';
  end if;
  if p_carrier is null or char_length(btrim(p_carrier)) = 0 then
    raise exception 'invalid_tracking' using errcode = '22023';
  end if;

  -- (1) 행 잠금 + 현재 status 조회
  select o.status, o.order_number
    into v_current, v_order_number
    from public.orders o
    where o.id = p_order_id
    for update;

  if not found then
    raise exception 'order_not_found' using errcode = 'no_data_found';
  end if;

  -- (2) 상태 체크 — 'paid' 만 출고 대상.
  --     (가상계좌 입금 후 apply_webhook_event 가 payment_approved → paid 전환)
  if v_current <> 'paid' then
    raise exception 'illegal_state:%', v_current using errcode = 'P0001';
  end if;

  -- (3) 원자 UPDATE — 트리거가 전이 룰 재검증
  v_shipped_at := now();
  update public.orders
  set
    tracking_number = btrim(p_tracking),
    carrier = btrim(p_carrier),
    shipped_at = v_shipped_at,
    status = 'shipping'::public.order_status
  where id = p_order_id;

  return jsonb_build_object(
    'order_number', v_order_number,
    'shipped_at', v_shipped_at
  );
end;
$$;

-- ── 3. 실행 권한: service_role 전용 ───────────────────────────────────────
revoke all on function public.dispatch_order(uuid, text, text) from public, authenticated, anon;
grant execute on function public.dispatch_order(uuid, text, text) to service_role;

comment on function public.dispatch_order(uuid, text, text) is
  '배송 출고 원자 커밋 — paid → shipping 전환 + tracking/carrier/shipped_at 저장.
   service_role 전용 (어드민 API 키 검증 후 호출).
   에러: order_not_found (no_data_found) · illegal_state:{status} (P0001) ·
         invalid_tracking (22023) · order_id_required (22023).';
