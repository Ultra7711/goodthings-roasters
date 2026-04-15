-- ═══════════════════════════════════════════════════════════════════════════
-- 006_payment_transactions.sql — 결제 트랜잭션 로그
--
-- 리뷰 Pass 1 신규 (H4 — 2026-04-16):
--   - TossPayments 웹훅 멱등성 확보 (idempotency_key UNIQUE)
--   - 결제 이벤트 감사 로그 — 금액·상태 변경 추적
--   - RLS: service_role 전용 (클라이언트 전면 차단 — 007 에서 설정)
--
-- 설계:
--   - order_id FK (orders cascade 받지 않음 — 결제 이력 보존)
--   - idempotency_key UNIQUE — 같은 웹훅 재시도 시 INSERT 실패 → 재처리 skip
--   - raw_payload jsonb — 원본 보관 (공급자 포맷 변경 대응)
-- ═══════════════════════════════════════════════════════════════════════════

create type public.payment_event_type as enum (
  'payment_approved',    -- 결제 승인
  'payment_failed',      -- 결제 실패
  'payment_cancelled',   -- 결제 취소
  'refund_requested',    -- 환불 신청
  'refund_completed',    -- 환불 완료
  'webhook_received'     -- 일반 웹훅 (디버깅·원본 기록용)
);

create table public.payment_transactions (
  id uuid primary key default gen_random_uuid (),

  -- 결제 이력은 주문 삭제에도 보존 (감사 목적)
  order_id uuid not null references public.orders (id) on delete restrict,

  -- TossPayments paymentKey (없는 케이스 있음 — 실패 웹훅 등)
  provider_payment_key text,

  event_type public.payment_event_type not null,

  -- 원 단위 정수. 환불은 음수 허용.
  amount integer not null,

  -- 원본 페이로드 (디버깅·감사)
  raw_payload jsonb,

  -- H4: 웹훅 멱등성 키 — 공급자 제공 이벤트 ID 또는
  -- (order_id + event_type + provider_payment_key + timestamp) 조합.
  idempotency_key text not null,

  created_at timestamptz not null default now(),

  -- H4: 동일 키 중복 INSERT 차단 → 재시도 웹훅 자연 skip
  constraint payment_transactions_idempotency_unique unique (idempotency_key)
);

-- 인덱스
create index payment_transactions_order_id_idx on public.payment_transactions (order_id);
create index payment_transactions_provider_key_idx
  on public.payment_transactions (provider_payment_key)
  where provider_payment_key is not null;
create index payment_transactions_created_at_idx on public.payment_transactions (created_at desc);
create index payment_transactions_event_type_idx on public.payment_transactions (event_type);

comment on table public.payment_transactions is
  '결제 트랜잭션 로그. 웹훅 멱등성 + 감사 로그. service_role 전용 (RLS).';
comment on column public.payment_transactions.idempotency_key is
  '웹훅 중복 처리 방지. UNIQUE 제약으로 두 번째 INSERT → 23505 → 앱 레이어 skip.';
comment on column public.payment_transactions.amount is
  '원 단위 정수. 환불 이벤트는 음수.';
