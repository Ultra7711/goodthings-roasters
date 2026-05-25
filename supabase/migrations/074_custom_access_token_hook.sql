-- ══════════════════════════════════════════════════════════════════════════
-- 074_custom_access_token_hook.sql — Supabase Auth Hook (S282 Phase 3)
--
-- 목표:
--   JWT 발급 시점에 profiles.admin_level 을 app_metadata.admin_level 로 박음.
--   → next/src/lib/auth/getClaims.ts 의 getAdminClaims() fast-path 활용 →
--     일반 사용자 95% RPC + SELECT skip (-300~600ms).
--
-- 적용 순서:
--   1. 본 마이그 실행 (function + permissions)
--   2. Supabase Dashboard → Authentication → Hooks → Custom Access Token Hook
--      활성화 + public.custom_access_token_hook 선택
--   3. 기존 admin 사용자 = auto refresh (≤ 1h) 또는 재로그인 시 새 JWT 발급
--
-- Security:
--   - SECURITY DEFINER: profiles 의 기존 RLS 정책 우회 (is_admin RPC 답습).
--   - search_path 격리: '' (빈 string · injection 방어).
--   - EXECUTE = supabase_auth_admin 만 (authenticated/anon/public revoke).
--   - JWT 변조 위험 = Supabase JWT 서명 검증으로 차단.
--   - Hook exception = event 그대로 return (admin 권한 차단 fail-safe).
--
-- Rollback:
--   1. Supabase Dashboard → Auth Hook 비활성화 (즉시 효과)
--   2. DROP FUNCTION public.custom_access_token_hook(jsonb);  -- 선택
-- ══════════════════════════════════════════════════════════════════════════

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb;
  v_admin_level text;
  v_user_id uuid;
begin
  -- event.user_id 추출 (null 안전성 — Hook 의 fail-safe 패턴)
  begin
    v_user_id := (event->>'user_id')::uuid;
  exception when others then
    -- user_id 파싱 실패 = event 그대로 return (admin claim 미박음 · safe)
    return event;
  end;

  if v_user_id is null then
    return event;
  end if;

  -- profiles.admin_level 조회 (CHECK constraint 로 'owner' | 'staff' | NULL 보장 · 055)
  begin
    select p.admin_level into v_admin_level
    from public.profiles p
    where p.id = v_user_id;
  exception when others then
    -- 조회 실패 = event 그대로 return (admin claim 미박음 · safe)
    return event;
  end;

  claims := event->'claims';

  -- app_metadata 누락 시 초기화
  if jsonb_typeof(claims->'app_metadata') is null then
    claims := jsonb_set(claims, '{app_metadata}', '{}'::jsonb);
  end if;

  -- admin 인 경우만 admin_level claim 박음 (일반 사용자 = app_metadata 안 admin_level 키 없음)
  if v_admin_level is not null then
    claims := jsonb_set(
      claims,
      '{app_metadata, admin_level}',
      to_jsonb(v_admin_level)
    );
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

comment on function public.custom_access_token_hook(jsonb) is
  'S282 Phase 3: JWT 발급 시점에 profiles.admin_level → app_metadata.admin_level 박음. getAdminClaims() RPC 회피용. Supabase Auth Hook 으로 등록.';

-- ── Permissions ────────────────────────────────────────────────────
-- supabase_auth_admin 만 실행 가능 (Auth Hook 호출자 · 다른 role 차단).
grant usage on schema public to supabase_auth_admin;

grant execute
  on function public.custom_access_token_hook(jsonb)
  to supabase_auth_admin;

revoke execute
  on function public.custom_access_token_hook(jsonb)
  from authenticated, anon, public;

-- profiles 테이블은 SECURITY DEFINER function 안에서 owner 권한으로 접근.
-- Supabase 공식 예제의 'revoke all on profiles from authenticated...' 는 적용 X
-- (GTR 의 기존 RLS 정책 = 본인 profile SELECT 등 보존 위해).
