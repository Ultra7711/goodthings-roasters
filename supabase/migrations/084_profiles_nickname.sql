-- ═══════════════════════════════════════════════════════════════════════════
-- 084_profiles_nickname.sql — 리뷰 작성자 닉네임 (유저 리뷰 Phase 1 Step 0)
--
-- 목적:
--   - 유저 리뷰 작성자 표시명. 실명(full_name) / 표시명(display_name) 노출 0 정책.
--   - display_name 은 이메일 인사·어드민 헤더 등에서 본명/표시용으로 쓰여 재활용 불가
--     (실명 노출 + 인사 오염 위험) → nickname 별도 컬럼 신설.
--
-- 정책:
--   - nickname : 가입 시 handle_new_user 가 커피/카페 테마 자동생성 (형용사+명사+숫자).
--                사용자가 마이페이지에서 자유 편집. 중복 허용(유니크 제약 X).
--   - 제약: 길이 2~20 + HTML 특수문자 차단 (full_name / display_name 동일 패턴).
--   - 자동생성값은 항상 비어있지 않음 (빈값 0 보장).
--
-- backfill:
--   - 기존 모든 사용자: nickname is null → generate_nickname() (행마다 재평가).
--
-- handle_new_user 트리거 갱신:
--   - 076 통합본 전체 재정의 + nickname 자동생성 추가.
--   - ⚠️ 066 이 029·053 을 회귀시킨 전례 — 부분 수정이 아닌 full 재정의로 회귀 차단.
--
-- 재실행 안전:
--   - ADD COLUMN IF NOT EXISTS · DROP CONSTRAINT IF EXISTS · CREATE OR REPLACE FUNCTION.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. 컬럼 추가 ──────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists nickname text;

alter table public.profiles
  drop constraint if exists profiles_nickname_length;
alter table public.profiles
  add constraint profiles_nickname_length check (
    nickname is null or char_length(nickname) between 2 and 20
  );

-- full_name / display_name 과 동일한 XSS 위협 문자 차단
alter table public.profiles
  drop constraint if exists profiles_nickname_no_html;
alter table public.profiles
  add constraint profiles_nickname_no_html check (
    nickname is null or nickname !~ '[<>&"'']'
  );

comment on column public.profiles.nickname is
  '유저 리뷰 작성자 표시명 (실명/표시명 노출 0). 가입 시 generate_nickname() 자동생성, 마이페이지에서 편집. 중복 허용.';

-- ── 2. 닉네임 자동생성 함수 (커피/카페 테마 · 형용사+명사+3자리 숫자) ──
-- 데이터 미접근 순수 함수. volatile (random()) → backfill set 절에서 행마다 재평가.
create or replace function public.generate_nickname ()
returns text
language plpgsql
volatile
set search_path = public, pg_catalog
as $$
declare
  -- 커피 향미·온기 톤 형용사 (명사 수식 자연스러운 것 위주)
  v_adjectives text[] := array[
    '고소한', '따뜻한', '깊은', '진한', '부드러운',
    '향긋한', '달콤한', '포근한', '은은한', '풍부한',
    '정겨운', '산뜻한', '묵직한', '잔잔한', '그윽한',
    '보드란', '살가운', '정성스런', '노릇한', '구수한'
  ];
  -- 커피/카페 명사
  v_nouns text[] := array[
    '원두', '드립백', '로스팅', '에스프레소', '라떼',
    '아메리카노', '카푸치노', '핸드드립', '콜드브루', '디카페인',
    '바리스타', '모카', '블렌드', '크레마', '푸어오버',
    '플랫화이트', '카페라떼', '더치커피', '싱글오리진', '마키아토'
  ];
  v_adj  text;
  v_noun text;
  v_num  int;
begin
  v_adj  := v_adjectives[1 + floor(random() * array_length(v_adjectives, 1))::int];
  v_noun := v_nouns[1 + floor(random() * array_length(v_nouns, 1))::int];
  v_num  := floor(random() * 900 + 100)::int;  -- 100~999 (3자리)
  return v_adj || v_noun || v_num::text;
end;
$$;

comment on function public.generate_nickname () is
  '커피/카페 테마 닉네임 자동생성 (형용사+명사+3자리 숫자). 중복 허용. 빈값 0 보장.';

-- ── 3. backfill ───────────────────────────────────────────────────────
-- 기존 사용자 닉네임 일괄 생성 (volatile 함수 → 행마다 다른 값).
update public.profiles
set nickname = public.generate_nickname()
where nickname is null;

-- ── 4. handle_new_user 트리거 갱신 (076 통합본 + nickname) ─────────────
-- 076 (053 provider + 029 display_name + 066 newsletter) 전체 재정의 + nickname 추가.
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
  v_nickname text;
begin
  -- ── full_name 추출 + sanitize (008 답습) ──
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

  -- ── 053: signup_provider 추출 (NOT NULL + CHECK 만족) ──
  v_provider := coalesce(
    new.raw_app_meta_data ->> 'provider',
    new.raw_user_meta_data ->> 'provider',
    'email'
  );
  if v_provider not in ('email', 'google', 'kakao', 'naver') then
    v_provider := 'email';
  end if;

  -- ── 084: 리뷰 작성자 닉네임 자동생성 ──
  v_nickname := public.generate_nickname();

  -- ── profiles INSERT (029 display_name + 053 provider + 084 nickname) ──
  insert into public.profiles (id, email, full_name, display_name, phone, signup_provider, nickname)
  values (new.id, new.email, v_full_name, v_full_name, v_phone, v_provider, v_nickname)
  on conflict (id) do nothing;

  -- ── 066: newsletter 자동 subscribe (graceful) ──
  if new.email is not null then
    begin
      insert into public.newsletter_subscribers (email, user_id, source, status)
      values (new.email, new.id, 'signup_default', 'active')
      on conflict (email) do update set
        user_id = excluded.user_id,
        updated_at = now();
    exception when others then
      raise warning '[handle_new_user] newsletter subscribe failed: %', sqlerrm;
    end;
  end if;

  return new;
end;
$$;

comment on function public.handle_new_user () is
  'auth.users INSERT → profiles + newsletter_subscribers 생성. 053 provider + 029 display_name + 066 newsletter + 084 nickname 통합.';
