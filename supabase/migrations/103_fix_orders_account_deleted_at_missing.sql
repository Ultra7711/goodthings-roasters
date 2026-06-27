-- ═══════════════════════════════════════════════════════════════════════════
-- 103_fix_orders_account_deleted_at_missing.sql — 015 DDL 누락 복구 (S335)
--
-- 증상:
--   회원 탈퇴(POST /api/account/delete) → RPC delete_account 호출 →
--   errorCode 'rpc_failed' · PostgreSQL code 42703 (undefined_column) →
--   주문 이력 유무와 무관하게 전 계정 탈퇴 실패.
--
-- 원인:
--   015_account_delete.sql 이 추가하는 orders.account_deleted_at 컬럼 +
--   orders_user_or_guest 3분기 제약이 프로덕션 DB 에 적용되지 않음.
--   (080 의 RPC CREATE OR REPLACE 는 적용됨 — plpgsql 함수는 호출 시점에
--    컬럼을 resolve 하므로 생성은 성공하나, 실행 시 account_deleted_at 참조에서 42703.)
--
-- 복구:
--   015 의 DDL(컬럼 + 부분 인덱스 + 3분기 제약)을 idempotent 하게 재적용.
--   기존 데이터(회원·게스트 주문)는 account_deleted_at 이 모두 NULL 이라
--   재정의된 제약의 회원/게스트 분기를 그대로 충족 → ADD CONSTRAINT 안전.
--
-- 재실행 안전: IF NOT EXISTS / DROP IF EXISTS 사용.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. account_deleted_at 컬럼 (015 §1) ──────────────────────────────────
alter table public.orders
  add column if not exists account_deleted_at timestamptz;

comment on column public.orders.account_deleted_at is
  '회원 탈퇴로 인한 주문 익명화 시각. PII 필드는 sentinel 치환,
   주문 메타(order_number, 금액, status, terms_version)는 5년 보존
   (전자상거래법 §6 + 개인정보보호법 §21 균형).';

-- 감사 리포트용 부분 인덱스 (익명화된 주문만)
create index if not exists orders_account_deleted_at_idx
  on public.orders (account_deleted_at)
  where account_deleted_at is not null;

-- ── 2. orders_user_or_guest 3분기 제약 (015 §2) ──────────────────────────
-- 회원 / 게스트 / 탈퇴-익명화 3가지 상태를 모두 표현.
alter table public.orders
  drop constraint if exists orders_user_or_guest;

alter table public.orders
  add constraint orders_user_or_guest check (
    -- 회원 주문 (정상)
    (user_id is not null
      and account_deleted_at is null
      and guest_email is null
      and guest_lookup_pin_hash is null)
    or
    -- 비회원 주문
    (user_id is null
      and account_deleted_at is null
      and guest_email is not null and char_length(guest_email) > 0
      and guest_lookup_pin_hash is not null and char_length(guest_lookup_pin_hash) > 0)
    or
    -- 탈퇴 익명화 (PII 파기, 주문 메타 5년 보존)
    (user_id is null
      and account_deleted_at is not null
      and guest_email is null
      and guest_lookup_pin_hash is null)
  );
