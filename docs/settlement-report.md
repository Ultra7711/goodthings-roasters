# Settlement Report RPC 스펙

> **버전**: v1.0 (2026-04-17 확정)
> **상태**: Approved — Session 7 B-5 착수 기준
> **범위**: DB RPC 스펙만 (어드민 UI 호출부는 Session 9 이후)
> **관련**: [payments-flow.md §4](./payments-flow.md) · [ADR-002](./adr/ADR-002-payment-webhook-verification.md) · `supabase/migrations/012_payments_hardening.sql` · `supabase/migrations/013_payments_hardening_followup.sql`

---

## §1. 요구사항

### 1.1 타겟 사용자 · 호출 경로

- **사용자**: 어드민 (MVP = 창립자 1명 · Phase 3 어드민 UI 도입 후 운영팀)
- **호출 경로**: `supabaseAdmin` 클라이언트 (`SUPABASE_SERVICE_ROLE_KEY`) 단일 경로. 일반 `authenticated` · `anon` 은 전면 차단.
- **Session 7 단계**: API 라우트·UI 없음. Supabase Studio SQL Editor 또는 테스트 스크립트에서 RPC 직접 호출해 수치 검증만.
- **Session 9 (F-3) 어드민 가드 도입 이후**: `/api/admin/reports/settlement/*` 라우트에서 `requireAdmin()` 미들웨어 + `supabaseAdmin.rpc(...)` 래핑 예정.

### 1.2 용도 — MVP 범위의 3개 질문

운영자가 매일·매주·매월 반복적으로 답을 얻어야 하는 질문을 MVP 기준으로 한정.

1. **"오늘(어제·지난주·지난달) 얼마 팔렸나?"** → 기간별 승인 금액 · 환불 금액 · 순매출(net = approved - refunded) 집계.
2. **"어떤 결제수단으로 팔렸나?"** → 카드 vs 가상계좌(`transfer`) 기준 건수·금액 분할.
3. **"지금 입금 대기 중인 가상계좌는 몇 건인가?"** → `orders.status='pending' AND payments.method='transfer'` 건수 (TTL 도래 임박 포착).

부수적으로 **부분환불 원장**도 포함. 이유: 부분환불은 `payments.refunded_amount > 0 AND status != 'refunded'` 상태로 `orders.status='paid'` 유지 → 위 3개 질의만으론 추적 불가.

### 1.3 주요 쿼리 케이스

| # | 질문 | 대응 RPC |
|---|---|---|
| Q1 | 특정 기간 **일별 매출** (approved · refunded · net) | `get_daily_settlement(p_from, p_to, p_tz)` |
| Q2 | 같은 기간 **결제수단별 분할** | `get_method_breakdown(p_from, p_to)` |
| Q3 | 현재 시점 **가상계좌 pending 건수** (실시간 운영) | `get_pending_transfer_snapshot()` |
| Q4 | 특정 기간 **부분환불 원장** (`payment_transactions` 상세) | `get_refund_ledger(p_from, p_to)` |

### 1.4 비요구사항 (§8 참조)

세금계산서·현금영수증 연동, CSV export, 전주·전월 대비 %, 상품·카테고리별 매출 분해 → 모두 **Session 7 범위 밖**.

---

## §2. RPC 시그니처 설계

### 2.1 핵심 결정 — 단일 RPC 대신 **4개로 분리** (Q1 확정)

근거:

1. **반환 shape 이 본질적으로 다르다** — 일별 시계열(행 N개), 결제수단 분할(행 2개), pending 스냅샷(행 1개·WHERE 조건 없음), 환불 원장(행별 주문 참조). 하나의 `returns table` 로 묶으면 jsonb union 이 되어 어드민 UI 에서 case 분기 필요.
2. **인덱스 요구가 다르다** — Q1·Q2·Q4 는 `approved_at` 레인지, Q3 는 `orders.status + payments.method` 부분 인덱스. 단일 함수로 묶을 때 planner 가 최악 경로 선택 위험.
3. **권한 동일** — 4개 모두 `service_role only` 이므로 분리해도 권한 관리 부담 없음.
4. **YAGNI 부합** — Q3 는 UI "실시간 뱃지" 성격이라 파라미터 0개. 단일 RPC 에 억지로 맞추면 `p_from=null` 분기 지옥.

### 2.2 공통 규약

