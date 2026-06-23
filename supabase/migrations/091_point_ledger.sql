-- ═══════════════════════════════════════════════════════════════════════════
-- 091_point_ledger.sql — 포인트 원장 (append-only) (Phase 1)
--
-- 목적 (docs/points-implementation-plan.md §4·§5):
--   모든 포인트 변동의 불변 이력. 감사·분쟁·reconciliation 의 단일 근거(SoT).
--   잔액(profiles.point_balance)은 이 원장의 트리거 동기화 결과일 뿐이다.
--
-- 설계 (006_payment_transactions.sql append-only 패턴 답습):
--   - append-only : INSERT 만. UPDATE/DELETE 없음(092 RLS·정책 미선언으로 차단).
--   - idempotency_key UNIQUE : 동일 키 재호출 시 2번째 INSERT 차단 → 이중 적립/사용
--     방지(T3). 결제 멱등 3중 패턴과 동일.
--   - amount 부호 규칙 : earned/reversed = 양수, used/expired = 음수, adjusted = 양/음.
--     CHECK 제약으로 event_type 과 부호 정합성 강제.
--
-- FK on delete:
--   - user_id  : profiles ON DELETE CASCADE — 탈퇴 시 회원 자산과 함께 소멸
--     (015_account_delete 의 'profiles FK CASCADE 자동 정리' 일관. 포인트는
--      환불의무 없는 회원 자산이라 익명 보존 대상 아님).
--   - order_id : orders ON DELETE SET NULL — 주문은 익명화(삭제 아님)되므로 거의
--     발생 안 함. nullable(행동 적립은 주문 없음).
--   - reversing_id : 자기참조. reversed 행이 원본 used 행을 가리킴(환불 추적, Phase 3).
-- ═══════════════════════════════════════════════════════════════════════════

create table public.point_ledger (
  id uuid primary key default gen_random_uuid(),

  -- 포인트 소유 회원. 탈퇴 시 cascade.
  user_id uuid not null references public.profiles(id) on delete cascade,

  -- 결제 적립/사용의 주문 연결. 행동 적립(가입·리뷰·생일)은 NULL.
  order_id uuid references public.orders(id) on delete set null,

  event_type public.point_event_type not null,
  source     public.point_source     not null,

  -- 원 단위 정수. earned/reversed = 양수, used/expired = 음수, adjusted = 양/음.
  amount integer not null,

  -- T3 멱등: (order_id + event) 또는 이벤트 고유 ID 기반. 중복 INSERT → 23505.
  idempotency_key text not null,

  -- DEC-P3: 만료 구조 지원. 초기 무만료(NULL). 만료 활성화 sprint 에서 소비.
  expires_at timestamptz,

  -- 환불 복원(reversed) 시 원본 used 행 참조(Phase 3 추적용).
  reversing_id uuid references public.point_ledger(id) on delete set null,

  description text,
  created_at  timestamptz not null default now(),

  -- 0 변동 금지(노이즈 행 차단)
  constraint point_ledger_amount_nonzero check (amount <> 0),

  -- event_type ↔ amount 부호 정합성(무결성 강화)
  constraint point_ledger_amount_sign check (
    (event_type in ('earned', 'reversed') and amount > 0)
    or (event_type in ('used', 'expired') and amount < 0)
    or (event_type = 'adjusted')
  ),

  -- description 길이 방어
  constraint point_ledger_description_length check (
    description is null or char_length(description) between 1 and 200
  ),

  -- T3: 동일 키 중복 INSERT 차단 → 재시도 자연 skip
  constraint point_ledger_idempotency_unique unique (idempotency_key)
);

-- ── 인덱스 ────────────────────────────────────────────────────────────────
-- 본인 내역 조회(최신순)
create index point_ledger_user_created_idx
  on public.point_ledger (user_id, created_at desc);

-- 주문별 적립/사용 조회(주문내역 U8)
create index point_ledger_order_id_idx
  on public.point_ledger (order_id)
  where order_id is not null;

-- 만료 도래분 스캔(만료 활성화 시)
create index point_ledger_expires_at_idx
  on public.point_ledger (expires_at)
  where expires_at is not null;

comment on table public.point_ledger is
  '포인트 원장(append-only). 모든 적립/사용/만료/가감/복원의 불변 이력. '
  'service_role RPC 경유만 INSERT(092 RLS). 잔액=SUM(amount) 불변식(T7).';
comment on column public.point_ledger.amount is
  '원 단위 정수. earned/reversed=양수, used/expired=음수, adjusted=양/음(CHECK 강제).';
comment on column public.point_ledger.idempotency_key is
  'T3 멱등 키. UNIQUE 위반 → 23505 → 호출자 skip. 이중 적립/사용 방지.';
comment on column public.point_ledger.expires_at is
  'DEC-P3 만료 구조 지원. 초기 무만료(NULL). 만료 활성화 sprint 에서 FIFO 소비.';
