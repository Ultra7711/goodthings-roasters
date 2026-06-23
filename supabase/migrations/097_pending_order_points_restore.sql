-- ═══════════════════════════════════════════════════════════════════════════
-- 097_pending_order_points_restore.sql — pending 폐기 시 사용 포인트 복원 (Δ1)
--
-- 목적 (docs/points-implementation-plan.md §13 Δ1):
--   096 에서 포인트를 주문 생성(pending) 시점에 차감한다. 주문이 paid 도달
--   못 하고 폐기/취소되면 차감분이 영구 손실되므로(point_ledger.order_id 는
--   on delete set null → 복원 없이 삭제 시 잔액만 −N 으로 남음), 모든 pending
--   폐기 경로에서 'reversed'(+N) 복원 ledger 를 삽입한다.
--
-- 폐기 경로 (037/038/012 직독 결과):
--   1) delete_pending_order(신설 RPC) — 유저 명시 이탈(Toss 위젯 이전). 기존
--      앱코드(orderRepo.deletePendingOrderForUser 3-step)를 RPC 로 이관해
--      복원+삭제 원자화.
--   2) delete_stale_pending_orders(038 cron · 15분) — 30분 경과 pending 하드 DELETE.
--   3) sweep_stale_pending_orders(012 fallback · 수동) — pending → cancelled.
--   * 037 cancel_stale_pending_orders 는 038 에서 폐기됨(비활성). 039 는 일회성(적용완료).
--
-- 멱등:
--   복원 ledger idempotency_key = 'restore:'||order_id. 'used' 와 1:1 대응.
--   on conflict do nothing → 동일 주문 이중 복원 차단. 잔액은 093 트리거 동기화.
--
-- 복원 source = 'refund'(090 enum 재사용 · description 으로 사유 구분). 신규
--   enum 값 미추가(KISS). 회원 주문(user_id NOT NULL) + points_used>0 만 대상.
--
-- 참조:
--   - 038_delete_stale_pending_orders.sql (직전 cron 함수)
--   - 012_payments_hardening.sql §4.5 (sweep 원본)
--   - 094_point_rpcs.sql (reverse_points)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. delete_pending_order — 유저 명시 폐기 (복원 + 삭제 원자) ────────────
-- 기존 orderRepo.deletePendingOrderForUser(앱 3-step) 대체. 단일 트랜잭션.
create or replace function public.delete_pending_order(
  p_order_number text,
  p_user_id      uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_id     uuid;
  v_points integer;
begin
  -- 행 잠금 + pending 가드 + 본인 소유 확인
  select id, points_used
    into v_id, v_points
    from public.orders
    where order_number = p_order_number
      and user_id = p_user_id
      and status = 'pending'
    for update;

  if not found then
    return false;  -- 이미 paid 이상이거나 타인/미존재 → no-op
  end if;

  -- 사용 포인트 복원 (회원·points_used>0). order_id 가 살아있을 때 먼저.
  if v_points > 0 then
    perform public.reverse_points(
      p_user_id,
      v_points,
      v_id,
      'restore:' || v_id::text,
      null,
      'pending_order_deleted_points_restored'
    );
  end if;

  -- 연관 subscription 선제 DELETE (042 cutover 후 0 row 영향이나 defensive)
  delete from public.subscriptions where initial_order_id = v_id;

  -- order DELETE — order_items CASCADE · point_ledger.order_id SET NULL
  delete from public.orders where id = v_id;

  return true;
end;
$$;

revoke execute on function public.delete_pending_order(text, uuid)
  from public, anon, authenticated;
grant execute on function public.delete_pending_order(text, uuid)
  to service_role;

comment on function public.delete_pending_order(text, uuid) is
  'Δ1: 유저 pending 주문 폐기 — 사용 포인트 복원(reversed) + subscription/order '
  'DELETE 원자. 멱등(restore:||order_id). service_role 전용.';


-- ── 2. delete_stale_pending_orders v2 — TTL DELETE + 복원 (038 대체 본체) ──
-- 시그니처 동일 → create or replace. cron 재등록 불요(jobname 유지).
create or replace function public.delete_stale_pending_orders()
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_count integer;
begin
  -- 2-0) 복원: 삭제 대상과 동일 조건(회원·points_used>0)의 사용 포인트 되돌림.
  --      DELETE 보다 먼저(order_id 살아있을 때). 멱등(restore:||id).
  insert into public.point_ledger (
    user_id, order_id, event_type, source, amount, idempotency_key, description
  )
  select o.user_id, o.id, 'reversed', 'refund', o.points_used,
         'restore:' || o.id::text, 'stale_pending_deleted_points_restored'
    from public.orders o
    where o.status = 'pending'
      and o.created_at < now() - interval '30 minutes'
      and o.user_id is not null
      and o.points_used > 0
  on conflict (idempotency_key) do nothing;

  -- 2-a) 대상 pending 주문에 딸린 subscriptions 명시 DELETE
  delete from public.subscriptions s
  using public.orders o
  where s.initial_order_id = o.id
    and o.status = 'pending'
    and o.created_at < now() - interval '30 minutes';

  -- 2-b) pending 주문 DELETE (order_items CASCADE · point_ledger.order_id SET NULL)
  delete from public.orders
  where status = 'pending'
    and created_at < now() - interval '30 minutes';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.delete_stale_pending_orders() from public, anon, authenticated;

comment on function public.delete_stale_pending_orders() is
  'TTL 안전망(S173): 30분 경과 pending 주문 + 연관 subscription DELETE. '
  'S325: 삭제 전 사용 포인트 복원(reversed). pg_cron 15분 주기.';


-- ── 3. sweep_stale_pending_orders v2 — TTL cancel + 복원 (012 대체 본체) ───
-- ⚠️ 자동 cron 금지(012 §4.5 유지). 수동 fallback 엔드포인트가 Toss 재확인 후 래핑.
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
  -- 복원: cancel 대상의 사용 포인트 되돌림(cancel 은 order 보존 → order_id 유지).
  insert into public.point_ledger (
    user_id, order_id, event_type, source, amount, idempotency_key, description
  )
  select o.user_id, o.id, 'reversed', 'refund', o.points_used,
         'restore:' || o.id::text, 'sweep_pending_cancelled_points_restored'
    from public.orders o
    where o.status = 'pending'
      and o.created_at < now() - p_ttl
      and o.user_id is not null
      and o.points_used > 0
  on conflict (idempotency_key) do nothing;

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

revoke execute on function public.sweep_stale_pending_orders(interval)
  from public, anon, authenticated;
grant execute on function public.sweep_stale_pending_orders(interval)
  to service_role;

comment on function public.sweep_stale_pending_orders is
  '§4.5 Fallback: TTL 경과 pending 주문 cancel. ⚠️ 자동 cron 금지. '
  'S325: cancel 전 사용 포인트 복원(reversed). v1.0.7 기본 24h.';