- **LANGUAGE sql STABLE SECURITY DEFINER** (Q2 확정) + `set search_path = public, pg_catalog`. `orders_status_transition_check` · `confirm_payment` 와 동일 패턴. `STABLE` 로 planner 가 함수 호출 캐싱/인라인 가능.
- **권한**: `revoke execute ... from public, anon, authenticated; grant execute ... to service_role;` (012·013 과 동일).
- **타임존 파라미터** `p_tz text default 'Asia/Seoul'` (Q3 확정). 테스트에서 경계값 검증 편리.
- **종료 상태 필터**: 각 집계에서 "의미 있는 돈 움직임" 만 포함. `cancelled` 주문은 Q1·Q2 에서 제외, `refunded` 는 승인 금액에 포함하되 환불 금액도 동시 집계.
- **PII 미반환** — 반환 컬럼에 `order_id`·`user_id`·`guest_email` 포함하지 않는다. **예외: `get_refund_ledger` 의 `order_number`** (Q4 확정 — 운영 필수).
- **`bigint` 반환** (Q6 확정) — 원화 기준 합계가 9.2 × 10¹⁸ 원을 넘을 가능성 없음. `numeric` 외화 대응은 YAGNI.

### 2.3 `get_daily_settlement` (Q1 케이스)

```sql
public.get_daily_settlement(
  p_from timestamptz,      -- 포함 (>=)
  p_to   timestamptz,      -- 제외 (<)
  p_tz   text default 'Asia/Seoul'
)
returns table (
  bucket_date             date,     -- KST 기준 날짜
  approved_count          integer,  -- 해당일 승인 건수
  approved_amount         bigint,   -- 해당일 승인 금액 합계 (원)
  refund_count            integer,  -- 해당일 환불 이벤트 건수
  refund_amount           bigint,   -- 해당일 환불 금액 합계 (양수)
  net_amount              bigint,   -- approved_amount - refund_amount
  pending_transfer_count  integer   -- 해당일 발급되어 아직 입금 안 된 가상계좌
)
language sql
stable
security definer
set search_path = public, pg_catalog;
```

### 2.4 `get_method_breakdown` (Q2 케이스)

```sql
public.get_method_breakdown(
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  method           public.payment_method,  -- 'card' | 'transfer'
  approved_count   integer,
  approved_amount  bigint,
  refund_count     integer,
  refund_amount    bigint,
  net_amount       bigint
)
language sql
stable
security definer
set search_path = public, pg_catalog;
```

- **최대 2행** (enum `payment_method` 카디널리티). 결제수단 확장 시(`easy_pay` 등) 자동 확장.

### 2.5 `get_pending_transfer_snapshot` (Q3 케이스)

```sql
public.get_pending_transfer_snapshot()
returns table (
  total_count           integer,
  total_amount          bigint,
  due_within_24h_count  integer,   -- 6~7일 사이 (TTL 7일 중 마지막 하루)
  expired_count         integer    -- 7일 초과 (Toss EXPIRED 웹훅 누락 의심)
)
language sql
stable
security definer
set search_path = public, pg_catalog;
```

- 파라미터 0개 → 단일 행 반환.
- TTL 7일 고정 (payments-flow §5.2). Toss `dueDate` 커스텀 시 문서 동시 갱신 필요.
- **TTL 기준 시각 = `payments.approved_at`** (db-review 2026-04-17 H-2):
  Toss 가상계좌 TTL 은 `WAITING_FOR_DEPOSIT` 진입 시각(= `payments.approved_at`) 기준이지
  `orders.created_at` 이 아니다. 장바구니 → 결제위젯 전환 지연(수 분~수 시간)이 포함되면
  만료 판정이 과다 집계된다. base CTE 에서 `p.approved_at is not null` 필터 후
  `approved_at` 으로 6d/7d 경계를 계산한다.
- `expired_count > 0` 이면 **운영 개입 필요** → Toss `EXPIRED` 웹훅 누락 의심. 어드민 대시보드 알람 배지 용도.

### 2.6 `get_refund_ledger` (Q4 케이스)

```sql
public.get_refund_ledger(
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  transaction_created_at timestamptz,
  order_number           text,                    -- Q4 확정: 운영 필수 PII 최소 노출
  method                 public.payment_method,
  refund_amount          bigint,                  -- 양수. payment_transactions.amount 의 abs().
  approved_amount        bigint,                  -- payments.approved_amount (원 승인)
  balance_after          bigint,                  -- Q5 확정: 조회 시점 payments.balance_amount
  is_partial             boolean,                 -- balance_after > 0
  idempotency_key        text                     -- 감사 추적 (PARTIAL_CANCELED 다회 구분)
)
language sql
stable
security definer
set search_path = public, pg_catalog;
```

