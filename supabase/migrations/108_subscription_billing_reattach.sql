-- ═══════════════════════════════════════════════════════════════════════════
-- 108_subscription_billing_reattach.sql — 정기배송 결제수단 재등록 R-3d (S339)
--
-- 배경:
--   R-2~R-3b(105·106·107)로 자동 청구·복구·dunning·알림 완료. R-3d 는 결제수단이
--   끊긴(detached) 또는 dunning 으로 paused 된 구독을 마이페이지에서 식별하고,
--   토스 위젯 일회성 재등록으로 복구하는 프론트 동선의 DB 레이어다.
--
-- 핵심 사실(설계 근거 · ADR-008 §0):
--   - billing_methods 는 soft delete(deleted_at). FK on delete set null 은 hard delete
--     에서만 발동 → 카드 삭제 시 subscriptions.billing_method_id 는 soft-deleted 카드를
--     계속 가리킴(NOT NULL) → 회차 청구가 'billing_method invalid'(106) 로 실패.
--   - 따라서 "끊김"은 billing_method_id IS NULL 만이 아니라 "가리키는 카드가
--     soft-deleted" 도 포함한다. (NULL 케이스 실재: S336 잔여 refreshing-afternoon)
--   - billing_methods 는 service-role only RLS → 사용자 RLS 클라이언트로 조인 불가.
--     SECURITY DEFINER + auth.uid() 로 본인 구독의 billing 상태만 안전 조회한다.
--
-- 변경:
--   1) get_my_subscription_billing_health() — auth.uid() 기반 본인 구독별 billing_status
--      3-state(ok / detached / payment_failed). DEC-S339-3·4.
--   2) reattach_subscription_billing(p_subscription_id, p_billing_method_id) —
--      소유권·카드 유효성 검증 + billing_method_id 연결 + paused 면 자동 재개
--      (active·paused_at=null·next_delivery=now+cycle, DEC-S339-1·2) + 미해결
--      billing_failures resolve. atomic. 잠금 순서 subscription(105/106/107 규칙).
--
-- 재개 정책(DEC-S339-1): next_delivery_at = now() + cycle_days (다음 정상 주기 이월,
--   즉시 청구 없음). 기존 resumeSubscription·/resume 라우트와 동일 계산.
--
-- 의존: 005(subscriptions·subscription_status) · 040(billing_methods·
--   subscription_billing_failures · subscriptions.billing_method_id) · 107(failures resolve).
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. get_my_subscription_billing_health — 본인 구독 billing 상태 3-state ──
-- RLS 클라이언트(authenticated)가 호출. SECURITY DEFINER 로 billing_methods(service-role
-- only) 와 subscription_billing_failures 를 읽되 auth.uid() 로 본인 구독만 노출.
-- billing_key 등 민감값은 일절 반환하지 않음(상태 라벨만).
create or replace function public.get_my_subscription_billing_health()
returns table (
  subscription_id uuid,
  billing_status  text
)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select
    s.id,
    case
      -- billing_method_id NULL 이거나 가리키는 카드가 soft-deleted → join 결과 NULL
      when bm.id is null then 'detached'
      -- 유효 카드인데 paused + 미해결 실패 큐 존재(dunning·영구실패) → 재등록 권장
      when s.status = 'paused' and exists (
        select 1
          from public.subscription_billing_failures f
         where f.subscription_id = s.id
           and f.resolved_at is null
      ) then 'payment_failed'
      else 'ok'
    end as billing_status
  from public.subscriptions s
  left join public.billing_methods bm
    on bm.id = s.billing_method_id
   and bm.deleted_at is null
  where s.user_id = auth.uid()
    and s.status in ('active', 'paused');
$$;

comment on function public.get_my_subscription_billing_health is
  'R-3d(108): 본인(auth.uid) 구독별 결제수단 상태 3-state(ok/detached/payment_failed). '
  'detached=billing_method NULL 또는 카드 soft-deleted. payment_failed=유효카드+paused+미해결 failure. '
  'SECURITY DEFINER(billing_methods service-role only 우회) · 민감값 미반환. DEC-S339-3·4.';

