# Good Things Roasters — 결제 플로우 설계 (Phase 2-B / B-1)

> **버전**: v1.0.7 (2026-04-16)
> **상태**: Proposed (Session 3 B-1, 사용자 승인 대기)
> **관련 문서**: [backend-architecture-plan.md §6](./backend-architecture-plan.md) · [ADR-002 웹훅 인증](./adr/ADR-002-payment-webhook-verification.md) · [milestone.md](./milestone.md)

---

## §0. 편차 공지 — 본 문서가 `backend-architecture-plan.md` 를 정정하는 지점

`backend-architecture-plan.md §6.2` 는 "HMAC-SHA256 웹훅" 을 명시했으나, Toss 공식 문서 재확인 결과 다음 두 가지 사실이 확인됨:

1. **카드 결제 (`PAYMENT_STATUS_CHANGED`)** — 웹훅 페이로드에 **`secret` 필드 없음**. 검증은 `GET /v1/payments/{paymentKey}` 로 서버에서 권위 있는 상태를 재조회하는 방식.
2. **가상계좌 (`DEPOSIT_CALLBACK`, transfer)** — 웹훅 top-level 에 **`secret` 필드 있음**. 발급 시점에 받은 값을 DB 에 저장한 뒤 timing-safe 비교.

HMAC 공유 시크릿은 Toss 공식 지원이 아니며, 본 프로젝트는 **수단별 하이브리드 인증** 을 채택한다 (근거 = [ADR-002](./adr/ADR-002-payment-webhook-verification.md)).

---

## §1. 개요 · 범위

### 1.1 목적

주문 생성(P2-A) 이후 **결제 승인 · 웹훅 수신 · 상태 동기화** 까지의 단일 출처 문서. 구현자가 본 문서만 보고 엔드포인트·스키마·테스트 케이스를 복원할 수 있어야 한다.

### 1.2 범위

| 포함 | 제외 |
|---|---|
| `POST /api/payments/confirm` 승인 API | 정기배송 자동결제 (Phase 3) |
| `POST /api/payments/webhook` Toss 웹훅 | **고객 셀프 환불 UI (전액·부분 모두 어드민 경유)** |
| `orders.status` 상태 머신 · 전이 트리거 | 토스 빌링키 발급 (구독 자동결제) |
| `payments` 테이블 · `payment_transactions` 이벤트 로그 | 매출 리포팅·어드민 대시보드 |
| 전액·부분 환불 **데이터 파이프라인** (어드민 Toss Dashboard 경유) | Phase 3 자체 어드민 환불 툴 |
| 실패·취소 시나리오 | Sentry 알림 연동 (Phase H) |

### 1.3 선행 조건

- P2-A 완료 (커밋 `6ec1d993`) — `POST /api/orders` · `create_order` RPC · `orders`·`order_items` 스키마 동작
- 환경변수 주입 완료: `NEXT_PUBLIC_TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`
- `@tosspayments/tosspayments-sdk@^2.5.0` 은 B-2 착수 시 설치

### 1.4 설계 원칙

1. **Toss 공식 패턴 준수** — 수단별 권장 검증 방식(§3).
2. **단일 진실 소스** — 카드는 confirm 응답 + GET 재조회, 가상계좌는 `DEPOSIT_CALLBACK` + `payments` 테이블. DB `orders.status` 는 항상 파생.
3. **원자성** — 상태 전이 + 이벤트 로깅을 한 트랜잭션(`confirm_payment`·`apply_webhook_event` RPC)에 묶음.
4. **멱등성 내장** — `payment_transactions.idempotency_key UNIQUE` 로 Toss 7회 재시도 모두 흡수.
5. **Defense in depth** — 상태 전이 검증 = 서비스 레이어 + DB `BEFORE UPDATE` 트리거 이중.

---

## §2. 상태 머신 · 시퀀스

### 2.1 `orders.status` 상태 머신

```
         create_order RPC (P2-A)
                    │
                    ▼
              ┌───────────┐
              │  pending  │─────────── TTL(30분) sweep ──────► cancelled ■
              └─────┬─────┘
                    │ payment_approved
                    │ (confirm 성공)
                    ▼
                ┌────────┐
                │  paid  │──────────► refund_requested ──► refund_processing ──► refunded ■
                └───┬────┘
                    │ 어드민 배송 시작
                    ▼
               ┌──────────┐
               │ shipping │──► delivered ■
               └──────────┘

  ■ = terminal. 역방향 전이는 DB 트리거로 차단.
  부분환불: paid → paid (refunded_amount 누적). approved_amount 도달 시 refunded.
```

### 2.2 전이 매트릭스

| From ↓ / 이벤트 → | `payment_approved` | `payment_failed` | `webhook DONE` | `refund_requested` | `refund_completed` (부분) | `refund_completed` (전액) | TTL sweep |
|---|---|---|---|---|---|---|---|
| **pending** | → paid | pending 유지 | → paid (선도착) | ❌ | ❌ | ❌ | → cancelled |
| **paid** | ❌ (멱등 skip) | ❌ | 200 skip | → refund_requested | → paid (balance>0) | → refunded | — |
| **shipping** | ❌ | ❌ | 200 skip | → refund_requested | 200 skip | → refunded (admin) | — |
| **delivered** | ❌ | ❌ | 200 skip | → refund_requested | 200 skip | → refunded | — |
| **cancelled** ■ | ❌ | ❌ | 200 skip | ❌ | ❌ | ❌ | — |
| **refund_requested** | ❌ | ❌ | ❌ | ❌ | → refund_processing | → refund_processing | — |
| **refund_processing** | ❌ | ❌ | ❌ | ❌ | → refund_processing | → refunded | — |
| **refunded** ■ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | — |

❌ = 불법 전이. DB `orders_status_transition_check()` BEFORE UPDATE 트리거로 raise.

### 2.3 시퀀스 다이어그램 — 카드 결제 정상 플로우

```
Client        /api/orders         /api/payments/confirm    TossPayments API      /api/payments/webhook
  │                │                       │                      │                       │
  │ 주문서 작성     │                       │                      │                       │
  │ ───────────►   │                       │                      │                       │
  │                │ create_order RPC      │                      │                       │
  │                │ (status=pending)      │                      │                       │
  │ ◄───────────   │                       │                      │                       │
  │ orderId, amount                        │                      │                       │
  │                                        │                      │                       │
  │ widgets.requestPayment({orderId, amount, successUrl, failUrl})│                       │
  │ ──────────────────────────────────────────────────────────►   결제창                   │
  │ ◄──────────────────────────────────────────────────── 성공 리다이렉트 (paymentKey, orderId, amount)
  │                                        │                      │                       │
  │ POST /api/payments/confirm ───────────►│                      │                       │
  │                                        │ 1) orders 조회·금액 검증                      │
  │                                        │ 2) confirm_payment RPC (SELECT FOR UPDATE)    │
  │                                        │ 3) POST /v1/payments/confirm ───►│            │
  │                                        │                      │  승인   │            │
  │                                        │ ◄─────────── 200 {status:'DONE'} │            │
  │                                        │ 4) orders.status='paid' + tx INSERT           │
  │ ◄───────────────────────────── 200 {orderNumber, status:'paid'}                        │
  │                                        │                      │                       │
  │ 주문완료 페이지                          │                      │ Toss 비동기 웹훅       │
  │                                        │                      │ ─────────────────────►│
  │                                        │                      │                       │ 5) GET /v1/payments/{paymentKey}
  │                                        │                      │ ◄─────────────────── 재조회
  │                                        │                      │                       │ 6) idempotency_key 중복 → 23505 skip
  │                                        │                      │ ◄─────────────────── 200 {status:'success'}
```

