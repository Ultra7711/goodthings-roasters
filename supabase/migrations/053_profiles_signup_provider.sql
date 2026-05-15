-- ═══════════════════════════════════════════════════════════════════════════
-- 053_profiles_signup_provider.sql — profiles.signup_provider 컬럼 (S232)
--
-- 목적:
--   - /admin/users 가입 채널 DropdownFilter 의 데이터 source.
--   - email / google / kakao / naver 4 provider 분류 + 카운트·필터·CSV 활용.
--
-- 정책:
--   - 신규 가입 시 handle_new_user 트리거가 자동 박음.
--     · 우선순위: raw_app_meta_data->>'provider' (Supabase 표준)
--                → raw_user_meta_data->>'provider' (kakao/naver callback 측 박음)
--                → 'email' (fallback)
--   - 기존 사용자: backfill 동일 우선순위.
--   - CHECK constraint: 'email' / 'google' / 'kakao' / 'naver' 중 하나.
--   - apple 미구현 (LoginPage 미사용) → enum 미포함.
--
-- 재실행 안전:
--   - ADD COLUMN IF NOT EXISTS · DROP CONSTRAINT IF EXISTS · CREATE INDEX IF NOT EXISTS.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. 컬럼 추가 ──────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists signup_provider text;

comment on column public.profiles.signup_provider is
  '가입 채널. handle_new_user 트리거가 auth.users 의 raw_app_meta_data->>provider 또는 raw_user_meta_data->>provider 에서 추출. fallback = email.';

-- ── 2. backfill ───────────────────────────────────────────────────────
-- 기존 사용자: auth.users metadata 에서 추출.
update public.profiles p
set signup_provider = coalesce(
  u.raw_app_meta_data->>'provider',
  u.raw_user_meta_data->>'provider',
  'email'
)
from auth.users u
where p.id = u.id
  and p.signup_provider is null;

-- backfill 누락 안전망 — auth.users 매칭 실패 시 'email' 처리
update public.profiles
set signup_provider = 'email'
where signup_provider is null;

-- ── 3. NOT NULL + CHECK constraint ─────────────────────────────────────
alter table public.profiles
  alter column signup_provider set not null;

alter table public.profiles
  drop constraint if exists profiles_signup_provider_chk;

alter table public.profiles
  add constraint profiles_signup_provider_chk check (
    signup_provider in ('email', 'google', 'kakao', 'naver')
  );

-- ── 4. index — 필터 카운트 가속 ──────────────────────────────────────
create index if not exists idx_profiles_signup_provider
  on public.profiles (signup_provider);

-- ── 5. handle_new_user 트리거 갱신 ─────────────────────────────────────
-- 신규 가입 시 signup_provider 자동 박음.
-- 029 의 display_name 처리 답습 + provider 추가.
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
  v_provider text;
begin
  v_raw_name := coalesce (
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name'
  );

  -- H2: HTML 특수문자 sanitize (008 답습)
  if v_raw_name is not null then
    v_full_name := regexp_replace(v_raw_name, '[<>&"'']', '', 'g');
    v_full_name := trim(v_full_name);
    if char_length(v_full_name) = 0 then
      v_full_name := null;
    elsif char_length(v_full_name) > 80 then
      v_full_name := substring(v_full_name from 1 for 80);
    end if;
  end if;

  -- M8: email local-part 폴백
  if v_full_name is null then
    v_email_local := nullif(split_part(coalesce(new.email, ''), '@', 1), '');
    v_full_name := v_email_local;
  end if;

  v_phone := coalesce (
    new.raw_user_meta_data ->> 'phone',
    new.phone
  );

  -- 053: 가입 채널 추출.
  -- Supabase 표준 = raw_app_meta_data.provider (signInWithOAuth · email signUp 모두).
  -- kakao/naver 자체 callback = raw_user_meta_data.provider 박음.
  -- 둘 다 없으면 'email' fallback.
  v_provider := coalesce(
    new.raw_app_meta_data ->> 'provider',
    new.raw_user_meta_data ->> 'provider',
    'email'
  );

  -- enum 외 값 방어 (Apple 등 미지원 provider 방지)
  if v_provider not in ('email', 'google', 'kakao', 'naver') then
    v_provider := 'email';
  end if;

  insert into public.profiles (id, email, full_name, display_name, phone, signup_provider)
  values (new.id, new.email, v_full_name, v_full_name, v_phone, v_provider)
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user () is
  'auth.users INSERT 시 profiles 레코드 자동 생성. 053: signup_provider 도 함께 초기화.';
