-- ═══════════════════════════════════════════════════════════════════════════
-- 027_subscription_skip_count.sql — subscriptions.skip_count 컬럼 추가
--
-- C-5: POST /api/subscriptions/:id/skip (1회 배송 건너뛰기)
--   - next_delivery_at += cycle_days (route handler 에서 계산)
--   - skip_count 증가 (어드민 관리용 통계)
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.subscriptions
  add column if not exists skip_count integer not null default 0;

comment on column public.subscriptions.skip_count is
  'C-5 (027): 사용자가 배송 건너뛰기를 요청한 횟수 (누적). 어드민 통계용.';
