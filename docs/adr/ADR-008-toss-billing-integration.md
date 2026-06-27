# ADR-008 — 토스페이먼츠 빌링(자동결제) 통합

**상태:** Accepted · **Living** (S173 작성 · S339 SoT 승격 — 정책 변경 시 본 ADR §0 + §6 동시 갱신 의무)
**작성일:** 2026-05-07 (최종 갱신 2026-06-28 / S339)
**관련:** payments-flow.md, subscription-full-implementation-plan.md, ADR-002, ADR-005

> 🟢 **이 문서는 Living SoT 다.** 빌링/구독 자동결제의 **현재 유효한 정책 전부**는 아래 **§0 유효 정책 스냅샷** 한 곳에 모은다. §1~§5 본문은 2026-05-07 설계 시점 스냅샷이며 일부는 이후 결정으로 폐기됐다(§0.2 Supersession Log 참조). **새 세션·작업자는 §0 만 읽으면 방향이 잡힌다.** 본문과 §0 이 충돌하면 **§0 이 우선**한다.
>
> ⚠️ **갱신 규칙(필수):** 빌링/구독 결정을 바꾸거나 추가하면 session-complete 메모리뿐 아니라 **반드시 본 ADR §0 스냅샷 + §6 결정 추적을 같은 커밋에서 갱신**한다. 이를 빠뜨리면 SoT 가 다시 화석화되어 매 세션 정책을 잃는다. → [[feedback_billing_decisions_adr_living_sot]]

---

## 0. 유효 정책 스냅샷 (Living · 2026-06-28 / S339 기준)

> 현재 살아있는 정책만. 각 항목 끝 `[출처]` 는 결정 ID(§6). ⚠️ 표시는 §1~§5 본문의 폐기 항목을 가리킨다.

### 0.1 현재 유효 정책

**결제 모델**
- 정기배송 = 토스 **빌링키 자동결제**. **회원 전용**(`profiles.customer_key` UUID·불변). 결제수단 = **카드 + 계좌이체**(간편결제 미지원). `[D-2·D-5]`
- 혼합 카트 = **γ 합산 단일 결제**(1 order ↔ 1 payment). 자동 회차 청구는 **정기 항목만**. `[D-3·S294]`
- 빌링키 저장 = `billing_methods`(토스 **토큰 + 마스킹만** 보관 · 실 카드정보는 토스 보유). **service-role only RLS**. `[D-6·S176]`
- 🟢 **결제수단 "목록 관리 UI" 미채택** — 카드 목록을 노출/관리하지 않는다. 결제수단은 **구독별 빌링키 종속**, 변경·재등록은 **토스 위젯 재등록(일회성)** 으로만. 빌링키=토큰(민감정보 아님)·민감정보 최소 보유·빌링 심사 전제. `[DEC-S336-PAY1]` ⚠️ 이 결정이 §3.4 `methods` 목록/삭제/default·§3.5 "MyPage 카드 관리 CRUD"·Phase 3-D "MyPage 카드관리"를 폐기

**가격 · 배송**
- 단가 = **가입 시점 고정(스냅샷)** `subscriptions.unit_price·quantity`. 배송비 = **회차 시점 현행 정책**(site_settings 동적·무료배송 임계 반영). 배송비 스냅샷 미채택. `[DEC-S337-1]`
- 배송지 = 매 회차 회원 **기본 배송지**(`addresses.is_default`). 미설정 시 해당 회차 청구 보류. `[DEC-S337-3]`
- 정기 **할인 미적용**(현행). 도입 시 스냅샷 단가 계산에 반영.

**스케줄러 · 청구**
- 스케줄러 = **Vercel Cron + 트리거 분리**(pg_cron+pg_net 기각). **매일 1회 KST 10시**(UTC `0 1 * * *`). `[DEC-S338-1·2]` ⚠️ D-7 pg_cron 매시간 폐기
- 멱등/복구 = **get-or-create + order 보존**(이번 주기 pending 회차 재사용 → 같은 order_number → 토스 멱등 복구). 주방어 = `create_recurring_order` 의 `next_delivery_at>now()` DB 가드(subscription FOR UPDATE). `[DEC-S338-4·S337-2]` · [[reference_toss_idempotency_key]]
- 토스 출금(외부·비가역) ↔ DB 반영(내부) 2단계 — 출금 성공 후 process 실패 시 `RPC_FAILED_AFTER_CHARGE` 기록 + CRITICAL + retryable. `[S338 R-2a]`
- cron 한도(Vercel Hobby = 2개): `charge/run`(KST10) + `charge/retry`(KST11). 3번째(카드만료 알림)·빈도 상향은 **Pro 전환 후**. `[DEC-S338-R3]` · [[project_billing_r3_pro_backlog]]

