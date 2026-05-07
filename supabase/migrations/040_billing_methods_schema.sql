-- ═══════════════════════════════════════════════════════════════════════════
-- 040_billing_methods_schema.sql — Phase 3-A 빌링 통합 schema (ADR-008)
--
-- 목적:
--   토스페이먼츠 빌링(자동결제) 통합을 위한 신규 schema.
--   D-1 (코드 통합 진행, 활성화는 클라이언트 컨펌 후) 가설로 사전 작업.
--
-- 변경 사항:
--   1) profiles.customer_key uuid NOT NULL UNIQUE — 토스 customerKey (D-5)
--   2) billing_methods 테이블 — 빌링키 + 카드/계좌 메타 (D-6)
--   3) subscriptions.billing_method_id uuid FK — 자동결제 카드 지정
--   4) subscription_billing_failures 테이블 — 실패 이력 + 재시도 큐 (D-8)
--
-- 보안 결정 (S176):
--   - billing_methods · subscription_billing_failures = RLS service-role only
--     (정책 0개 + grant revoke). 클라이언트는 /api/billing/* 만 통과.
--   - 빌링키(billing_key) 는 절대 클라이언트 직접 노출 금지.
--   - 향후 마스킹 view 분리(L5)는 Phase 3-B 마이페이지 카드 목록 UI 시 후속.
--
-- 의존:
--   - 001_profiles.sql (profiles)
--   - 003_orders.sql (payment_method enum: 'card', 'transfer', 'easypay')
--   - 005_subscriptions.sql (subscriptions)
--
-- 후속:
--   - 041 — 기존 테스트 데이터 truncate (D-4)
--   - 042 — 026 RPC subscription INSERT 시점 변경 (D-9)
--
-- 참조:
--   - docs/adr/ADR-008-toss-billing-integration.md §3.3
--   - 토스 빌링 API: https://docs.tosspayments.com/reference#자동결제-승인
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. profiles.customer_key (D-5) ──────────────────────────────────────
-- UUID 권장 (자동증가 숫자는 NOT_MATCHES_CUSTOMER_KEY 위험). 회원당 1개 불변.
alter table public.profiles
  add column if not exists customer_key uuid not null default gen_random_uuid();

create unique index if not exists profiles_customer_key_uniq
  on public.profiles (customer_key);

comment on column public.profiles.customer_key is
  '토스 빌링 customerKey (UUID). 회원당 1개 불변. 빌링키 발급·결제 호출 시 사용 (D-5).';

-- customer_key 불변 트리거 (D-5 — prevent_id_change 패턴 답습)
-- INSERT 시 default 채움, UPDATE 차단. service_role 도 차단.
create or replace function public.prevent_customer_key_change()
returns trigger
language plpgsql
as $$
begin
  if new.customer_key is distinct from old.customer_key then
    raise exception 'profiles.customer_key is immutable (managed by signup)'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_customer_key_change
  before update on public.profiles
  for each row execute function public.prevent_customer_key_change();


-- ── 2. billing_methods 테이블 (D-6) ─────────────────────────────────────
-- 한 사용자가 여러 카드/계좌 등록 가능. is_default 1개만 선택 가능.
-- 빌링키는 토스 발급 후 즉시 저장 (재조회 불가).
create table public.billing_methods (
  id                       uuid primary key default gen_random_uuid(),

  user_id                  uuid not null
    references public.profiles(id) on delete cascade,

  -- 토스 빌링키 — 평생 토큰. 결제 호출 시 URL path parameter.
  billing_key              text not null unique,

  -- 결제 수단. payment_method enum 재사용 ('card' | 'transfer' 만 허용)
  -- 'easypay' 는 토스가 빌링 미지원 — D-2 결정.
  method                   public.payment_method not null
    check (method in ('card', 'transfer')),

  -- 카드용 (계좌이체 시 NULL)
  card_company             text,
  card_number_masked       text,  -- '****-****-****-1234' 포맷
  expires_at               date,  -- 카드 만료일 (만료 30일 전 알림)

  -- 계좌이체용 (카드 시 NULL)
  bank_name                text,
  account_number_masked    text,

  -- 운영
  is_default               boolean not null default false,
  registered_at            timestamptz not null default now(),
  deleted_at               timestamptz,  -- soft delete

  -- 방어적 제약: method 와 메타 컬럼 정합
  constraint billing_methods_card_meta_consistency check (
    method <> 'card' or (card_company is not null and card_number_masked is not null)
  ),
  constraint billing_methods_transfer_meta_consistency check (
    method <> 'transfer' or (bank_name is not null and account_number_masked is not null)
  ),
  constraint billing_methods_card_masked_format check (
    card_number_masked is null or card_number_masked ~ '^\*{4}-\*{4}-\*{4}-[0-9]{4}$'
  )
);

-- 인덱스
create index billing_methods_user_id_idx
  on public.billing_methods (user_id)
  where deleted_at is null;

-- 사용자당 default 카드 1개만 강제 (soft-deleted 제외)
create unique index billing_methods_user_default_uniq
  on public.billing_methods (user_id)
  where is_default = true and deleted_at is null;

-- 카드 만료 30일 전 알림 배치용
create index billing_methods_expires_at_idx
  on public.billing_methods (expires_at)
  where method = 'card' and deleted_at is null and expires_at is not null;

comment on table public.billing_methods is
  '토스 빌링 등록 카드/계좌 (D-6). RLS service-role only — /api/billing/* 만 통과.';
comment on column public.billing_methods.billing_key is
  '토스 빌링키 (평생 토큰). 절대 클라이언트 노출 금지. 결제 호출 URL path param.';
comment on column public.billing_methods.is_default is
  '사용자당 1개만 true. partial unique index 로 강제.';
comment on column public.billing_methods.deleted_at is
  'soft delete. orders/payments 가 billing_method_id 참조하는 동안 hard delete 차단.';

-- RLS service-role only (정책 0개 = 모든 client 차단)
alter table public.billing_methods enable row level security;
revoke all on public.billing_methods from anon, authenticated;
grant all on public.billing_methods to service_role;


-- ── 3. subscriptions.billing_method_id FK ───────────────────────────────
-- 어떤 카드/계좌로 자동결제할지 지정. 카드 삭제(soft) 시 set null.
alter table public.subscriptions
  add column if not exists billing_method_id uuid
  references public.billing_methods(id) on delete set null;

create index if not exists subscriptions_billing_method_id_idx
  on public.subscriptions (billing_method_id)
  where billing_method_id is not null;

comment on column public.subscriptions.billing_method_id is
  '자동결제에 사용할 빌링 수단 (D-6). NULL = 미지정 — 결제 수단 재등록 필요.';


-- ── 4. subscription_billing_failures (D-8) ──────────────────────────────
-- 빌링 실패 이력 + 재시도 큐. cron 이 retry_at <= now() 인 row 재처리.
create table public.subscription_billing_failures (
  id              uuid primary key default gen_random_uuid(),

  subscription_id uuid not null
    references public.subscriptions(id) on delete cascade,

  attempt_at      timestamptz not null default now(),

  -- 토스 에러 코드 (REJECT_CARD_COMPANY · INVALID_CARD · 등)
  error_code      text not null,
  error_message   text,

  -- 재시도 정책 (D-8 매트릭스): 24h → 48h → 72h → 일시중지
  retry_at        timestamptz,

  -- 성공 시 채움 — null 이면 미해결 (재시도 대기 또는 일시중지)
  resolved_at     timestamptz
);

-- 재시도 큐 조회 (cron)
create index subscription_billing_failures_retry_idx
  on public.subscription_billing_failures (retry_at)
  where resolved_at is null and retry_at is not null;

-- subscription 단위 이력 조회
create index subscription_billing_failures_subscription_idx
  on public.subscription_billing_failures (subscription_id, attempt_at desc);

comment on table public.subscription_billing_failures is
  '빌링 자동결제 실패 이력 + 재시도 큐 (D-8). RLS service-role only.';
comment on column public.subscription_billing_failures.retry_at is
  '재시도 예정 시각. cron 이 retry_at <= now() AND resolved_at IS NULL 인 row 처리.';

-- RLS service-role only
alter table public.subscription_billing_failures enable row level security;
revoke all on public.subscription_billing_failures from anon, authenticated;
grant all on public.subscription_billing_failures to service_role;
