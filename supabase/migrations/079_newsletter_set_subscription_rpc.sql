-- ═══════════════════════════════════════════════════════════════════════════
-- 079_newsletter_set_subscription_rpc.sql — 회원 토글 email 재연결 RPC (S302)
--
-- 배경 (버그):
--   증상 = 회원 마이페이지 뉴스레터 토글 ON 실패 ("수신 동의 변경 실패").
--   원인 = newsletter_subscribers row 의 user_id 가 현재 회원 id 와 불일치
--          (stale · NULL · 옛 계정 id). 테스트 중 부분적 수동 DB 삭제로 발생한
--          orphan row 1건이 직접 계기.
--   기존 setNewsletterSubscription (lib/newsletter.ts) 은
--     (1) user_id = auth.uid() 로 SELECT → stale 면 못 찾음
--     (2) fallback INSERT (email, auth.uid()) → email unique 충돌(23505) → db_error
--   즉 "email 은 있는데 user_id 가 다른" 상태를 처리하지 못해 토글이 깨진다.
--
-- 설계:
--   065 의 RLS owner_update 정책은 auth.uid() = user_id 를 요구하므로,
--   NULL/타 user_id row 는 사용자 client 로 UPDATE 불가 → SECURITY DEFINER 필요.
--   본 RPC 는 caller 의 검증된 email (auth.users, auth.uid() 기준) 로만 row 를 잡아
--   user_id 를 자신에게 재연결 + status 설정 → 어떤 stale 상태든 자가 치유.
--   caller 는 오직 자기 email row 에만 영향을 줄 수 있어 안전.
--
-- 멱등 / upsert:
--   email 기준 ON CONFLICT DO UPDATE — row 없으면 INSERT(source='signup_default'),
--   있으면 user_id 재연결 + status 갱신 (source 보존).
--
-- 재실행 안전: CREATE OR REPLACE FUNCTION.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.set_newsletter_subscription(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid;
  v_email text;
  v_status text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  -- caller 의 검증된 email (auth.users = SoT). 가상 이메일 회원은 토글 UI 가 숨겨져
  -- (d9b6dd50) 호출 경로 자체가 없으나, email 부재 시 방어적으로 차단.
  select email into v_email from auth.users where id = v_uid;
  if v_email is null then
    raise exception 'no_email' using errcode = 'P0001';
  end if;

  v_status := case when p_enabled then 'active' else 'unsubscribed' end;

  -- email 기준 upsert + user_id 재연결 (stale / NULL / missing 모두 자가 치유)
  insert into public.newsletter_subscribers (email, user_id, source, status)
  values (v_email, v_uid, 'signup_default', v_status)
  on conflict (email) do update set
    user_id = v_uid,
    status = v_status,
    updated_at = now();
end;
$$;

comment on function public.set_newsletter_subscription(boolean) is
  '회원 마이페이지 뉴스레터 토글 — caller 의 auth email 기준 upsert + user_id 재연결.
   stale/NULL user_id row 자가 치유 (RLS owner_update 우회 위해 SECURITY DEFINER).
   caller 는 자기 email row 에만 영향. S302 토글 버그 근본 fix.';

revoke all on function public.set_newsletter_subscription(boolean) from public, anon;
grant execute on function public.set_newsletter_subscription(boolean) to authenticated;