revoke execute on function public.get_my_subscription_billing_health() from public, anon;
grant execute on function public.get_my_subscription_billing_health() to authenticated;


-- ── 2. reattach_subscription_billing — 결제수단 재연결 + 자동 재개 ──────────
-- 토스 위젯으로 새 빌링키 발급(billing_methods INSERT 는 issueBillingMethod 가 선행) 후,
-- 그 billing_method_id 를 끊긴 구독에 연결한다. paused 였으면 자동 재개(DEC-S339-2).
-- 멱등: 같은 billing_method 로 재호출해도 결과 동일(active 재연결·이미 active 면 교체만).
create or replace function public.reattach_subscription_billing(
  p_subscription_id   uuid,
  p_billing_method_id uuid
)
returns setof public.subscriptions
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid        uuid := auth.uid();
  v_sub        public.subscriptions%rowtype;
  v_bm_exists  boolean;
  v_cycle_days integer;
  v_next       timestamptz;
begin
  if v_uid is null then
    raise exception 'reattach_subscription_billing: unauthorized'
      using errcode = 'insufficient_privilege';
  end if;

  -- subscription 잠금 + 소유권(auth.uid). 잠금 순서: subscription (105/106/107 규칙).
  select * into v_sub
    from public.subscriptions
   where id = p_subscription_id
     and user_id = v_uid
   for update;
  if not found then
    raise exception 'reattach_subscription_billing: subscription not found (%)', p_subscription_id
      using errcode = 'no_data_found';
  end if;

  -- active/paused 만 재연결 대상(cancelled/expired 는 불가).
  if v_sub.status not in ('active', 'paused') then
    raise exception 'reattach_subscription_billing: not reattachable (% : %)', p_subscription_id, v_sub.status
      using errcode = 'check_violation';
  end if;

  -- billing_method 소유권 + 유효성(본인 · soft-delete 아님) 검증.
  select true into v_bm_exists
    from public.billing_methods
   where id = p_billing_method_id
     and user_id = v_uid
     and deleted_at is null;
  if not found then
    raise exception 'reattach_subscription_billing: billing_method invalid (%)', p_billing_method_id
      using errcode = 'no_data_found';
  end if;

  if v_sub.status = 'paused' then
    -- 자동 재개(DEC-S339-1): next_delivery = now + cycle_days(다음 주기 이월·즉시청구 없음).
    -- 005 상태 일관성: active → paused_at NULL, cancelled_at NULL(이미 NULL).
    v_cycle_days := case v_sub.cycle
      when '2주' then 14
      when '4주' then 28
      when '6주' then 42
      when '8주' then 56
      else 28
    end;
    v_next := now() + (v_cycle_days || ' days')::interval;

    update public.subscriptions
       set billing_method_id = p_billing_method_id,
           status            = 'active',
           paused_at         = null,
           next_delivery_at  = v_next
     where id = p_subscription_id
     returning * into v_sub;
  else
    -- active 구독은 결제수단만 교체(next_delivery 유지).
    update public.subscriptions
       set billing_method_id = p_billing_method_id
     where id = p_subscription_id
     returning * into v_sub;
  end if;

  -- dunning 해소: 이 구독의 미해결 실패 큐 마감(재등록=문제 해결).
  update public.subscription_billing_failures
     set resolved_at = now()
   where subscription_id = p_subscription_id
     and resolved_at is null;

  return next v_sub;
  return;
end;
$$;

comment on function public.reattach_subscription_billing is
  'R-3d(108): 끊긴/정지 구독에 새 빌링수단 연결 + paused 면 자동 재개(next=now+cycle, DEC-S339-1·2) '
  '+ 미해결 billing_failures resolve. atomic. 소유권=auth.uid. SECURITY DEFINER. 멱등.';

revoke execute on function public.reattach_subscription_billing(uuid, uuid) from public, anon;
grant execute on function public.reattach_subscription_billing(uuid, uuid) to authenticated;