**실패 · 재개 (dunning)**
- 자동결제 실패 → 재시도(일시 오류 24/48/72h) → 소진 또는 영구 오류(만료·정지·빌링키 invalid) → **`paused` 전환**(무한 재청구 차단). `[D-8·S338 R-3a]`
- paused = `cancelled` 아님. **결제수단 재등록 시 재개**(재등록 유도 모델). 영구 실패 시 재등록 유도 **이메일** 발송(24h 중복차단). `[S338 R-3a·R-3b]`
- 🟢 **재개 정책 = `next_delivery_at` 다음 정상 주기로 이월**(`now()+cycle_days`), **즉시 청구 없음**. (기존 `resumeSubscription`·`/api/subscriptions/[id]/resume` 가 이미 이 계산) `[DEC-S339]`
- 🟢 **재등록 동선 = 일회성 토스 위젯 redirect**(카드 목록 비노출). 토스 도메인에서 카드 입력 → 토큰만 저장 → **해당 구독 1건에만 연결**. `detached + paused` 면 **자동 재개**. `[DEC-S339 / R-3d]`
- 🟢 **결제수단 상태(billingStatus) = 3-state** `[DEC-S339-3·4 / R-3d]`:
  - `ok` — billing_method 유효(존재 + `deleted_at IS NULL`) · 정상.
  - `detached` — `billing_method_id IS NULL` **OR** 가리키는 카드 soft-deleted(`deleted_at IS NOT NULL`). billing_methods 는 soft delete 라 카드 삭제 시 FK `set null` 미발동 → soft-deleted 카드를 계속 가리킴 → 회차 청구 `billing_method invalid` 실패. (NULL 케이스 실재: S336 잔여 `refreshing-afternoon`) → **재등록 필수**.
  - `payment_failed` — billing_method 는 유효하나 `paused` + 미해결 `subscription_billing_failures`(`resolved_at IS NULL`) 존재(dunning·카드 만료/정지 등 영구 실패). → **재등록 권장**(그냥 재개 시 다음 청구 또 실패하는 루프 차단). 식별 = security-definer RPC 가 failures 큐 LEFT JOIN.

**출시**
- 운영 활성화 = **토스 라이브 심사 통과 후**(클라이언트 컨펌 선행). 출시 전략 = **자동결제 완주**(수동/반자동 시작안 기각). `[D-1·DEC-S338-3]` · [[project_toss_live_review_status]]
- 라이브 전 **테스트 데이터 truncate**(orders·payments·subscriptions 등). `[D-4]`

**탈퇴 (구독 연동)**
- 활성/정지 구독 보유 회원 탈퇴 = 선해지 강제 폐기 → **2차 동의 모달 후 일괄 취소**. 빌링키 토스 측 명시 해지는 별도 sprint(현행 DB CASCADE 만). `[DEC-S335-W1~W5]`

### 0.2 Supersession Log (폐기된 본문 → 대체)

| 폐기 항목 | 본문 위치 | 대체 정책 | 출처 |
|----------|----------|----------|------|
| pg_cron 매시간 자동결제 트리거 | §2 D-7 · §3.2 · §4 Phase 3-C | Vercel Cron + 트리거 분리 · 매일 KST 10시 | DEC-S338-1·2 |
| MyPage 카드 관리 CRUD UI · `methods` 목록/삭제/default 소비 | §3.4 · §3.5 · §4 Phase 3-D | 결제수단 목록 미채택 · 토스 위젯 재등록 | DEC-S336-PAY1 |
| "카드 재등록 유도 페이지"(추상 표현) | §4 Phase 3-D | 일회성 재등록 redirect 동선(구독 1건 연결+자동재개)으로 구체화 | DEC-S339 (R-3d) |
| 혼합 카트 미정(A 옵션 추상) | §2 D-3 초안 | γ 합산 단일 결제 1차 채택 | S294 (D-3 갱신본) |

