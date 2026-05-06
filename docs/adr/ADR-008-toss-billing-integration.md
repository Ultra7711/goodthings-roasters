# ADR-008 — 토스페이먼츠 빌링(자동결제) 통합

**상태:** Proposed (S173 작성, 클라이언트 빌링 계약 승인 대기)
**작성일:** 2026-05-07
**관련:** payments-flow.md, subscription-full-implementation-plan.md, ADR-002, ADR-005

---

## 1. 컨텍스트

### 1.1 현재 상태 (S173 시점)

- 정기배송 첫 회차 결제는 **토스 결제위젯 단발 결제**로 처리 중
- `customerKey = ANONYMOUS` 로 사용 → 빌링키 발급 불가
- `subscriptions` 테이블에 `next_delivery_at` 등 cycle 정보는 저장되지만 **다음 회차 자동 결제 로직 0** (cron·트리거·API 호출 모두 부재)
- 사실상 "1회성 결제 + 정기배송 라벨" 상태

### 1.2 비즈니스 요구

- 굳띵즈 로스터스 정기배송 = **카드/계좌 빌링키로 사이클마다 자동결제**
- 사용자 카드 한 번 등록으로 끝 (재입력 X)
- 일반 1회성 결제와 정기배송이 한 카트에 혼합 가능해야 함

### 1.3 토스 빌링 핵심 사실

- **빌링키 발급:** `requestBillingAuth('카드' | '계좌')` → authKey 콜백 → `POST /v1/billing/authorizations/issue` → billingKey
- **자동결제 호출:** `POST /v1/billing/{billingKey}` (billingKey + amount + customerKey + orderId + orderName)
- **재조회 불가:** 빌링키는 발급 즉시 안전 저장 필수
- **지원 결제수단:** 카드 + 계좌이체(퀵계좌이체). 간편결제(토스페이·카카오페이) 미지원
- **customerKey:** UUID 권장 (자동증가 숫자 보안 위험 — `NOT_MATCHES_CUSTOMER_KEY` 에러 가능)
- **운영:** 토스 빌링 사용은 별도 계약·심사 필요

---

## 2. 결정 사항

### D-1. 빌링 계약 활성화 시점

**결정:** 코드 통합은 진행하되, 운영 활성화는 **클라이언트(굳띵즈 카페 본사) 컨펌 후 토스 비즈센터 심사 신청** 통과 시점으로 미룸. 이미 카페에서 토스 키오스크 사용 중이므로 심사 자체는 어렵지 않을 것으로 예상.

**액션:** Phase 3-A 시작 전 클라이언트 컨펌 받기. 컨펌 받기 전에는 staging 환경에서 토스 sandbox 키로 검증.

### D-2. 정기배송 결제수단

**결정:** **카드 + 계좌이체(퀵계좌이체)** 모두 지원. 간편결제는 토스가 빌링 미지원이므로 정기배송 흐름에서 제외 (1회성 결제는 그대로 지원).

### D-3. 혼합 카트 처리 (옵션 A)

**결정:** 정기 + 일반 상품이 한 카트에 있을 때:

1. 사용자가 결제하기 클릭
2. **빌링키 발급 흐름** 진입 (`requestBillingAuth`) — 정기배송 카드/계좌 등록
3. 빌링키 발급 성공 → **즉시 정기배송 첫 회차 빌링 호출**
4. 별도로 **일반 상품용 위젯 결제 호출** (단발)
5. 두 결제 모두 성공해야 주문 완료

**대안 검토 (기각):**
- (B) 첫 회차는 위젯 결제 + 다음 회차부터 빌링 → 사용자가 카드를 두 번 입력해야 함 (UX ↓)
- (C) 정기와 일반을 별도 주문으로 강제 분리 → 카트 UX 복잡

### D-4. 기존 데이터 처리

**결정:** 현재 DB의 모든 정기배송·주문 데이터는 **개발 테스트 데이터** → 초기화. 운영 시작 시 clean slate.

