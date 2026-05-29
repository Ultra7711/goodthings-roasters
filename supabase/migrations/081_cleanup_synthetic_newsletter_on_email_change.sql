-- ═══════════════════════════════════════════════════════════════════════════
-- 081_cleanup_synthetic_newsletter_on_email_change.sql — 가상 이메일 newsletter 정리 (S302)
--
-- 배경:
--   간편로그인(카카오 비즈앱 미인증 / 네이버 이메일 미동의) 유저는 가상 이메일
--   `{provider}_{id}@{provider}-oauth.internal` 로 가입되며, handle_new_user(076) 가
--   이 가상 이메일로 newsletter_subscribers active row 를 생성한다 → 발송 불가 쓰레기 row.
--
--   마이페이지/주문 승격에서 실제 이메일을 등록하면 auth.users.email 이 가상 → 실제로
--   바뀐다. 이때 가상 이메일 newsletter row 가 그대로 남으면:
--     - 동일 user_id 에 (가상 row active) + (실제 row, 토글 시 079 RPC 가 생성) 공존
--     - 가상 row 는 영구 미발송 잔존물
--
-- 변경:
--   auth.users.email 이 가상 → 실제로 전환될 때 해당 user 의 가상 newsletter row 삭제.
--   유저는 실제 이메일로 토글(079 RPC)로 명시적 재구독 — 자동 구독 안 함(개인정보 정합).
--
-- 설계:
--   001 의 sync_profiles_email 트리거 본체는 건드리지 않고 별도 SECURITY DEFINER
--   트리거 함수 + 트리거 추가 (관심사 분리). 동일 AFTER UPDATE OF email 이벤트.
--
-- 재실행 안전: CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.cleanup_synthetic_newsletter_on_email_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  -- 가상(@*-oauth.internal) → 실제 이메일 전환 시에만 동작
  if old.email is distinct from new.email
     and old.email like '%-oauth.internal'
     and new.email not like '%-oauth.internal' then
    delete from public.newsletter_subscribers
    where user_id = new.id
      and email = old.email;
  end if;
  return new;
end;
$$;

comment on function public.cleanup_synthetic_newsletter_on_email_change() is
  '간편로그인 유저가 실제 이메일 등록 시(가상→실제 전환) 가상 이메일 newsletter 쓰레기 row 삭제.
   유저는 실제 이메일로 토글(079 RPC) 재구독. 081 (S302).';

drop trigger if exists on_auth_user_email_synthetic_cleanup on auth.users;

create trigger on_auth_user_email_synthetic_cleanup
  after update of email on auth.users
  for each row execute function public.cleanup_synthetic_newsletter_on_email_change();