> 🔻 **Dead code 인지:** `methods` GET(목록)·`[id]` DELETE·`[id]/default` POST 라우트는 구현됐으나 DEC-S336-PAY1 로 **소비처 0(dead)**. R-3d 재등록은 `authorizations`(발급) + 신규 `reattach-billing` 만 사용. dead 라우트 삭제는 별도 정리 sprint(`[id]` DELETE 는 향후 orphan billing_method 정리에 재사용 여지로 보존 검토).

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

### D-3. 혼합 카트 처리 (옵션 A — A-1 / A-2 분리)

**결정 (2026-05-29 갱신 — S294 γ 1차 채택 · 심사 = 계약단계 confirm 절차 활용):**

PDP / 카탈로그 가정 — 단발/정기 별도 카탈로그 구분 없음 + 모든 상품 정기 가능 + 동일 상품 단발+정기 동시 카트 가능 (Stripe-style mixed cart 가정 UI). 이 가정에서 (α) 정기/일반 카트 분리는 PDP 재설계 + 카탈로그 분리 비용이 커서 폐기.

**1차 채택 = A-2 (γ 합산 통합) — 토스 라이브 심사 = TAM 권유 "계약단계 confirm" 절차 활용.** 거절 시 A-1 (β 두 결제 분리) 으로 fallback.

**갱신 근거 (S294 재평가):**
1. **payments §5.2 1:1 UNIQUE 제약** — `payments.order_id UNIQUE` 강제. (β) 채택 시 1 order ↔ 2 payments = UNIQUE 위반 → 2 orders 분리 필요 (큰 작업). (γ) = 1 order ↔ 1 payment 자연 정합.
2. **billingService.chargeFirstCycle 본문** = `amount: order.total_amount` (정기 + 일반 합산) — backend 가 이미 (γ) 가정 작성. (β) 채택 시 backend 도 amount 분리 로직 재작성 필요.
3. **TAM 권유 절차 정합** — "계약단계 confirm" = 라이브 심사 = PPT 제출 단계. 자료 본문에 TAM 답변 인용 + 정책 확인 요청 명시.
4. **글로벌 표준 정합** — Stripe Subscriptions / Recurly mixed cart 단일 invoice 정합. 사용자 카드 1회 입력.
5. **거절 리스크 대비** — 거절 시 frontend β 재구현 = 3~5h + PPT mixed 슬라이드 재작성. 카드사 14일 재심사는 어차피 (β) 도 동일.

#### A-2 (γ) — 합산 통합 결제 · **1차 출시 채택 (S294)**

1. 사용자가 결제하기 클릭
2. **빌링키 발급 흐름** 진입 (`payment.requestBillingAuth({ method: 'CARD' })`)
3. successUrl 콜백 → `/billing/success` 가 POST `/api/billing/authorizations` 호출 → billingKey 발급 + `billing_methods` INSERT
4. `/billing/success` 가 POST `/api/billing/charge` 호출 → 합산 amount (정기 첫 회 + 일반) `chargeBilling` 한 번
5. atomic 후처리 (042 RPC `process_billing_charge_success`) — subscriptions INSERT + orders.status='paid' + payments INSERT
6. 이후 자동결제 cron 은 정기 항목만 cycle 별 amount 로 `chargeBilling` (Phase 3-C — 출시 후)

**근거:**
- 토스페이먼츠 TAM 1차 답변 (2026-05-07 techchat): "기술적으로는 가능합니다. 다만 정책적으로 그렇게 사용해도 될지 **계약단계에서 한 번 더 체크**해주시면 될 것 같아요"
- 라이브 심사 = TAM 권유 계약단계 confirm 절차. PPT 본문에 TAM 답변 인용 + 정책 확인 요청 명시.
- 글로벌 표준 (Stripe / Recurly mixed cart 단일 invoice) 정합 — 사용자 카드 1회 입력
- 코드 자산 정합 — billingService + 042 RPC + payments 1:1 제약 모두 (γ) 자연 정합

