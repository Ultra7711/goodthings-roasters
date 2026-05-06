-- ═══════════════════════════════════════════════════════════════════════════
-- 038_delete_stale_pending_orders.sql — pending 주문 TTL 자동 DELETE (S173)
--
-- 배경 (S173 정책 변경):
--   037 은 30분 경과 pending 주문을 cancelled 로 전환했지만, "결제 직전 이탈"
--   은 사용자 명시 취소가 아닌 UX 흐름이며 운영 측에서도 의미 없는 데이터.
--   abandoned cancelled 가 admin/통계에 노이즈로 누적되는 문제 해결을 위해
--   row 자체를 DELETE 한다.
--
-- 동작:
--   15분마다 실행 → created_at 이 30분 이상 경과된 pending 주문을 DELETE.
--   - order_items: ON DELETE CASCADE → 자동 삭제
--   - subscriptions(initial_order_id): ON DELETE SET NULL 이지만, RPC 가
--     pending 시점에 active subscription 도 함께 INSERT 하므로 함수 내부에서
--     명시 DELETE (initial_order_id 매칭).
--   - payments / payment_transactions: pending 시점에 row 없음 (결제 confirm
--     후 생성) → RESTRICT FK 무관.
--
-- 037 함수·cron 은 본 마이그레이션에서 폐기.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) 기존 함수·cron 폐기 ───────────────────────────────────────────────

select cron.unschedule('cancel-stale-pending-orders')
where exists (
  select 1 from cron.job where jobname = 'cancel-stale-pending-orders'
);

drop function if exists public.cancel_stale_pending_orders();

-- ── 2) DELETE 함수 ──────────────────────────────────────────────────────

create or replace function public.delete_stale_pending_orders()
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_count integer;
begin
  -- 2-a) 대상 pending 주문에 딸린 subscriptions 명시 DELETE
  --      (FK SET NULL 로는 dead active subscription 이 남기 때문)
  delete from public.subscriptions s
  using public.orders o
  where s.initial_order_id = o.id
    and o.status = 'pending'
    and o.created_at < now() - interval '30 minutes';

  -- 2-b) pending 주문 DELETE (order_items 는 CASCADE 자동 삭제)
  delete from public.orders
  where status = 'pending'
    and created_at < now() - interval '30 minutes';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.delete_stale_pending_orders() from public, anon, authenticated;

comment on function public.delete_stale_pending_orders() is
  'TTL 안전망: 30분 이상 경과된 pending 주문 + 연관 subscription DELETE. pg_cron 15분 주기. (S173)';

-- ── 3) cron job 등록 ────────────────────────────────────────────────────

select cron.schedule(
  'delete-stale-pending-orders',
  '*/15 * * * *',
  $$ select public.delete_stale_pending_orders(); $$
);
