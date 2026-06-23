-- ═══════════════════════════════════════════════════════════════════════════
-- 098_complete_delivery_earn.sql — 배송완료 전이 + 적립 훅 (Δ2 · DEC-P1)
--
-- 목적 (docs/points-implementation-plan.md §13 Δ2·Δ3):
--   현 코드에 shipping→delivered 전이 경로가 전혀 없다(어드민 = paid→shipping
--   dispatch_order 뿐). DEC-P1(배송완료 후 적립)을 위해 전이 RPC 를 신설하고,
--   전이와 동시에 적립을 원자 처리한다. 어드민 "배송완료" 버튼은 P4 로 이연.
--
-- 동작 (단일 트랜잭션 · 원자):
--   (1) 행 잠금 + status 조회
--   (2) status='delivered' 면 멱등 no-op 반환(이중 적립 차단)
--   (3) status<>'shipping' 이면 illegal_state(P0001)
--   (4) status='delivered' UPDATE — orders_status_transition_check 트리거 재검증
--   (5) 회원(user_id NOT NULL) + p_earn_amount>0 이면 'earned' ledger INSERT
--       (멱등 idempotency_key='earn:'||order_id). 적립 실패 시 전체 롤백(전이 포함).
--
-- 적립액 산정(Δ3):
--   complete_delivery 는 *기록* 만 한다. 적립액 = computeEarnAmount(subtotal,
--   정책)(pointService 단일 정의)을 앱(deliverOrder 서비스)이 계산해 전달한다.
--   redeem(previewRedeem) 과 동일하게 "TS 순수 함수 = 권위, RPC = 원자 적용" 패턴.
--   게스트(user_id NULL)·정책 OFF 면 앱이 0 을 전달 → 미적립.
--
-- 멱등·만료:
--   earn key='earn:'||order_id (주문당 1회). expires_at = null(DEC-P3 초기 무만료).
--
-- 참조:
--   - 016_shipping_dispatch.sql (dispatch_order · paid→shipping · 패턴)
--   - 012_payments_hardening.sql §4.2 (orders_status_transition_check · delivered 허용)
--   - 094_point_rpcs.sql (earn_points · 멱등 패턴)
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.complete_delivery(
  p_order_id              uuid,
  p_earn_amount           integer,           -- 적립액(>=0). 앱이 computeEarnAmount 로 산정.
  p_earn_idempotency_key  text,
  p_earn_source           public.point_source default 'order'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_status     public.order_status;
  v_user_id    uuid;
  v_order_no   text;
  v_earned     boolean := false;
begin
  if p_order_id is null then
    raise exception 'order_id_required' using errcode = '22023';
  end if;

  -- (1) 행 잠금 + 현재 status 조회
  select o.status, o.user_id, o.order_number
    into v_status, v_user_id, v_order_no
    from public.orders o
    where o.id = p_order_id
    for update;

  if not found then
    raise exception 'order_not_found' using errcode = 'no_data_found';
  end if;

  -- (2) 멱등: 이미 delivered 면 no-op(이중 적립 차단)
  if v_status = 'delivered' then
    return jsonb_build_object(
      'order_number', v_order_no,
      'status', 'delivered',
      'earn_applied', false
    );
  end if;

  -- (3) shipping 만 배송완료 대상
  if v_status <> 'shipping' then
    raise exception 'illegal_state:%', v_status using errcode = 'P0001';
  end if;

  -- (4) 전이 — orders_status_transition_check 가 shipping→delivered 재검증
  update public.orders
    set status = 'delivered', updated_at = now()
    where id = p_order_id;

  -- (5) 적립 — 회원 + 적립액>0. 실패 시 (4) 전이까지 롤백(원자).
  if v_user_id is not null and p_earn_amount is not null and p_earn_amount > 0 then
    insert into public.point_ledger (
      user_id, order_id, event_type, source, amount, idempotency_key, description
    )
    values (
      v_user_id, p_order_id, 'earned', p_earn_source, p_earn_amount,
      p_earn_idempotency_key, 'order_delivered_points_earned'
    )
    on conflict (idempotency_key) do nothing;

    -- 실제 INSERT 됐는지(멱등 중복 아닌지) 확인
    v_earned := found;
  end if;

  return jsonb_build_object(
    'order_number', v_order_no,
    'status', 'delivered',
    'earn_applied', v_earned
  );
end;
$$;

revoke execute on function public.complete_delivery(uuid, integer, text, public.point_source)
  from public, anon, authenticated;
grant execute on function public.complete_delivery(uuid, integer, text, public.point_source)
  to service_role;

comment on function public.complete_delivery(uuid, integer, text, public.point_source) is
  'Δ2(S325): shipping→delivered 전이 + 배송완료 적립(earned) 원자 처리. '
  '적립액은 앱(computeEarnAmount)이 산정·전달. 멱등(earn:||order_id). '
  '어드민 버튼은 P4 이연. service_role 전용. '
  '에러: order_not_found(no_data_found) · illegal_state:{status}(P0001).';