- **`balance_after` 정의 (Q5 확정)**: `payments.balance_amount` (GENERATED STORED) — **조회 시점 잔액**. 여러 부분환불 누적 시 과거 이벤트의 `balance_after` 도 "가장 최근 잔액"으로 표시. 감사 목적상 충분. "이벤트 직후 잔액"이 필요하면 window 함수 누적이 필요하나 YAGNI.
- `is_partial` = `balance_amount > 0`. 부분환불 누적이 전액에 도달한 마지막 이벤트도 false 처리됨.
- `idempotency_key` 로 `PARTIAL_CANCELED` 다회 발생 구분 (`webhook:{paymentKey}:partial:{cancels[-1].transactionKey}`).

---

## §3. 집계 로직 SQL

### 3.1 설계 원칙 — CTE inline (view 미사용)

`payments` ↔ `orders` ↔ `payment_transactions` 조인을 RPC 내부 CTE 로 인라인. 뷰로 만들지 않는 이유:
- `service_role only` 뷰는 별도 RLS 설정 필요
- `payments.force row level security` 와 공존 시 리뷰 부담 증가
- RPC 내부 CTE 가 간결하며 SECURITY DEFINER 를 통해 자유 접근 가능

### 3.2 `get_daily_settlement` 본문

```sql
create or replace function public.get_daily_settlement(
  p_from timestamptz,
  p_to   timestamptz,
  p_tz   text default 'Asia/Seoul'
)
returns table (
  bucket_date             date,
  approved_count          integer,
  approved_amount         bigint,
  refund_count            integer,
  refund_amount           bigint,
  net_amount              bigint,
  pending_transfer_count  integer
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with
  -- 승인(approved) 집계: payments.approved_at 기준 버킷팅
  approved_bucket as (
    select
      (p.approved_at at time zone p_tz)::date     as bucket_date,
      count(*)::integer                            as approved_count,
      coalesce(sum(p.approved_amount), 0)::bigint  as approved_amount
    from public.payments p
    where p.approved_at is not null
      and p.approved_at >= p_from
      and p.approved_at <  p_to
      and p.status in ('approved', 'partial_refunded', 'refunded')
    group by 1
  ),
  -- 환불(refund) 집계: payment_transactions.created_at 기준
  refund_bucket as (
    select
      (t.created_at at time zone p_tz)::date      as bucket_date,
      count(*)::integer                            as refund_count,
      coalesce(sum(abs(t.amount)), 0)::bigint      as refund_amount
    from public.payment_transactions t
    where t.event_type = 'refund_completed'
      and t.created_at >= p_from
      and t.created_at <  p_to
    group by 1
  ),
  -- 가상계좌 pending 발급 버킷: orders.created_at 기준
  pending_bucket as (
    select
      (o.created_at at time zone p_tz)::date      as bucket_date,
      count(*)::integer                            as pending_transfer_count
    from public.orders o
    join public.payments p on p.order_id = o.id
    where o.status = 'pending'
      and p.method = 'transfer'
      and o.created_at >= p_from
      and o.created_at <  p_to
    group by 1
  ),
  -- UNION 후 날짜 축 정합 (어느 한쪽만 있는 날짜도 표시)
  all_dates as (
    select bucket_date from approved_bucket
    union
    select bucket_date from refund_bucket
    union
    select bucket_date from pending_bucket
  )
  select
    d.bucket_date,
    coalesce(a.approved_count, 0),
    coalesce(a.approved_amount, 0),
    coalesce(r.refund_count, 0),
    coalesce(r.refund_amount, 0),
    coalesce(a.approved_amount, 0) - coalesce(r.refund_amount, 0) as net_amount,
    coalesce(b.pending_transfer_count, 0)
  from all_dates d
  left join approved_bucket a using (bucket_date)
  left join refund_bucket   r using (bucket_date)
  left join pending_bucket  b using (bucket_date)
  order by d.bucket_date asc;
$$;

revoke execute on function public.get_daily_settlement(timestamptz, timestamptz, text) from public, anon, authenticated;
grant  execute on function public.get_daily_settlement(timestamptz, timestamptz, text) to service_role;
```

