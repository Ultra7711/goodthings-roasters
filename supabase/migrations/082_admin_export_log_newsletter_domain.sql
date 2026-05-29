-- ═══════════════════════════════════════════════════════════════════════════
-- 082_admin_export_log_newsletter_domain.sql — admin_export_log.domain 'newsletter' 확장 (S250-2)
--
-- 배경:
--   - /admin/newsletter 구독자 목록 CSV(XLSX) 내보내기 추가.
--   - 구독자 이메일 = PII → users/subscriptions 내보내기와 동일하게 admin_export_log 기록.
--
-- 변경:
--   - admin_export_log.domain CHECK constraint 에 'newsletter' 추가 (057 패턴 답습).
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.admin_export_log
  drop constraint if exists admin_export_log_domain_check;

alter table public.admin_export_log
  add constraint admin_export_log_domain_check check (
    domain in ('subscriptions', 'orders', 'users', 'products', 'audit', 'newsletter')
  );
