-- ═══════════════════════════════════════════════════════════════════════════
-- 100_admin_audit_adjust_points.sql — admin_audit 에 포인트 수동 가감 액션 추가 (S328 P4 ②)
--
-- 배경:
--   - 적립금 수동 가감(adjust_points·094)은 금전 변동이라 회계 책임(누가·누구에게·
--     얼마·왜)을 추적해야 한다. point_ledger 가 금액(amount·description)을 immutable
--     기록하지만 actor(운영자)는 담지 않는다 → admin_audit 에 actor 책임 기록.
--   - /admin/audit 통합 타임라인 + 회원 상세에 노출.
--
-- 변경:
--   - admin_audit.action CHECK 에 'adjust_points' 추가 (070 패턴 답습·드롭→재추가).
--   - reason 에 "±N P · {운영자 사유}" 를 담는다(구조적 금액은 point_ledger 가 권위).
--
-- 정합:
--   - 070 의 5종 + adjust_points = 6종. 컬럼/FK/스냅샷 정책은 070 그대로 유지.
--   - 쓰기는 service_role 전용(adjustPointsAction 가 service_role 로 insert).
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.admin_audit
  drop constraint if exists admin_audit_action_check;

alter table public.admin_audit
  add constraint admin_audit_action_check check (
    action in (
      'grant_admin',
      'revoke_admin',
      'set_admin_level',
      'self_delete_account',
      'force_delete_account',
      'adjust_points'
    )
  );

comment on table public.admin_audit is
  '관리자 액션 감사 로그. admin 승격/강등 + 권한 단계 변경 + 회원 탈퇴 + 포인트 수동 가감 기록.
   RLS: admin SELECT (admin_audit_select_admin), 쓰기는 service_role 전용.
   보존: PIPA §29 안전성 확보 조치에 따라 5년 보존.';