**S294 구현 (이번 commit):**
- `next/src/app/api/billing/customer-key/route.ts` 신설 — GET 회원 customer_key
- `next/src/components/checkout/CheckoutPayment.tsx` γ 분기 — `hasSubscription` 시 `payment.requestBillingAuth({ method: 'CARD' })`
- `next/src/app/(main)/billing/success/page.tsx` 신설 — authKey 콜백 → 빌링키 발급 → 첫 회 charge → 완료 화면
- `next/src/components/checkout/CheckoutPage.tsx` — `orderId` (uuid) + `hasSubscription` prop 전달

#### A-1 (β) — 두 결제 분리 · **거절 시 fallback carry-over**

1. 사용자가 결제하기 클릭
2. **빌링키 발급 흐름** 진입 (`requestBillingAuth`)
3. 빌링키 발급 성공 → 정기 amount 만 `chargeBilling` 호출 (정기 첫 회차)
4. 별도로 **일반 amount 위젯 결제 호출** (단발)
5. 두 결제 모두 성공해야 주문 완료

**구조적 제약:**
- payments §5.2 1 order ↔ 1 payment UNIQUE 위반 — 2 orders 분리 또는 1:N payments 재설계 필요
- billingService 의 합산 amount 호출 코드 → 정기 amount 분리 로직 재작성 필요

**fallback 발동 조건:**
- 토스가 (γ) 거절 + (β) 재구현 + PPT 재제출 요구 시
- 또는 외주/토스 측이 자동결제 amount 합산을 명시적으로 금지할 때

**fallback 작업 범위 (A-2 → A-1):**
- `billingService.chargeFirstCycle` — order_items 분리 → 정기 amount 만 charge
- 2 orders 분리 또는 1:N payments 재설계 (payments §5.2 carry 해제)
- `/checkout` 흐름 — 빌링 charge 완료 후 위젯 결제 후속 진입
- PPT mixed 슬라이드 — "두 결제 분리" 흐름도로 재작성
- ADR §6 결정 추적 D-3 갱신 (A-1 활성화 일자 + 거절 사유 명시)

#### 대안 (기각)

- **(α) 정기/일반 카트 분리 정책** — PDP 재설계 + 카탈로그 자체 분리 필요. 모든 상품 정기 가능 + 단발/정기 UI 구분 없는 카탈로그 가정과 모순. 사실상 비현실 → 폐기
- **(B)** 첫 회차는 위젯 결제 + 다음 회차부터 빌링 → 사용자가 카드를 두 번 입력해야 함 (A-1 과 동일 UX 문제) + 빌링키 등록 시점 불분명
- **(C)** 정기와 일반을 별도 주문으로 강제 분리 → (α) 와 동일 카탈로그 모순

#### 출처

- `memory/research_billing_mixed_cart.md` — 토스 TAM 답변 + 7 발견 + 4 옵션 매트릭스 + 외주 confirm 메시지 본문
- 토스 자동결제 가이드 V2 — "정기 구독형 서비스가 아니라면 정책적으로 자동결제 사용이 제한"
- PortOne 토스페이먼츠 정기결제 — "Not Supported: Simultaneous billing key issuance and payment"

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

> ⚠️ **SUPERSEDED (DEC-S338-1·2).** pg_cron+pg_net 기각 → **Vercel Cron + 트리거 분리**(배치 로직은 표준 라우트, vercel.json crons 1줄). 빈도 = **매일 1회 KST 10시**(UTC `0 1 * * *`). 아래 원안은 역사적 맥락. 현재 정책 = §0.1 "스케줄러·청구".

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

**S177 후속:** Phase 3-A 완료 후 dead code 정리.
`subscription_count` 응답 필드는 항상 0 — 042 cutover 후 의미는 deprecated 이지만 RPC 응답 호환을 위해 type 만 유지 (`orderRepo.CreateOrderRpcResult`, `orderClient.CreateOrderResponse`). 정기배송 등록 안내 UI 는 Phase 3-B `/billing/success` 콜백에서 처리.

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

> **RLS 정책 (S176 결정):**
> `billing_methods` 는 **service-role only** 로 운영. 정책 0개 + `revoke all on table public.billing_methods from public, anon, authenticated`.
> 이유: billing_key 는 평문 노출 시 즉시 결제 가능한 민감 자격증명 → 클라이언트 직접 SELECT/INSERT 차단. 모든 접근은 `/api/billing/*` 라우트에서 service-role 클라이언트로 검증된 경로만 허용.
> 마이그레이션 040 본문 참조 (`supabase/migrations/040_billing_methods_schema.sql`).

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

