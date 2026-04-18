-- ═══════════════════════════════════════════════════════════════════════════
-- 002_addresses.sql — 배송지 테이블
--
-- 목적: 1 사용자 : N 배송지. 마이페이지 기본 배송지 + 체크아웃 추가 배송지.
--
-- 리뷰 Pass 1 반영 (2026-04-16):
--   - H8: addresses.id 불변 트리거 (prevent_id_change 재사용)
--   - M9: phone regex 강화
--
-- 설계 결정:
--   - 수령인 이름·전화를 profile 과 분리 — 선물 발송, 회사 수령 등.
--   - is_default 는 부분 유니크 제약으로 "유저당 1개만 true" 강제.
--   - 우편번호 5자리 한국 규격. 문자열 저장 (0 prefix 보존).
-- ═══════════════════════════════════════════════════════════════════════════

create table public.addresses (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- 수령인
  name text not null,
  phone text not null,

  -- 주소
  zipcode text not null,
  addr1 text not null,
  addr2 text,

  -- 기본 배송지 플래그
  is_default boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 제약
  constraint addresses_name_length check (char_length(name) between 1 and 80),
  -- M9: E.164 또는 한국 하이픈 포맷
  constraint addresses_phone_format check (phone ~ '^\+?[0-9\-\s]{9,20}$'),
  constraint addresses_zipcode_format check (zipcode ~ '^[0-9]{5}$'),
  constraint addresses_addr1_length check (char_length(addr1) between 1 and 200),
  constraint addresses_addr2_length check (
    addr2 is null or char_length(addr2) between 1 and 200
  )
);

-- 조회 최적화
create index addresses_user_id_idx on public.addresses (user_id);

-- 유저당 is_default=true 최대 1개
create unique index addresses_one_default_per_user
  on public.addresses (user_id)
  where is_default = true;

-- 트리거
create trigger addresses_set_updated_at
  before update on public.addresses
  for each row execute function public.set_updated_at();

-- H8: id 변경 차단
create trigger addresses_prevent_id_change
  before update on public.addresses
  for each row execute function public.prevent_id_change();

comment on table public.addresses is
  '사용자 배송지. 1:N 관계 (기본 배송지 + 추가 주소).';
comment on column public.addresses.is_default is
  '유저당 1개만 true. addresses_one_default_per_user 부분 유니크 인덱스로 강제.';