**액션:** Phase 3 완료 후 staging→production 전환 시 `truncate orders, order_items, subscriptions, payments, payment_transactions cascade` 실행 (별도 마이그레이션).

### D-5. customerKey 정책

**결정:**
- **회원만** 정기배송 가능 (게스트는 첫 회차 단발 결제만, 정기배송 상품은 카트에 못 담거나 회원 가입 강제)
- 회원 가입 시 `profiles.customer_key uuid` 자동 발급 (`gen_random_uuid()`)
- 한 사용자당 customerKey는 1개 (불변)

### D-6. 빌링키 저장 모델

**결정:** 별도 `billing_methods` 테이블 신설. 사용자가 여러 카드/계좌를 등록 가능하게 설계.

```
billing_methods
- id (uuid, pk)
- user_id (uuid, fk → profiles, on delete cascade)
- billing_key (text, not null, unique)
- method (payment_method enum: 'card' | 'transfer')
- card_company (text, nullable)
- card_number_masked (text, nullable, '****-****-****-1234')
- bank_name (text, nullable)        -- 계좌이체용
- account_number_masked (text, nullable)
- is_default (boolean, default false)
- expires_at (date, nullable)        -- 카드 만료일 (만료 30일 전 알림)
- registered_at (timestamptz, default now())
- deleted_at (timestamptz, nullable) -- 소프트 삭제
```

`subscriptions.billing_method_id` FK 추가 (어떤 카드로 자동결제할지).

### D-7. 자동결제 트리거

**결정:** **pg_cron 1시간 간격 + service_role function**.

```sql
-- 매 시간 0분에 실행
*/60 * * * * select public.run_subscription_billing();
```

함수 동작:
1. `subscriptions where status='active' and next_delivery_at <= now()` 조회
2. 각 subscription에 대해 토스 빌링 API 호출 (Edge Function 또는 Next.js API route 통해)
3. 성공 → `orders` + `payments` INSERT, `next_delivery_at += cycle_days`, `last_delivery_at = now()`
4. 실패 → `subscription_billing_failures` 테이블에 기록 + 재시도 정책 (D-8)

### D-8. 실패 처리 정책

**결정 매트릭스:**

| 실패 유형 | 1차 대응 | 2차 대응 | 3차 대응 |
|-----------|---------|---------|----------|
| 일시 오류 (5xx, network) | 24h 후 재시도 | 48h 후 재시도 | 72h 후 일시중지 + 메일 |
| 카드 한도 초과 | 24h 후 재시도 | 48h 후 재시도 | 72h 후 일시중지 + 메일 |
| 카드 만료 | 즉시 일시중지 + 메일 | — | — |
| 빌링키 invalid | 즉시 일시중지 + 메일 | — | — |
| 기타 4xx | 운영자 알림 + 일시중지 | — | — |

**카드 만료 사전 알림:** `expires_at - 30일` 시점에 메일.

### D-9. 데이터 흐름 변경 (026 RPC 흡수)

**결정:** S173에서 carry-over 된 "026 RPC subscription INSERT 시점 변경" 작업을 Phase 3-A에 흡수.

- create_order 시점 = pending order만 INSERT (subscription 미생성, 사전 중복 검증만 수행)
- 빌링 첫 회차 결제 성공 시점 = subscription INSERT (active)

---

## 3. 설계

### 3.1 시퀀스 — 정기배송 결제 흐름

```
[클라이언트]                [Next.js API]              [토스 API]              [DB]

[1] /checkout 결제하기
  ├─ 정기배송 상품 있음
  └─ 회원 로그인됨
                     POST /api/orders ──> create_order RPC
                                          (pending order)
                                                            INSERT orders (pending)
                                                            INSERT order_items
[2] requestBillingAuth('카드') ─┐
   ↓ 토스 카드 등록창 표시
                                └─> Toss 결제창
   사용자 카드 입력 + 본인인증
                                    successUrl 콜백 (authKey + customerKey)
[3] /billing/success
                     POST /api/billing/authorizations
                     { authKey, customerKey } ──> POST /v1/billing/authorizations/issue
                                                            ←── { billingKey }
                                              INSERT billing_methods
                                              UPDATE subscriptions
                                                set billing_method_id

[4] 정기배송 첫 회차 빌링 호출
                     POST /api/billing/charge
                     { subscriptionId } ──> POST /v1/billing/{billingKey}
                                                            ←── Payment 객체
                                              UPDATE orders set status='paid'
                                              INSERT payments
                                              UPDATE subscriptions
                                                set next_delivery_at += cycle_days

[5] 일반 상품 (혼합 카트) 위젯 결제
                     기존 흐름 그대로 (requestPayment + confirm)

[6] /order-complete
```