> ⚠️ **부분 SUPERSEDED (DEC-S336-PAY1).** `GET /methods`(목록)·`DELETE /methods/[id]`·`POST /methods/[id]/default` 는 구현됐으나 **결제수단 목록 UI 미채택**으로 소비처 0(dead). 재등록은 `POST /authorizations`(발급) + 신규 `POST /api/subscriptions/[id]/reattach-billing`(R-3d) 으로 처리. 현재 정책 = §0.1·§0.2.

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
| ~~MyPage 정기배송 카드 관리 (`billing_methods` CRUD UI)~~ | ⚠️ **SUPERSEDED (DEC-S336-PAY1)** — 목록 관리 UI 미채택. 대신 끊긴 구독에서 **일회성 토스 위젯 재등록**(`/billing/reattach` · R-3d) |

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

> ⚠️ **SUPERSEDED (DEC-S338).** pg_net/pg_cron 대신 **Vercel Cron → 표준 라우트** 구현됨. 실제 구현 = `/api/billing/charge/run`(KST10) + `/api/billing/charge/retry`(KST11) + `cronAuth`(Bearer/x-cron-secret). 마이그 105·106·107. 아래 원안은 역사적 맥락.

1. ~~**migration 043** — pg_cron `run_subscription_billing` + 매시간 schedule~~ → Vercel Cron (DEC-S338-1)
2. `subscription_billing_failures` 처리 cron (재시도 + 일시중지 정책) → R-3a `retry` 라우트로 구현
3. ~~Edge Function or Next.js API integration (pg_net 호출)~~ → Vercel Cron Bearer 자동주입
4. staging 검증

### Phase 3-D — 실패 처리 / UX

> 🟢 **구현 현황 (S338~S339):** 2(실패 메일)=R-3b 완료. 3(재등록)=**R-3d 로 구체화** — "유도 페이지"(추상) → **끊긴 구독 배지 + 일회성 토스 위젯 재등록 redirect**(카드목록 비노출·구독 1건 연결·자동재개) `[DEC-S339]`. 1(카드만료 알림)=**Pro 백로그**([[project_billing_r3_pro_backlog]]). 마이페이지 "카드 관리"는 DEC-S336-PAY1 로 폐기.

1. 카드 만료 30일 전 알림 (Resend 메일 템플릿) — ⏸ **Pro 백로그**(3번째 cron + expires_at 보강 필요)
2. 빌링 실패 시 사용자 메일 ~~+ 마이페이지 배너~~ — ✅ 메일 R-3b 완료
3. ~~카드 재등록 유도 페이지~~ → 🟢 **R-3d 끊긴 구독 재등록 동선**(`/billing/reattach`)
4. 운영자 admin 빌링 실패 모니터링 — 후속
5. **계좌 빌링 결제 흐름** — Phase 3-A 는 카드만 처리 (`process_billing_charge_success` RPC method='card' 가드, billingService 카드 가정). 계좌 빌링 결제는 토스 transfer billing API 호출 + RPC 가드 완화 + billing_methods.account_number_masked 활용 흐름으로 별도 설계.

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
| 혼합 카트 부분 실패 (빌링 OK + 위젯 실패) | 중 | 트랜잭션 분리 → 빌링 성공 후 위젯 실패 시 사용자 안내 + 일반 상품 재결제 유도 (A-1 β 시나리오 한정. A-2 γ 전환 시 단일 트랜잭션이라 본 risk 제거) |
| 게스트 정기배송 차단 시 카트 UX | 중 | 카트에 정기 상품 추가 시 "회원 가입 필요" 안내 모달 |

---

## 6. 결정 추적

