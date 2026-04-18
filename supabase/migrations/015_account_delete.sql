-- ═══════════════════════════════════════════════════════════════════════════
-- 015_account_delete.sql — 회원 탈퇴 (Account Deletion) 인프라
--
-- 정책 근거 (docs/milestone.md Session 8-E · 업계 리서치 2026-04-17):
--   - 국내 표준: 네이버·컬리·쿠팡(종전) = 활성 구독/멤버십 선 해지 → 탈퇴
--   - 국제 규제: FTC ROSCA·Apple 가이드라인 = "가입과 동등한 쉬운 해지"
--   - 한국 법: 전자상거래법 §6 = 주문 5년 보존 · 개인정보보호법 §21 = PII 파기
--
-- 설계 결정:
--   A. Hard delete (auth.users) + orders PII 익명화 (user_id NULL + sentinel)
--   B. 활성/일시정지 구독 있으면 차단 (409) — 선 해지 후 탈퇴 원칙
--   C. 취소/만료 구독은 DELETE (보존 의무 없음, orders 가 증빙)
--   D. auth.users 삭제는 API route (service_role admin client) 에서 별도 호출
--      — profiles, addresses 는 FK ON DELETE CASCADE 로 자동 정리
--
-- 원자성:
--   본 RPC 는 (subs 체크 + orders 익명화 + subs 삭제) 를 단일 트랜잭션으로 묶는다.
--   auth.users 삭제 실패 시 orphan PII=[DELETED] 상태로 남을 수 있으나,
--   이는 안전한 방향(PII 노출 없음)이며 admin 이 수동 복구 가능.
--
-- SECURITY DEFINER + search_path 고정 (H9 패턴 유지).
-- service_role 만 실행 가능 (API route 에서 supabaseAdmin.rpc() 경로).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. orders.account_deleted_at 컬럼 추가 ──────────────────────────────
-- 익명화 시각 기록. 전자상거래법 5년 보존 감사 추적용.
alter table public.orders
  add column account_deleted_at timestamptz;

comment on column public.orders.account_deleted_at is
  '회원 탈퇴로 인한 주문 익명화 시각. PII 필드는 sentinel 치환,
   주문 메타(order_number, 금액, status, terms_version)는 5년 보존
   (전자상거래법 §6 + 개인정보보호법 §21 균형).';

-- 감사 리포트용 부분 인덱스 (익명화된 주문만)
create index orders_account_deleted_at_idx
  on public.orders (account_deleted_at)
  where account_deleted_at is not null;

-- ── 2. orders_user_or_guest 제약 — 3번째 분기(익명화) 추가 ───────────────
-- 기존 2분기(회원/게스트) 로는 user_id NULL + guest_email NULL 상태 표현 불가.
alter table public.orders
  drop constraint orders_user_or_guest;

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

-- ── 3. RPC: delete_account(p_user_id) ─────────────────────────────────────
-- 단일 트랜잭션:
--   (1) 활성/일시정지 구독 있으면 raise exception 'subscription_active'
--   (2) orders 익명화 (PII → sentinel, user_id → NULL, account_deleted_at = now())
--   (3) 취소/만료 구독 DELETE
--
-- 반환: { orders_anonymized: int, subscriptions_deleted: int }
-- 실패 시 raise exception — 호출측 PostgrestError.code 로 분기.
create or replace function public.delete_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_active_count integer;
  v_orders_anonymized integer;
  v_subs_deleted integer;
begin
  -- (0) 입력 검증
  if p_user_id is null then
    raise exception 'user_id_required' using errcode = '22023';
  end if;

  -- (1) 활성/일시정지 구독 선 체크 — 차단 (B안: 선 해지 후 탈퇴)
  select count(*) into v_active_count
  from public.subscriptions
  where user_id = p_user_id
    and status in ('active', 'paused');

  if v_active_count > 0 then
    raise exception 'subscription_active' using errcode = 'P0001';
  end if;

  -- (2) orders 익명화 — PII 필드 sentinel 치환 + user_id NULL
  --     NOT NULL 컬럼은 모두 sentinel, nullable 은 NULL 처리.
  --     orders_transfer_fields 제약 유지 위해 transfer 주문의 bank/depositor 도 sentinel.
  update public.orders
  set
    user_id = null,
    account_deleted_at = now(),
    contact_email = '[deleted]@anonymized.local',
    contact_phone = '[DELETED]',
    shipping_name = '[DELETED]',
    shipping_phone = '[DELETED]',
    shipping_zipcode = '[DELETED]',
    shipping_addr1 = '[DELETED]',
    shipping_addr2 = null,
    shipping_message_code = null,
    shipping_message_custom = null,
    bank_name = case when payment_method = 'transfer' then '[DELETED]' else null end,
    depositor_name = case when payment_method = 'transfer' then '[DELETED]' else null end,
    guest_email = null,
    guest_lookup_pin_hash = null
  where user_id = p_user_id;

  get diagnostics v_orders_anonymized = row_count;

  -- (3) 취소/만료 구독 DELETE — 활성/일시정지는 (1) 에서 차단 완료
  delete from public.subscriptions
  where user_id = p_user_id
    and status in ('cancelled', 'expired');

  get diagnostics v_subs_deleted = row_count;

  return jsonb_build_object(
    'orders_anonymized', v_orders_anonymized,
    'subscriptions_deleted', v_subs_deleted
  );
end;
$$;

-- ── 4. 실행 권한: service_role 전용 ───────────────────────────────────────
revoke all on function public.delete_account(uuid) from public, authenticated, anon;
grant execute on function public.delete_account(uuid) to service_role;

comment on function public.delete_account(uuid) is
  '회원 탈퇴 원자 작업 — 활성 구독 차단 + orders PII 익명화 + cancelled/expired 구독 삭제.
   auth.users 삭제는 API route 에서 supabaseAdmin.auth.admin.deleteUser() 로 별도 호출
   (profiles, addresses 는 FK CASCADE 로 자동 정리).
   service_role 전용. 실패 시 errcode P0001=subscription_active.';
