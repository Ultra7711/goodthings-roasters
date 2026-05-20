-- ═══════════════════════════════════════════════════════════════════════════
-- 066_newsletter_signup_integration.sql — 회원가입 자동 subscribe + 기존 회원 backfill (S241 Phase 2)
--
-- 배경:
--   - 065 newsletter_subscribers 테이블 = 비회원 + 회원 통합.
--   - Phase 2 = 회원가입 시 자동 subscribe (디폴트 ON · source='signup_default').
--   - 기존 회원 backfill = auth.users 의 모든 회원을 newsletter_subscribers 에 INSERT
--     (이미 비회원으로 구독한 email 은 user_id 만 동기화 · 기존 status 유지).
--
-- 변경:
--   (1) handle_new_user 함수 확장 — auth.users INSERT 시 newsletter_subscribers 도 INSERT.
--       email 충돌 시: user_id 만 업데이트, status 는 유지 (이전 unsubscribed 보호).
--       newsletter INSERT 실패 시 회원가입 자체는 성공 (별도 BEGIN/EXCEPTION).
--   (2) 기존 회원 backfill — 1회성 INSERT/UPDATE.
--
-- Rollback:
--   - handle_new_user 함수를 008 의 원본으로 되돌림 (newsletter INSERT 부분만 제거).
--   - newsletter_subscribers 의 source='signup_default' 행 삭제 (선택).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── (1) handle_new_user 확장 ─────────────────────────────────────────────────
create or replace function public.handle_new_user ()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_raw_name text;
  v_full_name text;
  v_phone text;
  v_email_local text;
begin
  -- ── 기존 profiles INSERT (008 답습) ──
  v_raw_name := coalesce (
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name'
  );

  if v_raw_name is not null then
    v_full_name := regexp_replace(v_raw_name, '[<>&"'']', '', 'g');
    v_full_name := trim(v_full_name);
    if char_length(v_full_name) = 0 then
      v_full_name := null;
    elsif char_length(v_full_name) > 80 then
      v_full_name := substring(v_full_name from 1 for 80);
    end if;
  end if;

  if v_full_name is null then
    v_email_local := nullif(split_part(coalesce(new.email, ''), '@', 1), '');
    v_full_name := v_email_local;
  end if;

  v_phone := coalesce (
    new.raw_user_meta_data ->> 'phone',
    new.phone
  );

  insert into public.profiles (id, email, full_name, phone)
  values (new.id, new.email, v_full_name, v_phone)
  on conflict (id) do nothing;

  -- ── (Phase 2) newsletter 자동 subscribe ──
  -- 디폴트 ON · source='signup_default'. email 충돌 시 user_id 만 업데이트하고 status 유지
  -- (이전 unsubscribed 보호). newsletter INSERT 실패가 회원가입 자체를 막지 않도록 EXCEPTION 처리.
  if new.email is not null then
    begin
      insert into public.newsletter_subscribers (email, user_id, source, status)
      values (new.email, new.id, 'signup_default', 'active')
      on conflict (email) do update set
        user_id = excluded.user_id,
        updated_at = now();
    exception when others then
      -- newsletter INSERT 실패는 회원가입 자체와 분리 (graceful).
      raise warning '[handle_new_user] newsletter subscribe failed: %', sqlerrm;
    end;
  end if;

  return new;
end;
$$;

comment on function public.handle_new_user () is
  'auth.users INSERT 시 profiles + newsletter_subscribers 자동 생성. SECURITY DEFINER + search_path 고정. newsletter INSERT 실패는 graceful (회원가입은 성공). 066 Phase 2 확장.';

-- ── (2) 기존 회원 backfill ─────────────────────────────────────────────────
-- 비회원으로 이미 구독한 email 의 user_id 채우기 (기존 status 유지)
update public.newsletter_subscribers ns
set user_id = u.id,
    updated_at = now()
from auth.users u
where ns.email = u.email
  and ns.user_id is null;

-- 아직 구독 record 없는 기존 회원 INSERT (디폴트 ON)
insert into public.newsletter_subscribers (email, user_id, source, status)
select u.email, u.id, 'signup_default', 'active'
from auth.users u
where u.email is not null
  and not exists (
    select 1 from public.newsletter_subscribers ns
    where ns.email = u.email
  );
