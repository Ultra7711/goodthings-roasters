-- ═══════════════════════════════════════════════════════════════════════════
-- 080_delete_account_unsubscribe_newsletter.sql — 탈퇴 시 뉴스레터 구독 해지·파기 (S302)
--
-- 정책 변경:
--   기존 — auth.users 삭제 시 newsletter_subscribers.user_id FK = ON DELETE SET NULL
--          → 탈퇴해도 email + status='active' 잔존 → 탈퇴 회원에게 계속 발송됨.
--   변경 — 탈퇴 시 해당 회원의 뉴스레터 구독 row 를 즉시 삭제(구독 해지 + email 파기).
--          개인정보보호법 §21 "탈퇴 시 PII 지체 없이 파기" 정합. email 은 PII 이므로
--          단순 unsubscribed 상태 보존이 아니라 row 자체 삭제.
--
-- 설계:
--   015 의 delete_account RPC (단일 트랜잭션) 에 newsletter DELETE 를 추가.
--   auth.users 삭제 전(=user_id 연결 살아있는 시점)에 RPC 가 먼저 실행되므로 원자적.
--   orphan 대비 — user_id 불일치(stale) row 도 잡도록 caller email 로도 매칭하여 삭제.
--     (auth.users.email = 유일 식별자 · newsletter.email = unique → 최대 1행).
--
-- 정합:
--   - 015 본문은 그대로 두고 (2) orders 익명화 + (3) subs 삭제 사이/이후에 newsletter
--     삭제 단계 (4) 추가. 반환 jsonb 에 newsletter_deleted 키 추가.
--   - FK ON DELETE SET NULL 은 안전망으로 유지 (RPC 가 정상 경로를 처리, FK 는 fallback).
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
  v_active_count integer;
  v_orders_anonymized integer;
  v_subs_deleted integer;
  v_email text;
  v_newsletter_deleted integer;
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
  '회원 탈퇴 원자 작업 — 활성 구독 차단 + orders PII 익명화 + cancelled/expired 구독 삭제
   + 뉴스레터 구독 해지·파기(080, user_id/email 매칭). auth.users 삭제는 API route 에서
   supabaseAdmin.auth.admin.deleteUser() 로 별도 호출 (profiles, addresses FK CASCADE).
   service_role 전용. 실패 시 errcode P0001=subscription_active.';

-- newsletter.user_id 컬럼 코멘트 갱신 — 정책 변경 반영 (065 의 "구독 자체 유지" 정정).
comment on column public.newsletter_subscribers.user_id is
  '회원 연결 (nullable). 비회원 구독 시 null. 회원 탈퇴 시 delete_account RPC 가 구독 row 를
   삭제(080 · 구독 해지+PII 파기). FK ON DELETE SET NULL 은 RPC 미경유 edge 안전망.';
