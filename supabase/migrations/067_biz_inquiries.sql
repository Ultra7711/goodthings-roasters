-- ═══════════════════════════════════════════════════════════════════════════
-- 067_biz_inquiries.sql — B2B 비즈니스 문의 (S243-A-2)
--
-- 배경:
--   - /biz-inquiry 페이지의 BizInquiryPage submit 처리.
--   - 기존: toast 만 표시 후 폼 리셋 — 데이터 미저장.
--   - 변경: Supabase 저장 + 운영자 알림 메일 (Resend · notifications.ts) 병행.
--
-- 컬럼 설계:
--   - id / created_at — 표준 시스템 컬럼
--   - user_id (nullable FK) — 회원이면 cookies 인증으로 자동 연결, 비회원은 null
--   - name/email/phone/company/biz_type/address — 필수 6
--   - reg_num/equipment/current_bean — 선택 텍스트
--   - products (text[]) — 복수 선택 칩
--   - monthly_volume/delivery_cycle — 선택 드롭다운
--   - message — 필수 textarea
--   - consent_at — 개인정보 수집·이용 동의 시점 (PIPA 증빙)
--   - status (pending/contacted/closed) — admin 처리 상태 (Phase 2 admin 페이지에서 갱신)
--
-- 명칭 결정:
--   - `type` → `biz_type` (예약어/혼동 회피 · TS BIZ_TYPE_OPTIONS 답습)
--   - `volume` → `monthly_volume` · `cycle` → `delivery_cycle` (도메인 명시)
--
-- RLS:
--   - anon + authenticated INSERT 허용 (문의 제출 — 게스트 + 회원 공통)
--   - admin SELECT/UPDATE/DELETE 전체 (운영자 처리)
--   - owner SELECT 자기 record (회원 자기 문의 이력 — Phase 2)
--
-- INDEX:
--   - created_at desc — admin 목록 정렬
--   - status — admin 필터
--   - user_id — owner 조회
--
-- Rollback:
--   - DROP TABLE public.biz_inquiries CASCADE (데이터 손실)
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.biz_inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,

  -- 필수 텍스트 6
  name text not null,
  email text not null,
  phone text not null,
  company text not null,
  biz_type text not null,
  address text not null,

  -- 선택 텍스트
  reg_num text,
  equipment text,
  current_bean text,

  -- 선택 멀티/드롭다운
  products text[] not null default '{}'::text[],
  monthly_volume text,
  delivery_cycle text,

  -- 필수 메시지
  message text not null,

  -- PIPA 동의 시점 (NOT NULL — 제출 시점에 항상 기록)
  consent_at timestamptz not null default now(),

  -- admin 처리 상태
  status text not null default 'pending' check (status in ('pending', 'contacted', 'closed')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.biz_inquiries is
  'B2B 비즈니스 문의 (/biz-inquiry) — 게스트 + 회원 공통. 운영자 알림 메일은 Resend (notifications.ts).';
comment on column public.biz_inquiries.user_id is
  '회원 제출 시 auth.users FK 연결, 비회원 null. auth.users 삭제 시 null 보존.';
comment on column public.biz_inquiries.biz_type is
  '업종 (BIZ_TYPE_OPTIONS · cafe/bakery/restaurant/hotel/office/coworking/distributor/other).';
comment on column public.biz_inquiries.products is
  '관심 제품 multi-select (BIZ_PRODUCT_OPTIONS · bean-blend/bean-single/decaf/drip-bag/oem/retail).';
comment on column public.biz_inquiries.monthly_volume is
  '예상 월 사용량 (BIZ_VOLUME_OPTIONS · under5/5to15/15to30/30to50/over50/undecided).';
comment on column public.biz_inquiries.delivery_cycle is
  '희망 납품 주기 (BIZ_CYCLE_OPTIONS · weekly/monthly/monthly2/undecided).';
comment on column public.biz_inquiries.consent_at is
  '개인정보 수집·이용 동의 시점 — PIPA 증빙. 제출 시 반드시 NOW() 기록.';
comment on column public.biz_inquiries.status is
  'admin 처리 상태 — pending(신규) / contacted(연락중) / closed(종결).';

create index if not exists biz_inquiries_created_at_idx
  on public.biz_inquiries (created_at desc);
create index if not exists biz_inquiries_status_idx
  on public.biz_inquiries (status);
create index if not exists biz_inquiries_user_id_idx
  on public.biz_inquiries (user_id);

-- updated_at trigger (set_updated_at 답습)
create trigger biz_inquiries_set_updated_at
  before update on public.biz_inquiries
  for each row execute function public.set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.biz_inquiries enable row level security;

-- (1) anon + authenticated INSERT — 비회원 + 회원 모두 문의 제출 가능
create policy "biz_inquiries_anyone_insert"
  on public.biz_inquiries
  for insert
  to anon, authenticated
  with check (true);

-- (2) authenticated SELECT 자기 record — 회원 자기 문의 이력 (Phase 2 마이페이지)
create policy "biz_inquiries_owner_select"
  on public.biz_inquiries
  for select
  to authenticated
  using (auth.uid() = user_id);

-- (3) admin SELECT 전체 — 운영자 목록 조회
create policy "biz_inquiries_admin_select"
  on public.biz_inquiries
  for select
  to authenticated
  using (public.is_admin((select auth.uid())));

-- (4) admin UPDATE 전체 — status 변경 (pending → contacted → closed)
create policy "biz_inquiries_admin_update"
  on public.biz_inquiries
  for update
  to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

-- (5) admin DELETE 전체 — 운영자 정리
create policy "biz_inquiries_admin_delete"
  on public.biz_inquiries
  for delete
  to authenticated
  using (public.is_admin((select auth.uid())));