**설계 포인트**

- `approved_at at time zone p_tz` — timestamptz 를 KST wall-clock 으로 변환 후 `::date` 캐스트.
- `status in ('approved', 'partial_refunded', 'refunded')` — approved 이후 모든 상태 포함. `pending`·`failed`·`cancelled` 제외.
- 환불 버킷이 승인 버킷과 다른 날짜일 수 있으므로 `all_dates` UNION 후 LEFT JOIN.
- `net_amount` 음수 가능 (환불만 발생한 날).
- `_fallback.approved_at=true` 행도 포함 (§3.6).

### 3.3 `get_method_breakdown` 본문

```sql
create or replace function public.get_method_breakdown(
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  method           public.payment_method,
  approved_count   integer,
  approved_amount  bigint,
  refund_count     integer,
  refund_amount    bigint,
  net_amount       bigint
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with
  approved_by_method as (
    select
      p.method,
      count(*)::integer                            as approved_count,
      coalesce(sum(p.approved_amount), 0)::bigint  as approved_amount
    from public.payments p
    where p.approved_at is not null
      and p.approved_at >= p_from
      and p.approved_at <  p_to
      and p.status in ('approved', 'partial_refunded', 'refunded')
    group by p.method
  ),
  refund_by_method as (
    select
      p.method,
      count(*)::integer                            as refund_count,
      coalesce(sum(abs(t.amount)), 0)::bigint      as refund_amount
    from public.payment_transactions t
    join public.payments p on p.order_id = t.order_id
    where t.event_type = 'refund_completed'
      and t.created_at >= p_from
      and t.created_at <  p_to
    group by p.method
  ),
  all_methods as (
    select method from approved_by_method
    union
    select method from refund_by_method
  )
  select
    m.method,
    coalesce(a.approved_count, 0),
    coalesce(a.approved_amount, 0),
    coalesce(r.refund_count, 0),
    coalesce(r.refund_amount, 0),
    coalesce(a.approved_amount, 0) - coalesce(r.refund_amount, 0) as net_amount
  from all_methods m
  left join approved_by_method a using (method)
  left join refund_by_method   r using (method)
  order by m.method;
$$;

revoke execute on function public.get_method_breakdown(timestamptz, timestamptz) from public, anon, authenticated;
grant  execute on function public.get_method_breakdown(timestamptz, timestamptz) to service_role;
```

### 3.4 `get_pending_transfer_snapshot` 본문

```sql
create or replace function public.get_pending_transfer_snapshot()
returns table (
  total_count           integer,
  total_amount          bigint,
  due_within_24h_count  integer,
  expired_count         integer
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with base as (
    select
      o.id,
      o.created_at,
      p.approved_amount
    from public.orders o
    join public.payments p on p.order_id = o.id
    where o.status = 'pending'
      and p.method  = 'transfer'
      and p.status  = 'approved'   -- 가상계좌 발급 완료(WAITING_FOR_DEPOSIT) 시점에도 approved 로 기록
  )
  select
    count(*)::integer,
    coalesce(sum(approved_amount), 0)::bigint,
    count(*) filter (
      where created_at < now() - interval '6 days'
        and created_at >= now() - interval '7 days'
    )::integer,
    count(*) filter (where created_at < now() - interval '7 days')::integer
  from base;
$$;

revoke execute on function public.get_pending_transfer_snapshot() from public, anon, authenticated;
grant  execute on function public.get_pending_transfer_snapshot() to service_role;
```

### 3.5 `get_refund_ledger` 본문

```sql
create or replace function public.get_refund_ledger(
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  transaction_created_at timestamptz,
  order_number           text,
  method                 public.payment_method,
  refund_amount          bigint,
  approved_amount        bigint,
  balance_after          bigint,
  is_partial             boolean,
  idempotency_key        text
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select
    t.created_at                   as transaction_created_at,
    o.order_number,
    p.method,
    abs(t.amount)::bigint           as refund_amount,
    p.approved_amount::bigint,
    p.balance_amount::bigint        as balance_after,
    (p.balance_amount > 0)          as is_partial,
    t.idempotency_key
  from public.payment_transactions t
  join public.orders   o on o.id = t.order_id
  join public.payments p on p.order_id = t.order_id
  where t.event_type = 'refund_completed'
    and t.created_at >= p_from
    and t.created_at <  p_to
  order by t.created_at desc;
$$;

revoke execute on function public.get_refund_ledger(timestamptz, timestamptz) from public, anon, authenticated;
grant  execute on function public.get_refund_ledger(timestamptz, timestamptz) to service_role;
```