| ID | 결정 | 일자 |
|----|------|------|
| D-1 | 코드 통합 진행, 활성화는 클라이언트 컨펌 후 | 2026-05-07 |
| D-2 | 정기배송 = 카드 + 계좌이체 | 2026-05-07 |
| D-3 | 혼합 카트 = A-2 (γ 합산 통합) **1차 채택** (S294 — 심사 = 계약단계 confirm 절차 활용 · payments §5.2 1:1 자연 정합 · billingService 기 정합). A-1 (β 두 결제 분리) 거절 시 fallback carry-over | 2026-05-07 작성 (S178) · **2026-05-29 갱신 (S294)** |
| D-4 | 기존 데이터 truncate | 2026-05-07 |
| D-5 | customerKey = profiles.customer_key (UUID, 회원만) | 2026-05-07 |
| D-6 | billing_methods 별도 테이블 | 2026-05-07 |
| D-7 | ~~pg_cron 매시간 자동결제~~ **SUPERSEDED → DEC-S338-1·2** | 2026-05-07 |
| D-8 | 실패 처리 매트릭스 (3차 재시도 → 일시중지) | 2026-05-07 |
| D-9 | 026 RPC subscription INSERT 시점 변경을 Phase 3-A에 흡수 | 2026-05-07 |

### 후속 결정 (S294~S339 · §0 스냅샷 SoT)

| ID | 결정 | 상태 | 일자 |
|----|------|------|------|
| D-3(갱신) | 혼합 카트 = γ 합산 단일 결제 1차 채택 (A-1 β fallback) | Active | 2026-05-29 (S294) |
| DEC-S335-W1~5 | 활성 구독 회원 탈퇴 = 선해지 강제 폐기 → 2차 모달 일괄취소 (빌링키 토스 해지는 별도 sprint) | Active | S335~336 |
| **DEC-S336-PAY1** | **결제수단 목록 관리 UI 미채택** — 구독별 빌링키 종속 · 변경/재등록 = 토스 위젯 재등록 · 토큰+마스킹만 보관 | **Active (supersedes §3.4 methods·§3.5 카드관리)** | S336 |
| DEC-S337-1 | 단가 = 가입시점 고정(스냅샷) · 배송비 = 회차시점 현행 정책 | Active | S337 |
| DEC-S337-2 | 멱등 = `next_delivery_at>now()` DB 가드(주) + 토스 Idempotency-Key(보조) | Active | S337 |
| DEC-S337-3 | 회차 주문 출처 = profiles contact · 기본배송지 · terms_version 상수 | Active | S337 |
| DEC-S338-1 | 스케줄러 = Vercel Cron + 트리거 분리 (pg_cron+pg_net 기각) | **Active (supersedes D-7)** | S338 |
| DEC-S338-2 | 청구 빈도 = 매일 1회 KST 10시 (UTC `0 1 * * *`) | **Active (supersedes D-7)** | S338 |
| DEC-S338-3 | 출시 전략 = 자동결제 완주 (수동/반자동 기각) | Active | S338 |
| DEC-S338-4 | 멱등/복구 = get-or-create + order 보존 (advisory lock 기각) | Active | S338 |
| DEC-S338-R3 | Vercel Hobby cron 2개 한도 (run+retry) · 3번째·빈도상향 = Pro 백로그 | Active | S338 |
| **DEC-S339-1** | **재개 정책 = next_delivery 다음 주기 이월(now+cycle) · 즉시청구 없음** | **Active** | S339 |
| **DEC-S339-2** | **재등록 = 일회성 토스 위젯 redirect 동선(카드목록 비노출·구독 1건 연결) · detached+paused 자동 재개** | **Active** | S339 |
| **DEC-S339-3** | **끊김(detached) 정의 = billing_method_id NULL OR 가리키는 카드 soft-deleted** | **Active** | S339 |
| **DEC-S339-4** | **billingStatus 3-state(ok/detached/payment_failed)** — dunning paused(유효 카드+미해결 failure)를 `payment_failed` 로 분리 식별(failures 큐 조인). 영구실패 구독이 '그냥 재개'로 빠지는 루프 차단 | **Active** | S339 |

---

## 7. 참조

- 토스 빌링 개요: https://docs.tosspayments.com/guides/billing/overview
- 자동결제 승인 API: https://docs.tosspayments.com/reference#자동결제-승인
- 구독 결제 구현 가이드 Part 1: https://docs.tosspayments.com/blog/subscription-service-1
- payments-flow.md (기존 결제 플로우 스펙)
- ADR-002 (webhook 인증 — 빌링은 webhook 별도 종류 추가 검토)
