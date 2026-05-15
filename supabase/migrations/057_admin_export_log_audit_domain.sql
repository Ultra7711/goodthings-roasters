-- ═══════════════════════════════════════════════════════════════════════════
-- 057_admin_export_log_audit_domain.sql — admin_export_log.domain enum 'audit' 확장 (S233-fu)
--
-- 배경:
--   - 정부·KISA 컴플라이언스 측 "PII 조회 기록 제출" 요구 가능성 대비.
--   - /admin/audit 자체도 CSV 내보내기 지원 (owner 전용).
--   - 감사 로그 다운로드 자체도 admin_export_log 에 기록 (재귀 audit).
--
-- 변경:
--   - admin_export_log.domain CHECK constraint 에 'audit' 추가.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.admin_export_log
  drop constraint if exists admin_export_log_domain_check;

alter table public.admin_export_log
  add constraint admin_export_log_domain_check check (
    domain in ('subscriptions', 'orders', 'users', 'products', 'audit')
  );