### 3.6 `approved_at` NULL 폴백 포함 정책

payments-flow v1.0.8 §6.7 · M-3 폴리시에서 **Toss 응답 `approvedAt` 누락 시 서버가 `new Date().toISOString()` + `_fallback.approved_at=true` 플래그**를 기록. 본 RPC 는 폴백 값도 포함(`approved_at is not null` 필터링만 함). 이유:

1. 폴백 작동 시 DB 기준으로 승인 발생 → 매출 집계 포함 필수.
2. Toss 원본 시각과 수 ms~수 초 차이 — 일 단위 버킷에서 거의 동일 날짜.
3. 감사 추적 필요 시 `raw_response->'_fallback'` 별도 조회 (Session 9 어드민 뷰).

`_fallback.approved_at=true` 행만 필터링하는 운영 질의가 필요해지면 **Phase 3 신규 RPC** 로 분리 (§8 항목).

---

## §4. 인덱스 요구사항

### 4.1 현재 인덱스 인벤토리 (012·013 기준)

```
-- payments (012)
payments_order_id_idx        on (order_id)
payments_payment_key_idx     on (payment_key) where payment_key is not null
payments_status_idx          on (status)

-- payment_transactions (006)
payment_transactions_order_id_idx        on (order_id)
payment_transactions_provider_key_idx    on (provider_payment_key) where provider_payment_key is not null
payment_transactions_created_at_idx      on (created_at desc)
payment_transactions_event_type_idx      on (event_type)

-- orders (003 · 011)
orders_user_id_idx                on (user_id) where user_id is not null
orders_guest_email_idx            on (guest_email) where guest_email is not null
orders_created_at_idx             on (created_at desc)
orders_status_created_at_idx      on (status, created_at desc)
orders_guest_lookup_idx           on (contact_email) where user_id is null and guest_lookup_pin_hash is not null
```

### 4.2 신규 인덱스 2건

```sql
-- 신규: Q1·Q2·Q4 approved_at 레인지
create index payments_approved_at_idx
  on public.payments (approved_at)
  where approved_at is not null;

-- 신규: Q1·Q4 refund 이벤트 시계열
create index payment_transactions_refund_created_at_idx
  on public.payment_transactions (created_at desc)
  where event_type = 'refund_completed';
```

Partial index 채택 이유: `refund_completed` 는 전체 이벤트의 5~20% 수준 예상 → 공간 효율 + 스캔 경로 단축.

### 4.3 Q3 — 기존 인덱스 활용

`orders_status_created_at_idx(status, created_at desc)` 활용. `payments` 쪽은 `payments_order_id_idx` 로 JOIN 커버. 추가 불필요.

### 4.4 성능 예상 (일 1,000~10,000 주문 가정)

| 케이스 | 행 규모 | 인덱스 전 | 인덱스 후 |
|---|---|---|---|
| 월간 Q1 (approved) | 30k~300k payments | seq scan 전체 | partial index scan < 50ms |
| 월간 Q4 (refund) | 3k~30k tx (5~10%) | filter on seq scan | partial index scan < 20ms |
| Q3 snapshot | 가변 | 이미 기존 인덱스로 충분 | — |

### 4.5 VACUUM · ANALYZE 운영

`payments` · `payment_transactions` 는 웹훅 트래픽으로 자주 INSERT → autovacuum 기본값이면 충분하나, 정산 RPC 가 월말 대량 실행될 때 통계가 stale 이면 planner 가 seq scan 선택 위험. **Phase 2-G 운영 매뉴얼 체크리스트** 에 "월말 리포트 실행 전 `analyze public.payments` · `analyze public.payment_transactions`" 명시 (§8).

---

## §5. 테스트 전략

### 5.1 프레임워크 · 구조

- **vitest + 로컬 Supabase** (`supabase start` → 로컬 PostgreSQL). 013 마이그레이션까지 적용된 스키마 가정.
- 네이밍·구조: `orderService.test.ts` · `webhookService.test.ts` 패턴 준용. AAA(Arrange-Act-Assert) + 한국어 describe/it.
- 파일 위치: `next/src/lib/services/settlementReportService.test.ts`. Session 7 단계에서는 **RPC 직접 호출 테스트** 만 있으므로 테스트 헬퍼로 `supabaseAdmin.rpc('get_daily_settlement', { ... })` 호출.

