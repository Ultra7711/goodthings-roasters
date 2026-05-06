-- ═══════════════════════════════════════════════════════════════════════════
-- 035_admin_orders_pending_exclude.sql — /admin/orders pending 노출 정합 (S171 PR-A.5)
--
-- 배경:
--   S171 PR-A (034) 가 매출 집계/대시보드에서 pending 을 제외했지만,
--   /admin/orders 의 030 RPC `admin_orders_status_counts.'all'` 은 여전히
--   `count(*)` 로 전체를 카운트하여 pending row 를 포함.
--
-- 사용자 진단 (2026-05-07):
--   - createOrderFromInput 은 idempotency 없이 매 호출마다 새 row 생성
--   - 사용자가 같은 상품으로 재진입하면 새 pending row 누적
--   - pending row 는 클라이언트 측 재진입 경로 없음 (마이페이지 등 메뉴 부재)
--   = pending 은 데드 데이터. 어드민 노출 가치 없음.
--
-- 해결:
--   `admin_orders_status_counts.'all'` 카운트에 `where status <> 'pending'` 적용.
--   다른 탭 카운트는 이미 명시 status 매핑이라 영향 없음.
--   `pending` 카운트 자체는 유지 (운영 모니터링/디버깅 가치). UI 가 사용 여부는
--   클라이언트 단에서 결정.
--
-- 후속 (PR-B/C 별 sprint):
--   - PR-B: Toss 이탈 시 클라이언트 명시 cancel API 호출
--   - PR-C: TTL 안전망 (N분 후 pending → cancelled 자동 전환)
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.admin_orders_status_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;
  if not public.is_admin(v_actor) then
    raise exception 'admin role required' using errcode = 'insufficient_privilege';
  end if;

  select jsonb_build_object(
    'all',       count(*) filter (where status <> 'pending'),
    'pending',   count(*) filter (where status = 'pending'),
    'new',       count(*) filter (where status = 'paid'),
    'shipping',  count(*) filter (where status = 'shipping'),
    'delivered', count(*) filter (where status = 'delivered'),
    'cancelled', count(*) filter (
      where status in (
        'cancelled',
        'refund_requested',
        'refund_processing',
        'refunded'
      )
    )
  )
  into v_result
  from public.orders;

  return v_result;
end;
$$;

revoke execute on function public.admin_orders_status_counts() from public, anon;
grant execute on function public.admin_orders_status_counts() to authenticated;

comment on function public.admin_orders_status_counts() is
  '어드민 목록 탭 카운트 (전체 = pending 제외 · 신규 · 배송중 · 완료 · 취소). admin 가드 포함. (S171 PR-A.5)';