### 2.4 시퀀스 — 가상계좌 입금 확정

```
Client   /api/orders   /api/payments/confirm   TossPayments         /api/payments/webhook        Customer
  │          │               │                       │                        │                     │
  │ 주문      │               │                       │                        │                     │
  │ ──────►  │               │                       │                        │                     │
  │          │ create_order  │                       │                        │                     │
  │ ◄──────  │               │                       │                        │                     │
  │ widgets.requestPayment (payMethod='transfer')                              │                     │
  │ ───────────────────────────────────────────────► 가상계좌 발급              │                     │
  │ ◄──────────────────────────────── successUrl 리다이렉트 (paymentKey, ...)                        │
  │ POST /api/payments/confirm ─────►│                                         │                     │
  │                                  │ confirm API 호출 (WAITING_FOR_DEPOSIT)  │                     │
  │                                  │ + **응답의 secret 을 payments.webhook_secret 에 저장**          │
  │ ◄──────────── 200 {status:'pending', accountInfo}                          │                     │
  │ 가상계좌 안내 페이지                 │                                       │                     │
  │                                                                            │                     │
  │                                                                            │ 고객이 입금 ────────►│
  │                                                                            │ ◄─ Toss DEPOSIT_CALLBACK (top-level secret)
  │                                                                            │ 1) eventType 분기
  │                                                                            │ 2) payments.webhook_secret timing-safe 비교
  │                                                                            │ 3) apply_webhook_event RPC
  │                                                                            │    → orders.status='paid'
  │                                                                            │ ◄── 200 {status:'success'}
```

### 2.5 타이밍 역전 케이스

| 상황 | 처리 |
|---|---|
| 카드: 웹훅(DONE) 이 confirm API 응답보다 먼저 도착 | `payments` 행 없음 → **503 + Retry-After: 30** 반환. Toss 가 다음 재시도 시 confirm 완료 후 정상 처리 |
| 가상계좌: 웹훅 secret 은 왔는데 DB 에 아직 secret 이 저장 전 | 위와 동일 (confirm 에서 secret INSERT 필수) |
| 카드: confirm 응답은 성공, 서버 크래시로 DB 미반영 | Toss 재시도 웹훅 수신 시 `confirm_payment` RPC 멱등 재실행으로 복구 |

---

## §3. 엔드포인트 스펙

### 3.1 `POST /api/payments/confirm`

| 속성 | 값 |
|---|---|
| 인증 | Supabase SSR(회원) 또는 orderId 소유 확인(게스트) |
| CSRF | `enforceSameOrigin` 적용 |
| Rate limit | IP 기준 `payment_confirm` = 10 req / 60s (정상 재시도 고려) |
| Body | `{ paymentKey: string, orderId: string (= orders.order_number), amount: integer }` |
| 처리 순서 | ① zod 검증 ② orders 조회·본인 소유·상태 pending ③ amount 교차 검증 ④ Toss `/v1/payments/confirm` 호출 ⑤ `confirm_payment` RPC 원자 커밋 |
| 성공 응답 | `200 { data: { orderNumber, status: 'paid', totalAmount } }` |
| 실패 응답 | `400 validation_failed` · `401 unauthorized` · `403 forbidden` · `404 not_found` · `409 state_conflict` · `409 amount_mismatch` · `402 payment_failed` · `502 toss_unavailable` · `429 rate_limited` |

#### 3.1.1 Toss 호출 상세

```http
POST https://api.tosspayments.com/v1/payments/confirm
Authorization: Basic {base64("{TOSS_SECRET_KEY}:")}
Content-Type: application/json

{"paymentKey":"...","orderId":"GT-20260416-000123","amount":18000}
```