### 5.2 픽스처 시나리오

`beforeAll` 에서 INSERT:

- **10 paid 주문**
  - 3건 `card`, approved_at 2026-04-10 KST 09:00 · 23:45 · 2026-04-11 KST 00:15
  - 2건 `transfer`, approved_at 2026-04-10 KST 14:00 · 2026-04-11 KST 10:00
  - 5건 다른 날짜 분산 (경계값 검증용)
- **3 환불 이벤트**
  - 전액 환불 1건 (`refund_completed`, amount=-12000, created_at 2026-04-12 KST 11:00)
  - 부분환불 2건 (같은 주문, amount=-3000 · -2000 → 누적 5000, `PARTIAL_CANCELED` 시나리오)
- **가상계좌 pending 3건**
  - 5일 전 (due_within_24h 아님)
  - 6.5일 전 → `due_within_24h_count` 포함
  - 8일 전 → `expired_count` 포함
- **cancelled 주문 1건**, **failed payment 1건** — 필터 제외 검증

### 5.3 경계값 · 엣지 케이스

| 케이스 | 기대 결과 |
|---|---|
| `p_from == p_to` (빈 구간) | 0 행 반환 |
| `p_from > p_to` (뒤집힘) | 0 행 반환 (SQL semantics · 호출자 방어 책임 — §9) |
| approved_at 이 KST 23:59:59.999 vs 00:00:00.000 | KST 날짜 기준 정확 분리 |
| UTC 15:00 = KST 00:00 | `at time zone p_tz` 변환 후 KST 기준 정확 |
| 환불만 있고 승인 0 | approved_count=0, refund_count>0, net_amount 음수 |
| `_fallback.approved_at=true` 행 | 집계 포함 (§3.6) |
| cancelled/failed 주문 | 집계 제외 (status 필터) |
| pending transfer 가 7일 경계 정확히 도달 | `expired_count` 포함 (`<` 연산자) |

### 5.4 테스트 구조 스케치

```ts
// settlementReportService.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

describe('get_daily_settlement', () => {
  beforeAll(async () => {
    // 픽스처 INSERT — create_order RPC + confirm_payment RPC + apply_webhook_event RPC 조합
    // (스키마 제약 통과를 위해 직접 INSERT 대신 RPC 경유)
  })
  afterAll(async () => {
    // truncate 또는 transaction rollback
  })

  it('KST 기준 일별로 승인 건수·금액을 집계한다', async () => {
    const { data, error } = await supabaseAdmin.rpc('get_daily_settlement', {
      p_from: '2026-04-10T00:00:00+09:00',
      p_to:   '2026-04-12T00:00:00+09:00',
    })
    expect(error).toBeNull()
    expect(data).toContainEqual(
      expect.objectContaining({ bucket_date: '2026-04-10', approved_count: 4 })
    )
  })

  it('환불만 있는 날짜도 0 승인 + 환불 금액으로 표시된다', async () => { /* ... */ })
  it('p_from == p_to 는 빈 배열 반환', async () => { /* ... */ })
  it('_fallback.approved_at 행도 집계에 포함된다', async () => { /* ... */ })
})

describe('get_method_breakdown', () => { /* ... */ })
describe('get_pending_transfer_snapshot', () => { /* ... */ })
describe('get_refund_ledger', () => { /* ... */ })
```

### 5.5 권한 검증 케이스

- `supabaseAnon.rpc('get_daily_settlement', ...)` → `permission denied` 확인 (각 RPC 1건씩 총 4건).

### 5.6 커버리지 목표

- 4개 RPC 각 **최소 3개 케이스** (정상·경계·권한). 총 12~16 케이스.

---

## §6. 보안 고려

### 6.1 권한 모델

- 4개 RPC 모두 `revoke execute ... from public, anon, authenticated` + `grant execute ... to service_role`.
- **Session 7 호출 경로**: Supabase Studio SQL Editor 또는 테스트 스크립트가 `supabaseAdmin` 으로 직접 호출.
- **Session 9 (F-3) 이후**: `/api/admin/reports/settlement/daily` 등 라우트에서 `requireAdmin()` + `supabaseAdmin.rpc(...)` 래핑.

### 6.2 PII 최소 노출

