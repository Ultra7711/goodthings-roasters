-- ═══════════════════════════════════════════════════════════════════════════
-- 037_cancel_stale_pending_orders.sql — pending 주문 TTL 자동 취소 (S171 PR-C)
--
-- 배경:
--   S171 PR-B 로 클라이언트 명시 cancel 경로가 생겼지만, 네트워크 오류·앱 강제 종료 등
--   클라이언트가 cancel 을 호출하지 못하는 엣지 케이스를 위한 서버 측 안전망.
--
-- 동작:
--   15분마다 실행 → created_at 이 30분 이상 경과된 pending 주문을 cancelled 로 전환.
--   최대 pending 잔류 시간 = TTL(30분) + cron 간격(15분) = 최대 45분.
--
-- 전제:
--   pg_cron 확장 활성화 필요 (S171 사용자 확인).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) 취소 함수 ──────────────────────────────────────────────────────────

create or replace function public.cancel_stale_pending_orders()
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_count integer;
begin
  update public.orders
  set status = 'cancelled'
  where status = 'pending'
    and created_at < now() - interval '30 minutes';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.cancel_stale_pending_orders() from public, anon, authenticated;

comment on function public.cancel_stale_pending_orders() is
  'TTL 안전망: 30분 이상 경과된 pending 주문을 cancelled 로 전환. pg_cron 에서 15분마다 호출. (S171 PR-C)';

-- ── 2) cron job 등록 ──────────────────────────────────────────────────────
-- 기존 동명 job 이 있으면 제거 후 재등록 (멱등 적용 보장).

select cron.unschedule('cancel-stale-pending-orders')
where exists (
  select 1 from cron.job where jobname = 'cancel-stale-pending-orders'
);

select cron.schedule(
  'cancel-stale-pending-orders',
  '*/15 * * * *',
  $$ select public.cancel_stale_pending_orders(); $$
);