### 3.2 시퀀스 — 자동결제 (cron)

```
[pg_cron · 매시간]
  └─ select run_subscription_billing();
       ├─ for each (status='active' AND next_delivery_at <= now()):
       │    pg_net.http_post → POST /api/billing/charge
       │                       { subscriptionId, internalSecret }
       │
       └─ Next.js API route:
            ├─ 인증: internalSecret 검증
            ├─ subscription + billing_method 조회
            ├─ 새 order_number 발급 (cycle 회차)
            ├─ orders INSERT (status='pending')
            ├─ order_items INSERT (subscription cycle 단가)
            ├─ POST /v1/billing/{billingKey} 호출
            │   ├─ 성공: orders.status='paid', payments INSERT,
            │   │       subscription.next_delivery_at += cycle_days
            │   └─ 실패: subscription_billing_failures INSERT,
            │           재시도 스케줄링
            └─ 응답
```

### 3.3 DB Schema 추가/변경

**신규:**

```sql
-- profiles.customer_key (D-5)
alter table public.profiles
  add column if not exists customer_key uuid not null default gen_random_uuid();
create unique index profiles_customer_key_uniq on public.profiles(customer_key);

-- billing_methods (D-6)
create table public.billing_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  billing_key text not null unique,
  method public.payment_method not null check (method in ('card', 'transfer')),
  card_company text,
  card_number_masked text,
  bank_name text,
  account_number_masked text,
  is_default boolean not null default false,
  expires_at date,
  registered_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- subscriptions FK
alter table public.subscriptions
  add column if not exists billing_method_id uuid
  references public.billing_methods(id) on delete set null;

-- subscription_billing_failures (D-8)
create table public.subscription_billing_failures (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  attempt_at timestamptz not null default now(),
  error_code text not null,
  error_message text,
  retry_at timestamptz,
  resolved_at timestamptz
);
```

### 3.4 API 엔드포인트 신설

| 메서드 | 경로 | 역할 |
|--------|------|------|
| POST | `/api/billing/authorizations` | authKey → billingKey 발급 + 저장 |
| POST | `/api/billing/charge` | 빌링키로 결제 호출 (cron + 첫 회차 양쪽) |
| GET  | `/api/billing/methods` | 사용자 등록 카드 목록 |
| DELETE | `/api/billing/methods/[id]` | 카드 삭제 (soft delete) |
| POST | `/api/billing/methods/[id]/default` | 기본 카드 변경 |

### 3.5 클라이언트 컴포넌트 변경

| 컴포넌트 | 변경 |
|----------|------|
| `CheckoutPayment.tsx` | 정기배송 포함 시 `requestBillingAuth` 분기. 일반만 있으면 기존 위젯 결제 그대로 |
| `/billing/success/page.tsx` (신규) | authKey 콜백 처리 + `/api/billing/authorizations` 호출 |
| MyPage 정기배송 카드 관리 | `billing_methods` CRUD UI |

---

## 4. 마이그레이션 순서

### Phase 3-A — 인프라 (DB + 백엔드)

1. **migration 040** — `profiles.customer_key` + `billing_methods` + `subscriptions.billing_method_id` + `subscription_billing_failures`
2. **migration 041** — 기존 회원에 `customer_key` backfill (default `gen_random_uuid()` 가 처리) + 기존 active subscription 정리 (D-4 초기화 정책 따라 truncate)
3. **migration 042** — 026 RPC 수정 (subscription INSERT 제거, 사전 중복 검증만 유지)
4. `lib/services/tossBillingClient.ts` — 토스 빌링 API 호출 모듈
5. `lib/services/billingService.ts` — 빌링키 발급·저장·결제 호출 비즈 로직
6. API 라우트 5개 신설 (3.4)
7. 단위 테스트

