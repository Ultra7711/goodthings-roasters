-- ═══════════════════════════════════════════════════════════════════════════
-- 070_admin_audit_account_delete.sql — admin_audit 에 회원 탈퇴 액션 추가 (S258 P2)
--
-- 배경:
--   - 회원 탈퇴 이벤트는 현재 logAuthEvent (auth_event_log) 만 기록 → 운영자가
--     /admin/audit 통합 타임라인에서 조회 불가.
--   - PIPA §29 (안전성 확보 조치) 의 접근 기록 관리 의무 + 회원 탈퇴 처리 투명성
--     확보를 위해 admin_audit 에도 노출 필요.
--
-- 변경:
--   - admin_audit.action CHECK constraint 에 다음 2개 추가:
--     · 'self_delete_account'  — 회원 자기 탈퇴 (actor_id = target_user_id)
--     · 'force_delete_account' — 운영자 직권 탈퇴 (actor_id = owner, target ≠ actor)
--   - admin_audit.target_user_id FK 의 ON DELETE CASCADE 를 SET NULL 로 변경.
--     · 탈퇴된 user 의 audit 행이 자동 삭제되면 보존 의무 (PIPA §29 / 5년) 위반.
--     · target_user_id NULL = "탈퇴된 회원에 대한 액션" 으로 해석.
--   - admin_audit.target_email_snapshot 컬럼 추가 (탈퇴 후 추적용 · 분리 보존).
--     · auth.users CASCADE 로 profiles 가 사라져도 email 잔존.
--     · PII 이지만 감사 목적 5년 보존 (PIPA §21② 별도 DB 분리 보존 정합).
--
-- 리뷰 / 정합:
--   - 015 의 delete_account RPC 는 admin_audit 갱신을 호출 측 (API route 또는
--     server action) 에 위임. RPC 자체는 변경 없음.
--   - 057 의 admin_export_log.domain 확장 패턴 답습 (드롭→재추가).
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. admin_audit.action CHECK 확장 ───────────────────────────────────
alter table public.admin_audit
  drop constraint if exists admin_audit_action_check;

alter table public.admin_audit
  add constraint admin_audit_action_check check (
    action in (
      'grant_admin',
      'revoke_admin',
      'set_admin_level',
      'self_delete_account',
      'force_delete_account'
    )
  );


-- ── 2. target_user_id FK 정책 변경 (CASCADE → SET NULL) ─────────────────
-- 기존: ON DELETE CASCADE (탈퇴 시 audit 같이 삭제됨 — 보존 의무 위반)
-- 신규: ON DELETE SET NULL (탈퇴 시 audit 보존, target_user_id 만 NULL)
alter table public.admin_audit
  drop constraint if exists admin_audit_target_user_id_fkey;

alter table public.admin_audit
  add constraint admin_audit_target_user_id_fkey
  foreign key (target_user_id)
  references auth.users (id)
  on delete set null;

-- target_user_id 의 NOT NULL 제약도 해제 (SET NULL 동작 가능하게)
alter table public.admin_audit
  alter column target_user_id drop not null;


-- ── 3. target_email_snapshot 컬럼 추가 ────────────────────────────────
-- 탈퇴 후에도 운영자가 "누구를 탈퇴시켰는지" 추적 가능하도록 email 스냅샷 보존.
-- PIPA §21② 별도 DB 분리 보존 정합 — admin_audit 은 감사 목적 분리 영역.
alter table public.admin_audit
  add column if not exists target_email_snapshot text;

comment on column public.admin_audit.target_email_snapshot is
  '탈퇴 등으로 target_user_id 가 NULL 이 된 후에도 운영자가 추적 가능하도록
   액션 시점의 email 을 스냅샷. PIPA §21② 분리 보존 원칙 정합. 5년 보존.';


-- ── 4. comment 갱신 ───────────────────────────────────────────────────
comment on table public.admin_audit is
  '관리자 액션 감사 로그. admin 승격/강등 + 권한 단계 변경 + 회원 탈퇴 기록.
   RLS: admin SELECT (admin_audit_select_admin), 쓰기는 service_role 전용.
   보존: PIPA §29 안전성 확보 조치에 따라 5년 보존.';