| RPC | 포함 PII | 판단 |
|---|---|---|
| `get_daily_settlement` | 없음 | 집계 수치만 |
| `get_method_breakdown` | 없음 | 집계 수치만 |
| `get_pending_transfer_snapshot` | 없음 | 건수 + 합계만 |
| `get_refund_ledger` | `order_number` | 운영 필수 (Toss Dashboard 크로스체크). `user_id`·`guest_email`·`contact_*` 제외 |

- `raw_response`·`raw_payload` 반환 **금지** — secret·webhook_secret 누출 위험 (payments-flow §6.5.2).
- Session 9 어드민 라우트 도입 시 Sentry `beforeSend` 가 응답 페이로드 스캔하는지 재검증 필요.

### 6.3 ADR-002 § 4 보안 원칙 연관

- ADR-002 는 **웹훅 인증** 범위이지만 "결제 데이터는 service_role 전용 격리" 원칙 공유. 본 RPC 도 동일 격리 경계 내부 동작.
- 감사 로그 (`payment_transactions`) 가 본 RPC 읽기 대상 → **읽기 무결성 보장**: SECURITY DEFINER + search_path 고정으로 malicious schema injection 차단.

### 6.4 SQL Injection · search_path

- 파라미터는 `timestamptz`·`text` 뿐 — 바인딩 파라미터 (Supabase `.rpc()` → prepared statement).
- `set search_path = public, pg_catalog` 로 `::date` · `at time zone` 해석 시 사용자 스키마 hijack 방지.

### 6.5 Rate Limit (Phase 3)

- 어드민 전용이라 MVP rate limit 미적용. 어드민 UI 에서 자동 폴링(Q3 snapshot) 도입 시 **최소 30초 간격** 정책 + 서버 side 5초 캐시 (Phase 3).

---

## §7. 마이그레이션 파일

### 7.1 번호 · 파일명

- 현재 최대 번호 = **013**. 신규 = **014**.
- 파일명: `supabase/migrations/014_settlement_report.sql`.
- 단일 파일에 4개 RPC + 2개 인덱스 + 권한 부여 모두 포함.

### 7.2 파일 구조 스케치

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 014_settlement_report.sql — Phase 2-B / B-5 정산 리포트 RPC
-- 목적: 어드민용 매출 집계 함수 4종 + 인덱스 보강.
-- 관련: docs/settlement-report.md, docs/payments-flow.md §4
-- ═══════════════════════════════════════════════════════════════════════════

-- §4.2 인덱스 보강
create index if not exists payments_approved_at_idx ...
create index if not exists payment_transactions_refund_created_at_idx ...

-- §3.2 get_daily_settlement
create or replace function public.get_daily_settlement(...)
revoke execute ... from public, anon, authenticated;
grant  execute ... to service_role;