### Phase 3-B — 클라이언트 UI

1. `CheckoutPayment.tsx` — 정기배송 분기 (`requestBillingAuth`)
2. `/billing/success/page.tsx` — 콜백 처리 + 첫 회차 빌링 호출 + 위젯 결제(일반 상품용) 트리거
3. MyPage 카드 관리 컴포넌트
4. 통합 테스트 (sandbox key)

### Phase 3-C — 자동 cron

1. **migration 043** — pg_cron `run_subscription_billing` + 매시간 schedule
2. `subscription_billing_failures` 처리 cron (재시도 + 일시중지 정책)
3. Edge Function or Next.js API integration (pg_net 호출)
4. staging 검증

### Phase 3-D — 실패 처리 / UX

1. 카드 만료 30일 전 알림 (Resend 메일 템플릿)
2. 빌링 실패 시 사용자 메일 + 마이페이지 배너
3. 카드 재등록 유도 페이지
4. 운영자 admin 빌링 실패 모니터링

### Phase 3-E — 운영 전환

1. 토스 비즈센터 빌링 심사 신청 (클라이언트 컨펌 후)
2. 라이브 키 교체 (S91 사고이력 절차 따라)
3. 테스트 데이터 truncate (D-4)
4. 첫 정기배송 사용자 모니터링

---

## 5. 리스크 / 미해결

| 리스크 | 평가 | 대응 |
|--------|------|------|
| 토스 빌링 심사 거절 | 낮음 (이미 토스 키오스크 사용 중) | 코드 작업은 진행, 활성화는 심사 통과 시 |
| 빌링키 누출 → 무단 결제 | 중 | RLS + service_role only access + DB encryption at rest |
| Race condition (cron + 사용자 동시 결제) | 낮음 | subscription row lock + idempotency_key |
| 카드 만료 미처리 → 결제 실패 누적 | 중 | 30일 전 알림 + 만료 시 즉시 일시중지 |
| 혼합 카트 부분 실패 (빌링 OK + 위젯 실패) | 중 | 트랜잭션 분리 → 빌링 성공 후 위젯 실패 시 사용자 안내 + 일반 상품 재결제 유도 |
| 게스트 정기배송 차단 시 카트 UX | 중 | 카트에 정기 상품 추가 시 "회원 가입 필요" 안내 모달 |

---

## 6. 결정 추적

| ID | 결정 | 일자 |
|----|------|------|
| D-1 | 코드 통합 진행, 활성화는 클라이언트 컨펌 후 | 2026-05-07 |
| D-2 | 정기배송 = 카드 + 계좌이체 | 2026-05-07 |
| D-3 | 혼합 카트 = 옵션 A (빌링 + 위젯 분리) | 2026-05-07 |
| D-4 | 기존 데이터 truncate | 2026-05-07 |
| D-5 | customerKey = profiles.customer_key (UUID, 회원만) | 2026-05-07 |
| D-6 | billing_methods 별도 테이블 | 2026-05-07 |
| D-7 | pg_cron 매시간 자동결제 | 2026-05-07 |
| D-8 | 실패 처리 매트릭스 (3차 재시도 → 일시중지) | 2026-05-07 |
| D-9 | 026 RPC subscription INSERT 시점 변경을 Phase 3-A에 흡수 | 2026-05-07 |

---

## 7. 참조

- 토스 빌링 개요: https://docs.tosspayments.com/guides/billing/overview
- 자동결제 승인 API: https://docs.tosspayments.com/reference#자동결제-승인
- 구독 결제 구현 가이드 Part 1: https://docs.tosspayments.com/blog/subscription-service-1
- payments-flow.md (기존 결제 플로우 스펙)
- ADR-002 (webhook 인증 — 빌링은 webhook 별도 종류 추가 검토)
