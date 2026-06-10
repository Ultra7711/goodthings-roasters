-- ═══════════════════════════════════════════════════════════════════════════
-- 089_admin_export_log_reviews_domain.sql — admin_export_log.domain 'reviews' 확장 (S317)
--
-- 배경:
--   - /admin/reviews 리뷰 목록 XLSX 내보내기 추가 (owner-only).
--   - 리뷰 본문·작성자 닉네임 = 운영 자료 → 다른 내보내기와 동일하게 admin_export_log 기록.
--
-- 변경:
--   - admin_export_log.domain CHECK constraint 에 'reviews' 추가 (082 패턴 답습).
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.admin_export_log
  drop constraint if exists admin_export_log_domain_check;

alter table public.admin_export_log
  add constraint admin_export_log_domain_check check (
    domain in ('subscriptions', 'orders', 'users', 'products', 'audit', 'newsletter', 'reviews')
  );