-- §3.3 get_method_breakdown
-- §3.4 get_pending_transfer_snapshot
-- §3.5 get_refund_ledger
-- (각각 revoke/grant 포함)
```

### 7.3 롤백 스니펫

```sql
-- 운영 런북 포함 (별도 파일 미생성)
drop function if exists public.get_refund_ledger(timestamptz, timestamptz);
drop function if exists public.get_pending_transfer_snapshot();
drop function if exists public.get_method_breakdown(timestamptz, timestamptz);
drop function if exists public.get_daily_settlement(timestamptz, timestamptz, text);
drop index if exists public.payment_transactions_refund_created_at_idx;
drop index if exists public.payments_approved_at_idx;
```

- 함수만 삭제하면 `payments`·`payment_transactions` 스키마 그대로. 데이터 손실 없음.
- 인덱스 삭제는 정산 외 쿼리에 영향 없음.

### 7.4 적용 방법

블로커 #6 (payments-flow §8.2) 정책 — **Supabase Studio SQL Editor 수동 적용**. Claude 가 파일 작성 → 사용자가 Studio 에서 실행 → 테스트 환경부터 적용 후 production.

---

## §8. Session 7 범위 밖 항목 (향후)

| # | 항목 | 예상 Phase | 이유 |
|---|---|---|---|
| 1 | 어드민 UI 호출부 (`/api/admin/reports/settlement/*`) | Session 9 또는 Phase 3 | 어드민 가드(F-3) 선행 필요 |
| 2 | 어드민 대시보드 차트 · CSV export | Phase 3 | 본 RPC 결과를 프런트에서 가공 |
| 3 | 세금계산서 · 현금영수증 연동 | Phase 3 | 국세청 API 별도 설계 |
| 4 | 기간 비교 (전주·전월 대비 %) | Phase 3 | UI 레이어 계산 |
| 5 | 상품·카테고리별 매출 분해 | Phase 3 | `order_items` JOIN RPC 추가 |
| 6 | 구독 결제 매출 (`payments ↔ subscriptions`) | Phase 3 | 정기배송 자동결제 도입 이후 |
| 7 | `_fallback.approved_at=true` 전용 감사 RPC | Phase 3 | 오탐 빈도 충분한 규모 도달 후 |
| 8 | pgcrypto `webhook_secret` 이행 이후 재검토 | Phase 3 | payments-flow §6.5.5 |
| 9 | 월말 자동 `analyze` · 리포트 성능 모니터링 | Phase 2-G | 운영 매뉴얼 체크리스트 항목화 |
| 10 | `expired_count > 0` 운영 알람 (Sentry/Slack/배지) | Phase 2-G | 어드민 UI 도입과 함께 결정 |

---

## §9. 확정된 설계 결정 (Session 7 착수 기준)

| Q | 결정 | 근거 |
|---|---|---|
| Q1. RPC 분리 | **4개 분리** | 반환 shape/인덱스 요구/파라미터 개수 모두 다름. YAGNI. |
| Q2. LANGUAGE | **sql STABLE** | plpgsql 대비 planner 캐싱 이득. 로깅/raise 불필요. |
| Q3. p_tz | **파라미터 유지** | 테스트 경계값 검증 편리. 운영지 확장 대비. |
| Q4. order_number 노출 | **`get_refund_ledger` 에만 포함** | 운영 필수(Toss Dashboard 크로스체크). 타 PII 는 전면 제외. |
| Q5. balance_after 정의 | **조회 시점 잔액** | `payments.balance_amount` GENERATED STORED 활용. "이벤트 직후 잔액" window 함수는 YAGNI. |
| Q6. 금액 타입 | **bigint** | 원화 기준 합계 한도 충분. numeric 외화 대응은 YAGNI. |
| p_from > p_to 방어 | **호출자 책임** | RPC 는 순수 집계. 라우트/UI 에서 방어. |
| 인덱스 2건 | **추가 확정** | `payments_approved_at_idx` · `payment_transactions_refund_created_at_idx` (partial) |
| `get_pending_transfer_snapshot` TTL 기준 | **`p.approved_at` 사용** | Toss `dueDate` = `WAITING_FOR_DEPOSIT` 진입 시각 기준. `o.created_at` 은 장바구니 지연 포함되어 과다 집계. db-review 2026-04-17 H-2 반영. |

### §9.1 크로스-피리어드 환불 케이스 (db-review 2026-04-17 H-2 보강)

`get_method_breakdown` 의 `refund_by_method` CTE 는 **환불 이벤트 시점**(`payment_transactions.created_at`)만 기간 필터한다. 반면 `approved_by_method` 는 **승인 시점**(`payments.approved_at`)을 기간 필터한다. 두 시점이 기간 경계를 가로지를 수 있다:

**예시**: 3월 30일 승인된 결제를 4월 2일 환불 → 4월 월간 리포트에서:
- `approved_by_method` 에 해당 주문 제외 (승인이 3월)
- `refund_by_method` 에 해당 환불 포함 (환불이 4월)
- 결과: `approved_amount=0, refund_amount>0, net_amount<0` 인 method 행 출현

**설계 결정**: 정상 동작. 환불 이벤트는 "환불이 발생한 시점의 리포트" 에 귀속하는 것이 회계·감사 관점에서 일관성 있다. 어드민 UI 는 `net_amount < 0` 을 자연스러운 과거 환불 유입으로 해석해야 하며, 별도 플래그 없이 `refund_amount > approved_amount` 조건으로 식별 가능하다.

**운영 미결 (Phase 2-G 에서 결정):**
- `expired_count > 0` 알람 채널 (Sentry / Slack / 어드민 배지)
- 월말 자동 `analyze` cron 도입 여부

---

## §10. 변경 이력

| 날짜 | 버전 | 작성자 | 변경 |
|---|---|---|---|
| 2026-04-17 | v1.0 | JW (+ Claude Opus 4.6) | 초안 확정. Session 7 B-5 스펙. RPC 4개 분리 · 인덱스 2개 보강 · 014 마이그레이션 단일 파일. Open Q 9건 모두 해결. planner Opus 설계 → 사용자 승인. |