- 타임아웃 10초. 네트워크·5xx → 1회 재시도 후 502. `orders.status='pending'` 유지 (웹훅·사용자 재시도로 수렴).
- Idempotency-Key: **Toss 공식 문서에 명시되지 않음** → 본 설계는 §3.1.3 의 3중 방어로 대체. Toss 지원 확인 시 헤더 추가는 옵션 (블로커 #1 해결됨 — v1.0.6).

#### 3.1.2 금액 교차 검증

```
if (orders.total_amount !== body.amount) {
  // payment_transactions INSERT (event_type='payment_failed', raw_payload={reason:'amount_mismatch', expected, actual})
  // orders.status 는 pending 유지 (Toss 호출 전이므로 돈 안 움직임)
  return 409 { error: 'amount_mismatch' }
}
```

#### 3.1.3 중복 confirm 방어 — 3중 방어 (v1.0.6)

Toss 가 `Idempotency-Key` 헤더를 **공식 지원하지 않음** 을 전제로, confirm 이중 호출(더블클릭·뒤로가기 후 재진입·네트워크 재시도) 을 3개 계층에서 독립적으로 흡수한다.

**레이어 1 — 앱 레이어 pre-check (`/api/payments/confirm` 핸들러)**

```ts
// paymentService.confirm(userId, body)
const order = await ordersRepo.findByOrderNumberForConfirm(body.orderId)
if (!order) return { status: 404, error: 'not_found' }
if (!isOwner(order, userId)) return { status: 403, error: 'forbidden' }

// ★ 핵심: 이미 paid 면 Toss 호출 자체를 생략
if (order.status === 'paid') {
  const existing = await paymentsRepo.findByOrderId(order.id)
  return { status: 200, data: { orderNumber: order.order_number, status: 'paid', totalAmount: order.total_amount } }
}
if (order.status !== 'pending') return { status: 409, error: 'state_conflict' }
if (order.total_amount !== body.amount) return { status: 409, error: 'amount_mismatch' }

const tossResponse = await tossClient.confirmPayment({ paymentKey: body.paymentKey, orderId: body.orderId, amount: body.amount })
// tossResponse 에 ALREADY_PROCESSED_PAYMENT 같은 코드가 오면 → §3.1.3 레이어 3 분기로 이어짐
```

레이어 1 이 race 로 실패해도(두 요청이 모두 `status='pending'` 을 읽는 경우) 레이어 2·3 이 커버.

**레이어 2 — `confirm_payment` RPC FOR UPDATE + 멱등 RETURN (§4.3)**

§4.3 RPC 의 `select ... for update` + `if v_current = 'paid' then return query ...` 로직이 두 동시 RPC 호출을 직렬화한다. 뒤에 들어온 호출은 FOR UPDATE 잠금 해제 후 `paid` 를 확인하고 조용히 현재 상태 반환 (예외 없음).

**레이어 3 — `payment_transactions.idempotency_key UNIQUE` (`confirm:{paymentKey}`)**

RPC 성공 경로에서 `payment_transactions` 에 `idempotency_key = 'confirm:' || p_payment_key` 를 INSERT (§4.3 L448). 만약 레이어 1·2 우회로 동일 paymentKey 에 대해 두 번째 INSERT 가 발생하면 23505 UNIQUE 위반 → 앱 레이어가 catch 해서 200 멱등 반환.

**레이어별 방어 커버리지**

| 시나리오 | 레이어 1 | 레이어 2 | 레이어 3 |
|---|:---:|:---:|:---:|
| 순차 중복 클릭 (1초 간격) | ✅ Toss 호출 생략 | — | — |
| 동시 더블클릭 (ms 차이, 둘 다 pending 읽음) | ❌ 둘 다 통과 | ✅ 직렬화 + 멱등 RETURN | — |
| Toss 재시도 후 서버 재시작 (DB 롤백 상태) | ❌ 상태 pending | ✅ 정상 경로 | — |
| Toss 가 `ALREADY_PROCESSED_PAYMENT` 반환 | — | — | ✅ 이미 레이어 1 의 `paid` 분기로 흡수 · 미흡수 시 `tossClient.confirmPayment` 에서 에러코드 매핑 후 `payments` 조회로 멱등 응답 |

### 3.2 `POST /api/payments/webhook`

| 속성 | 값 |
|---|---|
| 인증 | **수단별 분기** (§3.2.2) |
| CSRF | **예외 경로** — `enforceSameOrigin` 화이트리스트 |
| Rate limit | 미적용 (Toss 재시도에 방해) |
| Body | raw text → `JSON.parse` |
| 응답 | 항상 200 (정상·중복·unknown eventType) · 401(secret 불일치) · 400(파싱 실패) · 503(타이밍 역전) · 5xx(DB 오류) |

#### 3.2.1 페이로드 판별

```ts
const raw = await req.text()
const payload = JSON.parse(raw)   // 실패 → 400

switch (payload.eventType) {
  case 'PAYMENT_STATUS_CHANGED':  // 카드 등 일반
    return handleCardWebhook(payload)
  case 'DEPOSIT_CALLBACK':        // 가상계좌 전용
    return handleVirtualAccountWebhook(payload)
  default:
    // webhook_received 로 감사 로그만 남기고 200
    await paymentRepo.insertAuditEvent(payload)
    return 200
}
```

#### 3.2.2 카드 — GET 재조회

```ts
// handleCardWebhook(payload)
const { paymentKey, orderId, status } = payload.data

// 1) Toss 에서 권위 있는 상태 재조회
const authoritative = await tossClient.getPayment(paymentKey)
//    → { paymentKey, orderId, status, totalAmount, approvedAt, balanceAmount,
//         lastTransactionKey, cancels: [{ transactionKey, cancelAmount, ... }], ... }

// 2) DB orders 매칭
const order = await ordersRepo.findByOrderNumber(orderId)
if (!order || order.total_amount !== authoritative.totalAmount) {
  return 401 // 위조 의심
}

// 3) 멱등성 키 생성 — §3.2.5 하이브리드 규칙 적용
//    PARTIAL_CANCELED 는 동일 paymentKey 에서 다회 발생 가능 → 마지막 cancel transactionKey 로 구분
const idempKey = authoritative.status === 'PARTIAL_CANCELED'
  ? `webhook:${paymentKey}:partial:${authoritative.cancels?.at(-1)?.transactionKey ?? authoritative.lastTransactionKey}`
  : `webhook:${paymentKey}:${authoritative.lastTransactionKey}`

// 4) apply_webhook_event RPC (트랜잭션 내 상태 전이 + payment_transactions INSERT)
try {
  await paymentRepo.applyWebhookEvent({ orderId: order.id, eventType: mapStatus(authoritative.status), amount: authoritative.totalAmount, rawPayload: payload, idempotencyKey: idempKey })
} catch (e) {
  if (e.code === '23505') return 200 // 중복 webhook → skip
  throw e
}
return 200
```

#### 3.2.3 가상계좌 — per-payment secret

```ts
// handleVirtualAccountWebhook(payload)
const providedSecret = payload.secret
const { orderId, virtualAccountInfo, paymentStatus } = payload.data

const row = await paymentsRepo.findByOrderNumber(orderId)
if (!row || !row.webhook_secret) {
  return 503 // 타이밍 역전 (confirm 전에 웹훅 도착) → Toss 재시도
}

// timing-safe 비교
const provided = Buffer.from(providedSecret, 'utf8')
const expected = Buffer.from(row.webhook_secret, 'utf8')
if (provided.length !== expected.length) return 401
if (!crypto.timingSafeEqual(provided, expected)) return 401

// 멱등성 키 생성 — §3.2.5 하이브리드 규칙 적용
//    DEPOSIT_CALLBACK 에는 lastTransactionKey / paymentKey(top-level) 부재
//    → orderId + createdAt + paymentStatus 조합 사용 (동일 상태 중복 재시도 방어)
const idempKey = `webhook:deposit:${orderId}:${paymentStatus}:${payload.createdAt}`

try {
  await paymentRepo.applyWebhookEvent({ orderId: row.order_id, eventType: mapDepositStatus(paymentStatus), amount: row.approved_amount, rawPayload: payload, idempotencyKey: idempKey })
} catch (e) {
  if (e.code === '23505') return 200
  throw e
}
return 200
// eventType 매핑: WAITING_FOR_DEPOSIT → webhook_received(log), DONE → payment_approved, CANCELED → payment_cancelled
```

#### 3.2.4 status 매핑 테이블

| Toss `status` | event_type | orders.status 전이 |
|---|---|---|
| `READY` | webhook_received (log only) | 유지 |
| `IN_PROGRESS` | webhook_received | 유지 |
| `DONE` | payment_approved | pending → paid (이미 paid 면 skip) |
| `WAITING_FOR_DEPOSIT` | webhook_received | 유지 |
| `EXPIRED` | payment_cancelled | pending → cancelled |
| `ABORTED` | payment_cancelled | pending → cancelled |
| `CANCELED` | refund_completed (full) | paid → refunded |
| `PARTIAL_CANCELED` | refund_completed (partial) | paid 유지, `payments.refunded_amount += amount` |

#### 3.2.5 `idempotency_key` 합성 규칙 — 하이브리드 (v1.0.5)

Toss 는 웹훅 이벤트에 고유 `eventId` 를 제공하지 않고, 페이로드 구조가 **수단별로 다르다** (context7 `/llmstxt/tosspayments_llms_txt` 재확인, 2026-04-16). 이벤트별로 사용 가능한 최적 식별자를 채택해 `payment_transactions.idempotency_key UNIQUE` 제약을 이용한 멱등성을 보장한다.

| 이벤트 | 사용 가능 식별자 | 합성 키 | 비고 |
|---|---|---|---|
| `PAYMENT_STATUS_CHANGED` (일반: DONE/EXPIRED/ABORTED/CANCELED) | `data.paymentKey` + `data.lastTransactionKey` | `webhook:{paymentKey}:{lastTransactionKey}` | 승인 시점별 고유. 동일 키 재수신 → 23505 skip. |
| `PAYMENT_STATUS_CHANGED` (PARTIAL_CANCELED) | `data.paymentKey` + `data.cancels[-1].transactionKey` | `webhook:{paymentKey}:partial:{cancels[-1].transactionKey}` | **다회 부분취소 대응**. `lastTransactionKey` 만 쓰면 여러 부분취소가 동일 키로 collapse → 감사 로그 유실. 마지막 cancel `transactionKey` 로 구분. |
| `DEPOSIT_CALLBACK` (가상계좌) | `data.orderId` + `createdAt` + `data.paymentStatus` | `webhook:deposit:{orderId}:{paymentStatus}:{createdAt}` | DEPOSIT_CALLBACK 에는 `lastTransactionKey` · top-level `paymentKey` 부재. orderId + 이벤트 타임스탬프 + 상태 조합. |
| confirm API 내부 (앱 레이어) | `payload.paymentKey` | `confirm:{paymentKey}` | §3.1 confirm RPC 경로 (1 order ↔ 1 payment UNIQUE 가 이미 차단). |
| unknown eventType | `createdAt` + `eventType` | `unknown:{eventType}:{createdAt}` | 감사 로그 전용. 향후 Toss 신규 이벤트 대응 시 업데이트. |

**폴백 규칙**: 특정 이벤트에서 기대 식별자가 누락된 경우 (예: Toss 스펙 변경), `createdAt` + `payload` 해시(SHA-256 앞 16자) 를 합성해 `webhook:fallback:{sha16}` 로 저장하고 Sentry `warning` 로그 발생.

**PARTIAL_CANCELED 엣지 케이스 검증 시나리오**:
1. 10,000원 결제 → `paymentKey=P1`, `lastTransactionKey=T1`
2. 3,000원 부분취소 → `cancels=[{ transactionKey: C1 }]`, `lastTransactionKey=C1`
3. 2,000원 부분취소 → `cancels=[{ transactionKey: C1 }, { transactionKey: C2 }]`, `lastTransactionKey=C2`

종전 규칙 `webhook:P1:PARTIAL_CANCELED:approvedAt` → 2 · 3 키가 동일 (`approvedAt` 은 원 승인 시각으로 고정) → 2번째 취소 유실.

신규 규칙 `webhook:P1:partial:C1` / `webhook:P1:partial:C2` → 각자 고유. ✅

---

## §4. 데이터 스키마 — `012_payments_hardening.sql`

### 4.1 신규 `payments` 테이블 (1 order ↔ 1 payment)

```sql
create type public.payment_status as enum (
  'pending',           -- 결제 승인 전 (가상계좌 입금 대기 포함)
  'approved',          -- 승인 완료
  'partial_refunded',  -- 부분 환불 상태
  'refunded',          -- 전액 환불
  'failed',            -- 승인 실패
  'cancelled'          -- 결제 중단 (EXPIRED/ABORTED)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  payment_key text unique,                    -- Toss paymentKey (confirm 성공 후 채움)
  method public.payment_method not null,      -- orders.payment_method 와 동일 (가상계좌는 secret 필수)
  webhook_secret text,                        -- 가상계좌 DEPOSIT_CALLBACK 검증용 (card 는 null)
  approved_amount integer not null check (approved_amount > 0),
  refunded_amount integer not null default 0 check (refunded_amount >= 0),
  balance_amount integer generated always as (approved_amount - refunded_amount) stored,
  status public.payment_status not null default 'pending',
  approved_at timestamptz,
  raw_response jsonb,                         -- Toss confirm 응답 원본
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_refunded_within_approved check (refunded_amount <= approved_amount),
  constraint payments_virtual_secret_required check (
    method <> 'transfer' or webhook_secret is not null
  )
);

create index payments_order_id_idx on public.payments(order_id);
create index payments_payment_key_idx on public.payments(payment_key) where payment_key is not null;
create index payments_status_idx on public.payments(status);

alter table public.payments enable row level security;
alter table public.payments force row level security;
-- RLS: 정책 미선언 = 전면 차단. service_role 전용.
```

### 4.2 상태 전이 트리거

```sql
create or replace function public.orders_status_transition_check()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
declare allowed boolean;
begin
  if OLD.status = NEW.status then return NEW; end if;  -- no-op
  allowed := case
    when OLD.status = 'pending'           and NEW.status in ('paid', 'cancelled')                          then true
    when OLD.status = 'paid'              and NEW.status in ('shipping', 'refund_requested', 'refunded')   then true
    when OLD.status = 'shipping'          and NEW.status in ('delivered', 'refund_requested')              then true
    when OLD.status = 'delivered'         and NEW.status in ('refund_requested')                           then true
    when OLD.status = 'refund_requested'  and NEW.status in ('refund_processing')                          then true
    when OLD.status = 'refund_processing' and NEW.status in ('refunded')                                   then true
    else false
  end;
  if not allowed then
    raise exception 'illegal order_status transition: % -> %', OLD.status, NEW.status
      using errcode = 'check_violation';
  end if;
  return NEW;
end; $$;

create trigger orders_status_transition
  before update of status on public.orders
  for each row
  when (OLD.status is distinct from NEW.status)
  execute function public.orders_status_transition_check();
```

### 4.3 `confirm_payment` RPC — 원자 커밋

```sql
create or replace function public.confirm_payment(
  p_order_id          uuid,
  p_payment_key       text,
  p_method            public.payment_method,
  p_webhook_secret    text,       -- 가상계좌만 not null
  p_approved_amount   integer,
  p_approved_at       timestamptz,
  p_raw               jsonb
) returns table (order_number text, status public.order_status)
language plpgsql security definer set search_path = public, pg_catalog as $$
declare v_current public.order_status;
begin
  select o.status into v_current from public.orders o where o.id = p_order_id for update;
  if not found then raise exception 'order not found' using errcode = 'no_data_found'; end if;

  -- 멱등: 이미 paid 이면 조용히 현재 상태 반환
  if v_current = 'paid' then
    return query select o.order_number, o.status from public.orders o where o.id = p_order_id;
    return;
  end if;
  if v_current <> 'pending' then
    raise exception 'illegal state for confirm: %', v_current using errcode = 'check_violation';
  end if;

  -- payments 1:1 upsert
  insert into public.payments (order_id, payment_key, method, webhook_secret, approved_amount, approved_at, raw_response, status)
    values (p_order_id, p_payment_key, p_method, p_webhook_secret, p_approved_amount, p_approved_at, p_raw, 'approved')
    on conflict (order_id) do update
      set payment_key = excluded.payment_key,
          webhook_secret = excluded.webhook_secret,
          approved_amount = excluded.approved_amount,
          approved_at = excluded.approved_at,
          raw_response = excluded.raw_response,
          status = 'approved',
          updated_at = now();

  update public.orders set status = 'paid', updated_at = now() where id = p_order_id;

  insert into public.payment_transactions (order_id, provider_payment_key, event_type, amount, raw_payload, idempotency_key)
    values (p_order_id, p_payment_key, 'payment_approved', p_approved_amount, p_raw, 'confirm:' || p_payment_key);

  return query select o.order_number, o.status from public.orders o where o.id = p_order_id;
end; $$;

revoke execute on function public.confirm_payment(uuid, text, public.payment_method, text, integer, timestamptz, jsonb) from public, anon, authenticated;
grant  execute on function public.confirm_payment(uuid, text, public.payment_method, text, integer, timestamptz, jsonb) to service_role;
```

### 4.4 `apply_webhook_event` RPC

```sql
create or replace function public.apply_webhook_event(
  p_order_id          uuid,
  p_event_type        public.payment_event_type,
  p_amount            integer,     -- 환불은 음수
  p_raw               jsonb,
  p_idempotency_key   text
) returns void
language plpgsql security definer set search_path = public, pg_catalog as $$
declare v_current public.order_status;
begin
  -- idempotency_key UNIQUE 로 중복 호출은 23505 → 호출자 catch 후 skip
  insert into public.payment_transactions (order_id, event_type, amount, raw_payload, idempotency_key)
    values (p_order_id, p_event_type, p_amount, p_raw, p_idempotency_key);

  select o.status into v_current from public.orders o where o.id = p_order_id for update;

  -- 이벤트 → 상태 전이 (트리거가 최종 방어)
  case p_event_type
    when 'payment_approved' then
      if v_current = 'pending' then
        update public.orders set status = 'paid' where id = p_order_id;
        update public.payments set status = 'approved' where order_id = p_order_id;
      end if;
    when 'payment_cancelled' then
      if v_current = 'pending' then
        update public.orders set status = 'cancelled' where id = p_order_id;
        update public.payments set status = 'cancelled' where order_id = p_order_id;
      end if;
    when 'refund_completed' then
      update public.payments
        set refunded_amount = refunded_amount + abs(p_amount),
            status = case when refunded_amount + abs(p_amount) >= approved_amount then 'refunded' else 'partial_refunded' end,
            updated_at = now()
        where order_id = p_order_id;
      -- 전액 환불 시에만 orders 도 refunded (부분환불은 paid 유지)
      if exists (select 1 from public.payments where order_id = p_order_id and status = 'refunded') then
        if v_current in ('paid', 'refund_processing') then
          update public.orders set status = 'refunded' where id = p_order_id;
        end if;
      end if;
    else null; -- webhook_received 는 로그만
  end case;
end; $$;

revoke execute on function public.apply_webhook_event(uuid, public.payment_event_type, integer, jsonb, text) from public, anon, authenticated;
grant  execute on function public.apply_webhook_event(uuid, public.payment_event_type, integer, jsonb, text) to service_role;
```

### 4.5 TTL 스윕 (Fallback — Phase H 이전 수동용)

> ⚠️ **주의**: 본 SQL 함수는 "Toss 재확인 없이 pending 을 일괄 cancel" 하는 단순 Fallback 이다. **자동 cron 연동 금지** — 유저가 실제 결제 완료했으나 서버 지연으로 confirm 이 안 된 경우를 cancel 로 오인할 수 있다. Phase H 도입 시에는 `§5.3.2` 의 App 레이어 엔드포인트(`/api/internal/payments/sweep`)가 `tossClient.getPayment()` 로 Toss 측 상태를 재확인한 뒤 복구·취소를 분기하도록 감싸서 호출해야 한다.

```sql
create or replace function public.sweep_stale_pending_orders(p_ttl interval default '30 minutes')
returns integer language plpgsql security definer as $$
declare v_count integer;
begin
  with s as (
    update public.orders set status = 'cancelled', updated_at = now()
     where status = 'pending' and created_at < now() - p_ttl
     returning 1
  )
  select count(*) into v_count from s;
  return coalesce(v_count, 0);
end; $$;
-- Phase H 이전: 운영자가 수동 호출 (SQL editor)
-- Phase H 이후: /api/internal/payments/sweep 엔드포인트가 Toss GET 조회 후 선별적으로 RPC 호출
```

### 4.6 `payment_transactions` 변경 없음

006 스키마 유지. `idempotency_key UNIQUE` 가 멱등성의 핵심.

---

## §5. 실패 · 취소 · 부분취소 매트릭스

행 = 이벤트, 열 = 현재 `orders.status`. 셀 = 처리 결과.

| 이벤트 ↓ / 현재 → | **pending** | **paid** | **shipping / delivered** | **refund_*** | **cancelled / refunded** ■ |
|---|---|---|---|---|---|
| confirm 성공 (Toss 2xx) | paid, `payment_approved` tx, 200 | 200 멱등 skip | 409 | 409 | 409 |
| confirm amount_mismatch | pending 유지, `payment_failed` tx, 409 | 409 | 409 | 409 | 409 |
| confirm Toss 4xx (카드거절) | pending 유지, `payment_failed` tx, 402 | 409 | 409 | 409 | 409 |
| confirm 네트워크·5xx | pending 유지, 기록 없음, 502 | 200 (이미 paid) | 409 | 409 | 409 |
| confirm 중복 요청 | 진행 후 paid | 200 멱등 | 409 | 409 | 409 |
| 웹훅 DONE (confirm 전) | **503 + Retry-After:30** | 200 멱등 | 200 skip | 200 skip | 200 skip |
| 웹훅 DONE (confirm 후) | paid, 200 | 200 멱등 | 200 skip | 200 skip | 200 skip |
| 웹훅 EXPIRED/ABORTED | cancelled, 200 | 운영 알람 + 200 skip | 운영 알람 + 200 skip | 200 skip | 200 skip |
| 웹훅 CANCELED (전액) | cancelled, 200 | refunded, 200 | 어드민 협의 + 200 | refunded, 200 | 200 skip |
| 웹훅 PARTIAL_CANCELED | 이상 — audit 후 200 | paid 유지, `refunded_amount +=`, 200 | paid 유지, 200 | refund_processing 유지, 200 | 200 skip |
| 가상계좌 DEPOSIT_CALLBACK DONE | paid, 200 | 200 멱등 | 200 skip | 200 skip | 200 skip |
| 가상계좌 자동 만료 웹훅 (`EXPIRED`, Toss TTL 7일 도래) | cancelled, `payment_cancelled` tx, 200 | 운영 알람 (선입금 후 만료) + 200 skip | 200 skip | 200 skip | 200 skip |
| 가상계좌 재발급 요청 (유저 재시도, 만료 전) | **금지** — 409 + `virtual_account_reissue_forbidden`. 운영 수동 취소 후 신규 주문 권고 | 409 | 409 | 409 | 409 |
| 웹훅 secret 불일치 | 401 | 401 | 401 | 401 | 401 |
| 웹훅 페이로드 파싱 실패 | 400 | 400 | 400 | 400 | 400 |
| 고객 환불 요청 | N/A (취소만) | refund_requested | refund_requested | 409 | 409 |
| 어드민 환불 수락 | N/A | N/A (선 요청 필요) | N/A | refund_processing + Toss 환불 API | N/A |
| TTL sweep (>30분 pending) | cancelled | 스킵 | 스킵 | 스킵 | 스킵 |

### 5.1 핵심 불변식

- **주류 경로**: `pending → paid → (shipping → delivered) | refund_* → refunded`.
- **confirm API 가 1차 진실** — 카드 결제의 paid 전이는 confirm 응답을 신뢰. 웹훅은 안전망.
- **가상계좌는 웹훅이 1차 진실** — confirm 은 발급 + secret 저장만 수행, paid 전이는 DEPOSIT_CALLBACK 수신 시.
- **부분환불은 `paid` 유지** — `payments.refunded_amount` 누적. approved_amount 도달 순간에만 `orders.status='refunded'`.
- **역방향 전이 전면 차단** — DB 트리거로 강제.
- **Toss 외부 환불 `paid → refunded` 직접 전이 허용** — Toss 어드민 콘솔에서 직접 환불 처리된 경우, 우리 앱의 어드민(`refund_requested → refund_processing`) 을 거치지 않고 웹훅으로만 통지됨. 감사 추적은 `payment_transactions.event_type='payment_cancelled'` + `raw_payload` 에 Toss 응답 원본(`transactionKey`·`canceledAt`)을 보존해 보완.
- **shipping / delivered → cancelled 금지** — 배송 시작 이후 Toss 측 취소 웹훅 수신 시 코드는 상태 변경하지 않고 `payment_transactions` 감사 로그만 기록 (운영 알람). 어드민이 `refund_requested` 수동 전환 후 전자상거래법상의 반품·교환 절차 진행.
- **종료 상태(`cancelled`·`refunded`) 는 영구 불변** — DB 트리거가 OLD=cancelled/refunded 를 모두 거부 (service_role 직접 UPDATE 도 동일). 실수로 종료된 주문의 복구가 필요하면 **신규 주문 발급** (새 order_number) 으로 대응하며, 기존 주문 레코드는 감사 흔적으로 유지한다.

### 5.2 가상계좌 TTL · 재발급 정책 (1 order ↔ 1 payment UNIQUE 귀결)

스키마 설계상 `payments.order_id` 는 UNIQUE — 같은 주문에 `payments` 행은 최대 1건이며, `confirm_payment` RPC 는 `on conflict (order_id) do update` 로 동작한다. 즉 **재발급 시 기존 `webhook_secret` 이 덮어써짐**. 이는 만료 직전 입금이 들어오는 드문 경우에 "이전 secret 분실 → DEPOSIT_CALLBACK 검증 불가" 리스크를 만든다.

**정책**:

1. **Toss 가상계좌 TTL = 7일** (발급 시 기본). `dueDate` 파라미터로 단축 가능하지만 MVP 는 기본값 사용.
2. **유저 셀프 재발급 금지** — `/api/payments/confirm` 는 `orders.status='pending'` + `payments.method='transfer'` + `payments.status='approved'` (WAITING_FOR_DEPOSIT 포함) 상태에서 **같은 order_id 재요청 시 409 반환** (`error: virtual_account_reissue_forbidden`). 유저에게는 "기존 가상계좌 유효기간 안에 입금하거나, 주문을 취소하고 새 주문을 시작하세요" 안내.
3. **만료 자동 처리** — Toss 가 발송하는 `PAYMENT_STATUS_CHANGED` (status=`EXPIRED`) 또는 `DEPOSIT_CALLBACK` 의 `paymentStatus=EXPIRED` 수신 시 `apply_webhook_event('payment_cancelled')` → `orders.status='cancelled'`. 유저는 **신규 주문** 으로 재진행.
4. **예외 — 선입금 후 만료 경합** — 만료 웹훅이 도착했으나 `payments.raw_response` 에 최근 입금 기록이 있는 극단 케이스: **운영 알람** (Phase 3 어드민 대시보드) + 수동 Toss 지원 문의. 코드는 200 skip + 감사 로그만 기록.
5. **Phase 3 정기배송 전환 시 재설계** — `subscriptions ↔ payments (1:N)` 관계로 확장되면 본 1:1 제약은 subscriptions 관계에만 적용하고 orders 는 유지. 현 MVP 범위 밖.

> **구현 훅**: `paymentService.confirm()` 진입부에 `if (order.payment_method === 'transfer' && existingPayment?.status === 'approved') throw ApiError('virtual_account_reissue_forbidden', 409)` 체크 추가 (B-3 단계).

### 5.3 타이밍 역전 보완 (웹훅 > confirm 순서 뒤바뀜 대응)

카드 결제에서 드물게(< 1%) Toss 웹훅이 `/api/payments/confirm` 보다 먼저 도착해 `orders.status='pending'` 이고 `payments` 행이 없는 상태가 발생한다. 현 설계는 **503 + `Retry-After: 30`** 으로 Toss 재시도를 유도하고, Toss 는 exponential backoff 로 최대 7회 재시도(≈ 127초 창)한다. 대부분 이 창 안에 confirm 이 완료되어 자연 수렴하지만, 다음 두 구멍이 존재해 **보완 2건**을 명시한다.

**5.3.1 503 응답의 Sentry 알람 오탐 (Phase 2-B 범위)**
- 증상: 타이밍 역전 503 은 의도된 정상 동작이지만 5xx 경보 룰을 튀게 함.
- 보완: 웹훅 라우트가 503 반환 시 응답 헤더 `x-webhook-timing-inversion: true` 추가 + Sentry `init` 에 해당 태그 샘플링 제외 룰 등록.
```ts
// app/api/payments/webhook/route.ts — 503 반환부
return new Response(JSON.stringify({ error: 'timing_inversion_retry' }), {
  status: 503,
  headers: { 'Retry-After': '30', 'x-webhook-timing-inversion': 'true' },
})
```
- Sentry 룰: `beforeSend(event) { if (event.tags?.timing_inversion) return null; ... }` (B-4 구현 시 함께 반영).

**5.3.2 7회 재시도 실패 → 영구 pending 복구 (Phase H 범위)**
- 증상: 우리 서버 배포·DB 락 등으로 confirm 이 2분 넘게 지연되면 Toss 재시도가 모두 실패 → 유령 pending 주문 발생.
- 보완: `sweep_stale_pending_orders` 를 SQL 함수 단독 호출이 아니라 **App 레이어 엔드포인트 `/api/internal/payments/sweep`** 로 감싸, pending > 30분 주문에 대해 `tossClient.getPayment(orderId)` GET 조회 단계를 추가한다.
  - Toss `status='DONE'` → `apply_webhook_event('payment_approved')` 복구
  - Toss `status` ∈ `{EXPIRED, ABORTED, CANCELED}` → `orders.status='cancelled'` + 감사 로그
  - Toss 404 (결제 자체 미진행) → `cancelled` + 감사 로그
  - Toss `WAITING_FOR_DEPOSIT` (가상계좌) → skip (만료 전 유효)
- Vercel Cron 5분 주기 (Phase H 도입). 결과 집계는 Sentry/Slack 알림.
- SQL 단독 sweep(`§4.5`)은 Phase H 이전 수동 Fallback 용으로만 사용.

**5.3.3 운영 수동 복구 경로** (SOP)
- 극단 케이스(모든 자동 복구 실패) 에서는 운영자가 **Toss 대시보드 > 해당 거래 > 웹훅 재전송** 버튼으로 동일 이벤트를 재발송 가능.
- Phase 2-G 운영 매뉴얼에 절차 기록.

---

## §6. 보안 · Rate Limit · CSRF

### 6.1 CSRF

- `/api/payments/confirm` → `enforceSameOrigin` 적용 (일반 폼 POST).
- `/api/payments/webhook` → `lib/api/csrf.ts` `CSRF_EXEMPT_PATHS` 에 추가. origin 검증 불가 (외부 발신). §3.2 의 수단별 인증으로 대체.

```ts
// lib/api/csrf.ts (추가)
export const CSRF_EXEMPT_PATHS = new Set<string>(['/api/payments/webhook'])

export function enforceSameOrigin(request: Request): Response | null {
  const { pathname } = new URL(request.url)
  if (CSRF_EXEMPT_PATHS.has(pathname)) return null
  /* 기존 로직 유지 */
}
```

### 6.2 Rate Limit

| 엔드포인트 | 윈도 | 한도 | 키 |
|---|---|---|---|
| `/api/payments/confirm` | 60s sliding | 10 req | IP |
| `/api/payments/webhook` | 미적용 | — | — |

`lib/auth/rateLimit.ts` 에 `payment_confirm` preset 추가.

### 6.3 timing-safe 비교 (가상계좌)

```ts
import { timingSafeEqual } from 'crypto'

export function verifySecret(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
```

### 6.4 Basic Auth 로깅 금지

`tossClient.ts` 는 에러 객체에 `Authorization` 헤더를 **포함하지 않음**. 에러 로깅 시 request config 를 직렬화하기 전 헤더 stripping.

### 6.5 secret 저장 · 누출 방지

MVP 는 `payments.webhook_secret` **평문 + RLS = service_role 전용**. 판단 근거와 보조 방어는 아래와 같다. 전체 위협 모델은 [ADR-002 §4.1](./adr/ADR-002-payment-webhook-verification.md) 참조.

**6.5.1 평문 유지 판단 근거**
- 피해 범위가 per-payment (유출 secret 은 해당 결제 1건에만 유효).
- 가장 현실적인 공격 경로(`SUPABASE_SERVICE_ROLE_KEY` 유출)에서 pgcrypto 는 무용 — 앱이 복호화 키를 보유하므로 함께 유출됨.
- 법적 의무 없음 (개인정보·접근매체·PCI 대상 아님).

**6.5.2 Sentry breadcrumb / event 필터** (필수 — 플랫폼 통합 시)
```ts
// next/src/lib/observability/sentry.ts (Phase 2-B 추가)
Sentry.init({
  beforeSend(event) {
    return scrubPaymentSecrets(event)
  },
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.data && typeof breadcrumb.data === 'object') {
      scrubPaymentSecrets(breadcrumb)
    }
    return breadcrumb
  },
})

// 규칙: body/query/params 내 key ∈ {secret, webhook_secret, authorization} → '[REDACTED]'
// payments 테이블 쿼리 파라미터 sanitize, Toss confirm 응답 body 의 virtualAccount.secret 제거.
```

**6.5.3 Logger utility 마스킹**
- `next/src/lib/observability/logger.ts` 에 redact 룰 추가: `secret`, `webhook_secret`, `Authorization`, `password`, `pin`, `token` 키는 `[REDACTED]` 치환.
- `payment_transactions.raw_payload` INSERT 전에도 동일 치환 (ADR-002 §3.3 의 `raw_payload` redact 규칙과 공유 유틸).
- 단위 테스트: `logger.test.ts` 에 "webhook_secret 키는 출력되지 않는다" 케이스 추가.

**6.5.4 env key 회전 정책**
- `SUPABASE_SERVICE_ROLE_KEY` 는 Supabase Dashboard > Settings > API 에서 **분기당 1회 순환** (Phase 2-G 배포 이후 정기 스케줄).
- 긴급 순환 트리거: 유출 의심 / 퇴사 / 테스트 환경 실수 노출.
- 절차: 새 키 발급 → Vercel env staging 에 선반영 → 정상 확인 → production 교체 → 구 키 폐기.
- 키 교체 시 `payments.webhook_secret` 은 영향받지 않음 (다른 체계).

**6.5.5 Phase 3 pgcrypto 이행 경로** (참고 — 이번 범위 밖)
```sql
-- 스키마 변경 최소화: text → bytea + 함수 래퍼
alter table payments rename column webhook_secret to webhook_secret_plain;
alter table payments add column webhook_secret_enc bytea;
update payments set webhook_secret_enc = pgp_sym_encrypt(webhook_secret_plain, current_setting('app.webhook_key'));
alter table payments drop column webhook_secret_plain;
-- 앱 레이어는 paymentRepo.ts 의 decrypt helper 에서만 복호화 — 경로 캡슐화.
```
- 복호화 키는 Supabase Vault 또는 Vercel env 분리 저장.
- 비용: 웹훅 검증당 `pgp_sym_decrypt` 1회 호출 — 벤치마크 이후 결정.

### 6.6 오류 메시지 leakage

클라 응답은 `{ error: 'payment_failed', code: 'card_declined' | 'amount_mismatch' | ... }` 의 **제한된 enum** 만 반환. Toss 내부 메시지는 서버 로그(Sentry) 로만.

---

## §7. 테스트 계획 (B-6)

### 7.1 단위 (vitest + MSW)

| 파일 | 주요 케이스 |
|---|---|
| `paymentService.test.ts` | 정상 승인 / amount_mismatch / order_not_pending / Toss 4xx / Toss 5xx 재시도 / 중복 confirm 멱등 / 가상계좌 승인(secret 저장) |
| `tossClient.test.ts` | Basic Auth 포맷 / 타임아웃 / 에러 로깅 Authorization 미포함 / GET /v1/payments/{key} |
| `verifyWebhook.test.ts` | card = GET 재조회 mock / virtualAccount = timing-safe 통과·불일치·길이 불일치 / DB 조회 실패 시 false |

### 7.2 라우트 (Next.js handler test)

| 라우트 | 케이스 |
|---|---|
| `/api/payments/confirm` | CSRF 차단 / rate limit 11번째 429 / zod 실패 400 / 서비스 에러 매핑 |
| `/api/payments/webhook` | card PAYMENT_STATUS_CHANGED DONE 정상 / 가상계좌 DEPOSIT_CALLBACK 정상 / secret 불일치 401 / 중복 idempotency_key 200 skip / unknown eventType 200 감사만 / 타이밍 역전 503 |

### 7.3 DB (integration — 로컬 Supabase)

- `confirm_payment` RPC 트랜잭션 롤백 (payments INSERT 실패 시 orders 롤백)
- `apply_webhook_event` 중복 idempotency_key → 23505
- `orders_status_transition_check` 트리거 — paid→pending 강제 UPDATE 시 raise

### 7.4 신규 의존성

`msw@^2.x` 추가 필요. 현재 미설치.

### 7.5 커버리지 목표

`paymentService`·`verifyWebhook`·`tossClient` 라인 95%+. 결제 경로는 backend-architecture-plan §10.3 목표에 준함.

---

## §8. 운영 체크리스트 · 블로커

### 8.1 배포 전 체크리스트

- [ ] Toss Dashboard 에 웹훅 URL 등록 (`https://<prod>/api/payments/webhook`)
- [ ] 테스트키 → 라이브키 전환 확인 (env 교체)
- [ ] `payments` RLS 정책 미선언 = service_role 전용 동작 검증 (`select * from payments` as authenticated → 0 rows)
- [ ] `orders_status_transition` 트리거 활성 확인
- [ ] 가상계좌 결제 종단 수동 테스트 (secret 저장·웹훅 수신·paid 전이)
- [ ] Rate limit preset 적용 확인
- [ ] Sentry 또는 대체 모니터링 설정 (5xx·타이밍 역전 503 추적)
- [ ] **청약철회 안내 페이지 제공 확인** (전자상거래법 요건) — 약관/FAQ 에 환불 문의 채널(CS 이메일) 명시
- [ ] **어드민 Toss Dashboard 접근 권한 관리** — MVP 환불 채널이므로 담당자 한정 계정 공유 금지

### 8.2 사용자 결정 필요 블로커

| # | 항목 | 영향 | 권장 |
|---|---|---|---|
| ~~1~~ | ~~Toss confirm API `Idempotency-Key` 헤더 지원 여부~~ | — | **해결됨 (v1.0.6)** — §3.1.3 3중 방어 채택으로 Toss 지원 여부와 무관하게 중복 confirm 흡수. |
| ~~2~~ | ~~환불 UI 범위~~ | — | **해결됨 (v1.0.7)** — **전액·부분환불 모두 어드민 경유** (MVP Toss Dashboard → Phase 3 자체 어드민 툴). 고객 셀프 환불 UI 영구 deferred. 청약철회 법 요건은 안내 페이지로 충족 (§8.1). |
| ~~3~~ | ~~pending TTL 스윕 도입 시점~~ | — | **해결됨 (v1.0.7)** — B-7 폴리시 이후 Phase H 인프라 단계 Vercel Cron + §4.5 `sweep_stale_pending_orders` + Toss GET 재조회 (§5.3.3). 임계값 24h. |
| ~~4~~ | ~~가상계좌 웹훅 누락 대응~~ | — | **해결됨 (v1.0.7)** — Phase 3 어드민 대시보드 쿼리 (`status=pending AND method=transfer AND created_at < now() - interval '2 hours'`) + 수동 `apply_webhook_event` RPC 호출 SOP. |
| 5 | `msw@^2.x` devDep 추가 | B-6 테스트 MSW 필요 | **승인됨 (v1.0.7)** — Session 4 B-6 진입 시 `cd next && pnpm add -D msw@^2.7.0` 실행. 핸들러 파일은 `next/tests/mocks/toss-handlers.ts`. |
| 6 | 012 마이그레이션 적용 방법 | Session 4 B-3 착수 차단 | **확정 (v1.0.7)** — Supabase Studio SQL Editor 수동 적용 (011 과 동일). Claude 가 `supabase/migrations/012_payments_hardening.sql` 파일 생성, 사용자가 Studio 에서 실행. Phase 2-G 진입 시 CLI 방식 재검토. |
| ~~7~~ | ~~secret 암호화~~ | — | **해결됨 (v1.0.7)** — MVP 평문 + `SUPABASE_SERVICE_ROLE_KEY` 분리·순환 (§6.5.4) + Phase 3 pgcrypto 이행 경로 (§6.5.5). 위협 모델 분석상 동일 env 에 암호화 키 존재 시 실익 제한. |

### 8.3 단계별 진입 조건

- **B-2 결제위젯 UI** → §1.3 선행 조건 만족 시 즉시 착수 가능
- **B-3 confirm API** → §4 012 마이그레이션 승인·적용 필요
- **B-4 웹훅** → B-3 완료 후 즉시 (블로커 #1 해결됨)
- **B-5 상태머신 통합** → §4.2~§4.4 RPC/트리거 배포 완료
- **B-6 TDD** → §8.2 #5 승인
- **B-7 4-병렬 리뷰** → B-3~B-6 완료

---

## §9. 변경 이력

| 날짜 | 버전 | 작성자 | 변경 |
|---|---|---|---|
| 2026-04-16 | v1.0 | JW (+ Claude Opus 4.6) | 최초 작성. planner + architect 병렬 설계 + Toss 공식 문서 재확인으로 수단별 하이브리드 확정. |
| 2026-04-16 | v1.0.1 | JW (+ Claude Opus 4.6) | §5 매트릭스 2행 추가 (가상계좌 자동 만료 · 유저 재발급 금지) + §5.2 가상계좌 TTL·재발급 정책 신설. 1 order ↔ 1 payment UNIQUE 유지 판단 결과 반영. |
| 2026-04-16 | v1.0.2 | JW (+ Claude Opus 4.6) | §5.1 불변식 3건 추가: Toss 외부 환불 `paid→refunded` 직접 전이 감사 추적, shipping/delivered → cancelled 금지·어드민 수동 경로, 종료 상태 복구 불가·신규 주문으로 대응. 트리거 허용 매트릭스 ↔ §5 이벤트 매트릭스 전수 교차 검증 완료(17 이벤트 일치). |
| 2026-04-16 | v1.0.3 | JW (+ Claude Opus 4.6) | §6.5 secret 저장 섹션 확장: 평문 유지 판단 근거 + Sentry beforeSend/beforeBreadcrumb 필터 + logger 마스킹 룰 + `SUPABASE_SERVICE_ROLE_KEY` 분기 순환 정책 + Phase 3 pgcrypto 이행 경로. 위협 모델 5개 경로 분석 결과 MVP 평문 유지. |
| 2026-04-16 | v1.0.4 | JW (+ Claude Opus 4.6) | §5.3 타이밍 역전 보완 신설: 503 응답 `x-webhook-timing-inversion` 태그 + Sentry 샘플링 제외 (Phase 2-B) + Phase H sweep 엔드포인트가 Toss GET 조회로 복구·취소 분기 + 운영 수동 재전송 SOP. §4.5 SQL 함수를 Fallback 으로 재정의(자동 cron 금지 경고 추가). |
| 2026-04-16 | v1.0.5 | JW (+ Claude Opus 4.6) | §3.2.2·§3.2.3 의 `idempotency_key` 합성 규칙을 **이벤트별 하이브리드** 로 교체 + §3.2.5 통합 규칙 섹션 신설. context7 재검증 결과 `PAYMENT_STATUS_CHANGED.data.lastTransactionKey` 존재 · `DEPOSIT_CALLBACK` 에는 부재 · 부분취소는 `data.cancels[]` 배열로 제공됨을 확인. 종전 규칙(`{paymentKey}:{status}:{approvedAt}`) 은 PARTIAL_CANCELED 다회 발생 시 `approvedAt` 이 원 승인 시각으로 고정되어 동일 키로 collapse → 감사 로그 유실 엣지 케이스 존재. 신규 규칙은 `cancels[-1].transactionKey` 로 구분. ADR-002 §3.3 동일 반영. |
| 2026-04-16 | v1.0.6 | JW (+ Claude Opus 4.6) | §3.1.3 **3중 방어 섹션 신설** — Toss 가 confirm `Idempotency-Key` 헤더를 공식 지원하지 않는 현실을 전제로, ① 앱 레이어 pre-check (`orders.status='paid'` → Toss 호출 생략) · ② `confirm_payment` RPC FOR UPDATE + 멱등 RETURN (§4.3) · ③ `payment_transactions.idempotency_key UNIQUE` (`confirm:{paymentKey}`) 3개 독립 계층으로 중복 confirm 흡수. 시나리오별 커버리지 매트릭스 포함. 블로커 #1 **해결됨** 마킹 (§8.2). §3.1.1 Idempotency-Key 주석을 §3.1.3 참조로 축약. |
| 2026-04-16 | v1.0.7 | JW (+ Claude Opus 4.6) | **블로커 #2~#7 전체 확정** — §1.2 범위에 "고객 셀프 환불 UI 영구 deferred" 명시(전액·부분 모두 어드민 경유) · §8.1 체크리스트에 청약철회 안내 페이지 + Toss Dashboard 접근 권한 관리 2항목 추가 · §8.2 블로커 테이블 6건 해결/확정 상태 마킹. 부분환불 UI 제공 시 수요 유도 우려 (사용자 지적) 수용 → MVP Toss Dashboard → Phase 3 자체 어드민 툴 경로로 일원화. msw@^2.7.0 승인 + 012 마이그레이션 Supabase Studio 수동 적용 확정. |
