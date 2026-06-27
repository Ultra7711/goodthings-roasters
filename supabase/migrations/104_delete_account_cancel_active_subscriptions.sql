-- ═══════════════════════════════════════════════════════════════════════════
-- 104_delete_account_cancel_active_subscriptions.sql — 탈퇴 정책 변경 (S335)
--
-- 정책 변경 (DEC-S335):
--   기존(015/080) — 활성/일시정지 구독 있으면 raise 'subscription_active' 차단.
--                   사용자는 정기배송 관리로 이동 → 일일이 해지 → 다시 탈퇴 (비편의적).
--   변경         — 차단 폐기. 탈퇴 시 전 status 구독 일괄 삭제.
--                   사용자 동의는 클라이언트 2차 확인 모달로 확보
--                   ("정기 구독 중인 상품이 있습니다. 탈퇴 시 모두 취소됩니다").
--
-- 근거:
--   - 자동결제 반복 청구 cron 미구현(Phase 3-C) → 활성 구독이어도 다음 회차
--     자동 과금 없음 → 일괄 취소해도 과금/환불 리스크 0.
--   - subscriptions 참조 FK(subscription_billing_failures 040 ·
--     subscription_audit_log 045) 모두 ON DELETE CASCADE → 일괄삭제 안전.
--   - 빌링키(billing_methods)는 profiles CASCADE 로 auth.users 삭제 시 정리.
--     토스 측 빌링키 명시 해지는 일반 구독 해지와 동일하게 미수행(현행 일관).
--
-- 080 대비 변경점:
--   (1) 활성/일시정지 구독 체크 + raise 'subscription_active' → 제거
--   (3) cancelled/expired 한정 DELETE → 전 status DELETE
--   나머지(orders 익명화 · newsletter 파기 · 반환 형태)는 080 동일.
--
-- 재실행 안전: CREATE OR REPLACE FUNCTION.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.delete_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_orders_anonymized integer;
  v_subs_deleted integer;
  v_email text;
  v_newsletter_deleted integer;
begin
  -- (0) 입력 검증
  if p_user_id is null then
    raise exception 'user_id_required' using errcode = '22023';
  end if;

  -- (1) [제거됨] 활성/일시정지 구독 차단 — 2차 모달 동의 후 일괄 취소 정책으로 전환(104).

  -- (2) orders 익명화 — PII 필드 sentinel 치환 + user_id NULL
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

  -- (3) 전 status 구독 DELETE — 활성/일시정지 포함 일괄 취소(104 정책).
  --     참조 FK(subscription_billing_failures · subscription_audit_log) = ON DELETE CASCADE.
  delete from public.subscriptions
  where user_id = p_user_id;

  get diagnostics v_subs_deleted = row_count;

  -- (4) 뉴스레터 구독 해지 + 파기 (S302 정책) — email 도 함께 매칭해 stale orphan 까지 삭제.
  select email into v_email from auth.users where id = p_user_id;

  delete from public.newsletter_subscribers
  where user_id = p_user_id
     or (v_email is not null and email = v_email);

  get diagnostics v_newsletter_deleted = row_count;

  return jsonb_build_object(
    'orders_anonymized', v_orders_anonymized,
    'subscriptions_deleted', v_subs_deleted,
    'newsletter_deleted', v_newsletter_deleted
  );
end;
$$;

comment on function public.delete_account(uuid) is
  '회원 탈퇴 원자 작업(104) — orders PII 익명화 + 전 status 구독 일괄 삭제
   + 뉴스레터 구독 해지·파기. 활성 구독 차단 폐기(2차 모달 동의로 대체).
   auth.users 삭제는 API route 에서 supabaseAdmin.auth.admin.deleteUser() 로 별도 호출
   (profiles, addresses, billing_methods FK CASCADE). service_role 전용.';
