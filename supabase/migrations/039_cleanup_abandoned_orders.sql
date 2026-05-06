-- ═══════════════════════════════════════════════════════════════════════════
-- 039_cleanup_abandoned_orders.sql — 기존 누적 abandoned cancelled 일회성 정리 (S173)
--
-- 배경:
--   037 (S171) 적용 기간 동안 pending → cancelled 로 전환된 abandoned 주문이
--   누적되어 admin '취소' 탭에 노이즈로 노출됨.
--   S173 에서 정책을 DELETE 로 변경하면서 기존 누적분도 함께 정리.
--
-- 식별 기준:
--   abandoned = status='cancelled' AND payments row 없음 (결제 시도 미완료).
--   - 결제 후 운영 수동 취소(진짜 취소)는 payments row 가 존재하므로 보존.
--   - refund_* 상태는 정상 환불 흐름 → 건드리지 않음.
--
-- 처리:
--   1) abandoned cancelled 에 딸린 dead subscription 먼저 DELETE
--   2) abandoned cancelled order DELETE (order_items 는 CASCADE)
--
-- 일회성: 본 마이그레이션 적용 후 038 cron 이 신규 abandoned 을 즉시 DELETE.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) abandoned cancelled 의 dead subscription DELETE ──────────────────
delete from public.subscriptions s
using public.orders o
where s.initial_order_id = o.id
  and o.status = 'cancelled'
  and not exists (
    select 1 from public.payments p where p.order_id = o.id
  );

-- ── 2) abandoned cancelled order DELETE ─────────────────────────────────
delete from public.orders o
where o.status = 'cancelled'
  and not exists (
    select 1 from public.payments p where p.order_id = o.id
  );

-- ── 3) 안전망: initial_order_id NULL 인 dangling subscription 정리 ──────
-- 037 시기 SET NULL 로 끊어진 dead row 가 남아있을 가능성.
-- pending/abandoned order 가 사라진 뒤 subscription 만 남은 케이스.
delete from public.subscriptions
where initial_order_id is null
  and status = 'active'
  and created_at < now() - interval '30 minutes';
