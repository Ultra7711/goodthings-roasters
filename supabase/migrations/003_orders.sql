-- ═══════════════════════════════════════════════════════════════════════════
-- 003_orders.sql — orders (주문 헤더)
--
-- 리뷰 Pass 1 반영 (2026-04-16):
--   - C3: user_id ON DELETE RESTRICT (탈퇴 시 주문 있으면 삭제 차단)
--   - C4: agreed_terms/privacy boolean → agreed_at + terms_version (법적 증빙)
--   - C5: discount_amount + total = subtotal + shipping_fee - discount
--   - H5: order_number DB sequence + BEFORE INSERT 트리거 (동시성 보장)
--   - H6: guest_password_hash → guest_lookup_pin_hash (용도 명확화)
--   - H7: tracking_number, carrier (배송 추적)
--   - M1: shipping_message → code + custom 분리
--   - M3: admin_notes (어드민 메모)
--   - M4: order_status 에 refund_requested, refund_processing 추가
--   - M6: (status, created_at DESC) 복합 인덱스
--   - M10: guest_email/hash 빈 문자열 차단
--
-- 설계 결정:
--   1. 비회원 주문 지원 — user_id NULL + guest_email + guest_lookup_pin_hash
--   2. 주문 불변성 (snapshot pattern) — 배송지·상품 복사 저장
--   3. 가격은 정수 (원 단위). KRW 는 소수점 없음.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── enum 타입 ────────────────────────────────────────────────────────
create type public.order_status as enum (
  'pending',             -- 결제 대기 (무통장입금 입금 전)
  'paid',                -- 결제 완료
  'shipping',            -- 배송 중
  'delivered',           -- 배송 완료
  'cancelled',           -- 주문 취소
  'refund_requested',    -- 환불 신청됨 (M4)
  'refund_processing',   -- 환불 처리 중 (M4)
  'refunded'             -- 환불 완료
);

create type public.payment_method as enum (
  'card',       -- 체크/신용카드 (토스페이먼츠)
  'transfer'    -- 계좌이체/무통장입금
);

-- ── H5: order_number 자동 채번 ────────────────────────────────────────
-- 클라 생성 + 5자리 랜덤은 동시성 충돌 가능 → DB sequence 로 이관.
create sequence public.order_number_seq
  start with 1 increment by 1 no maxvalue no cycle;

create or replace function public.set_order_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_seq integer;
begin
  if new.order_number is null then
    v_seq := nextval('public.order_number_seq');
    new.order_number := 'GT-'
      || to_char(now() at time zone 'Asia/Seoul', 'YYYYMMDD')
      || '-'
      || lpad((v_seq % 100000)::text, 5, '0');
  end if;
  return new;
end;
$$;

-- ── orders 테이블 ─────────────────────────────────────────────────────
create table public.orders (
  id uuid primary key default gen_random_uuid (),

  -- UI 노출 식별자 (H5: 트리거로 자동 채번)
  order_number text not null unique,

  -- C3: RESTRICT — 주문이 있으면 auth.users 삭제 차단.
  -- 개인정보 처리는 별도 soft-delete/익명화 로직 (Phase 3).
  user_id uuid references auth.users (id) on delete restrict,

  -- 비회원 주문 필드
  guest_email text,
  -- H6: 용도 명확화 (주문조회용 PIN 해시, 비밀번호 아님 — rate limit 필수)
  guest_lookup_pin_hash text,

  -- 연락처 스냅샷 (profile 변경과 무관)
  contact_email text not null,
  contact_phone text not null,

  -- 배송지 스냅샷 (addresses 변경/삭제와 무관)
  shipping_name text not null,
  shipping_phone text not null,
  shipping_zipcode text not null,
  shipping_addr1 text not null,
  shipping_addr2 text,
  -- M1: 프리셋 코드 vs 직접입력 분리 (리포팅 편의)
  shipping_message_code text,
  shipping_message_custom text,

  -- 결제
  payment_method public.payment_method not null,
  bank_name text,
  depositor_name text,

  -- H7: 배송 추적
  tracking_number text,
  carrier text,

  -- 금액 (원 단위 정수)
  subtotal integer not null,
  shipping_fee integer not null,
  -- C5: 쿠폰/프로모션 할인
  discount_amount integer not null default 0,
  total_amount integer not null,

  -- 상태
  status public.order_status not null default 'pending',

  -- C4: 약관 동의 기록 (전자상거래법 제21조 증빙)
  agreed_at timestamptz not null,
  terms_version text not null,

  -- M3: 운영 메모 (어드민 전용)
  admin_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 제약
  constraint orders_number_format check (order_number ~ '^GT-[0-9]{8}-[0-9]{5}$'),

  -- M10: 회원·게스트 배타 + 빈 문자열 차단
  constraint orders_user_or_guest check (
    (user_id is not null
      and guest_email is null
      and guest_lookup_pin_hash is null)
    or
    (user_id is null
      and guest_email is not null and char_length(guest_email) > 0
      and guest_lookup_pin_hash is not null and char_length(guest_lookup_pin_hash) > 0)
  ),

  -- 결제수단과 계좌이체 필드 일관성
  constraint orders_transfer_fields check (
    (payment_method = 'transfer'
      and bank_name is not null and depositor_name is not null)
    or
    (payment_method = 'card'
      and bank_name is null and depositor_name is null)
  ),

  -- 금액 제약
  constraint orders_subtotal_positive check (subtotal > 0),
  constraint orders_shipping_fee_nonneg check (shipping_fee >= 0),
  constraint orders_discount_nonneg check (discount_amount >= 0),
  constraint orders_discount_within_subtotal check (discount_amount <= subtotal),
  -- C5: 총액 = 소계 + 배송비 - 할인
  constraint orders_total_matches check (
    total_amount = subtotal + shipping_fee - discount_amount
  ),

  -- M1: 프리셋/커스텀 메시지는 배타 (둘 다 NULL 허용)
  constraint orders_shipping_message_exclusive check (
    shipping_message_code is null or shipping_message_custom is null
  ),

  -- H7: 추적번호/택배사 페어
  constraint orders_tracking_pair check (
    (tracking_number is null and carrier is null)
    or
    (tracking_number is not null and carrier is not null)
  )
);

-- 인덱스
create index orders_user_id_idx on public.orders (user_id) where user_id is not null;
create index orders_guest_email_idx on public.orders (guest_email) where guest_email is not null;
create index orders_created_at_idx on public.orders (created_at desc);
-- M6: 어드민 대시보드 (status + 최신순)
create index orders_status_created_at_idx on public.orders (status, created_at desc);

-- 트리거
-- H5: order_number 자동 채번
create trigger orders_set_order_number
  before insert on public.orders
  for each row execute function public.set_order_number();

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

comment on table public.orders is
  '주문 헤더. 비회원 주문 지원 (user_id NULL + guest_email + guest_lookup_pin_hash).';
comment on column public.orders.order_number is
  'GT-YYYYMMDD-NNNNN. BEFORE INSERT 트리거로 자동 채번 (H5 — 동시성 보장).';
comment on column public.orders.guest_lookup_pin_hash is
  '비회원 주문조회용 PIN 해시 (bcrypt). 비밀번호 아님 — API 레이어 rate limit 필수.';
comment on column public.orders.agreed_at is
  '약관 동의 시각 (전자상거래법 제21조 증빙).';
comment on column public.orders.terms_version is
  '동의한 약관 버전 문자열 (예: 2026-04-01). 이력 추적용.';
