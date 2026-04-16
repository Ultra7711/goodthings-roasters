# ADR-002: TossPayments 웹훅 인증 모델 — 수단별 하이브리드

**상태:** Proposed (Session 3 사용자 승인 대기)
**작성일:** 2026-04-16
**작성자:** JW (굳띵즈 로스터스)
**관련:** `docs/payments-flow.md`, `docs/backend-architecture-plan.md §6.2`, `supabase/migrations/006_payment_transactions.sql`, `supabase/migrations/012_payments_hardening.sql` (예정)

---

## 1. Context (배경)

굳띵즈 로스터스는 Phase 2 에서 TossPayments 를 결제 PG 로 사용하며, `orders.payment_method` enum = `card | transfer` 두 수단을 지원한다. 결제 승인 이후 상태 동기화를 위해 Toss 공식 웹훅(`POST /api/payments/webhook`) 을 수신해야 한다.

Session 3 진입 시 사용자 지정으로 **"per-payment secret 모델 (HMAC 아님)"** 을 전제로 설계에 착수했으나, Toss 공식 문서 (context7 `/llmstxt/tosspayments_llms_txt`, 출처 `docs.tosspayments.com/en/webhooks`) 재검증 결과 **결제 수단별로 웹훅 페이로드·인증 모델이 다름** 을 확인했다.

### 1.1 Toss 웹훅 이원화

| 이벤트 | 사용 결제수단 | `secret` 필드 | Toss 공식 인증 패턴 |
|---|---|---|---|
| `PAYMENT_STATUS_CHANGED` | **카드** · 간편결제 등 일반 | 없음 | 웹훅은 "신호" 역할만. 수신 후 `GET /v1/payments/{paymentKey}` Basic Auth 재조회로 실제 상태 검증 |
| `DEPOSIT_CALLBACK` | **가상계좌 (transfer)** 전용 | **있음** (top-level) | 가상계좌 발급 응답(`POST /v1/virtual-accounts`)의 `secret` 을 DB 저장 → 웹훅 도착 시 timing-safe 비교 |

즉 사용자가 말한 "per-payment secret" 모델은 **가상계좌 한정** 으로만 성립하고, 카드 결제 웹훅에는 별도 시크릿이 없으므로 **GET 재조회** 가 공식 패턴이다.

### 1.2 재시도 정책

Toss 는 2xx 응답을 받지 못하면 **exponential backoff 로 최대 7회 재시도**한다. 상태가 `Sending` 으로 유지되며 최종 실패 전까지 지속적으로 재전송된다. 멱등성 설계가 필수.

### 1.3 기존 DB 제약

- `payment_transactions.idempotency_key UNIQUE` (006 에서 기설정) — 중복 웹훅 INSERT 차단 → 23505 catch → skip
- `payment_transactions` RLS = service_role 전용 (007)
- `orders` 생성은 `create_order` RPC 단일 경로 (011)

---

## 2. Problem (해결해야 할 문제)

1. 웹훅 수신 경로는 단일 URL (`POST /api/payments/webhook`) 이지만, **카드·가상계좌 인증 방식이 다름** → 단일 코드 경로가 분기 처리 가능해야 한다.
2. Toss 에서 HMAC 공유 시크릿 검증 방식은 공식 지원하지 않는다 → 배제.
3. 카드 웹훅은 secret 이 없어 **위조 위험**: 공격자가 `orders.status='paid'` 로 위조 요청을 보낼 가능성. 방어책이 필요.
4. 가상계좌 웹훅은 secret 이 있으나 **secret 저장·관리** (발급 시점·저장 위치·암호화·폐기 정책) 가 필요.
5. 두 이벤트 모두 **타이밍 역전** 가능: 웹훅이 confirm API 보다 먼저 도착할 수 있다 (카드의 경우 READY→IN_PROGRESS→DONE 전이 중 다수 이벤트 발생).
6. 카드 사용자가 대부분인 MVP 단계에서 **가상계좌만을 위해 설계 복잡도를 과하게 키우는 것** 은 비경제적. 그러나 규정상 무통장입금(=가상계좌)도 제공해야 한다.
7. `backend-architecture-plan.md §6.2` 는 "HMAC-SHA256 웹훅" 으로 기재되어 있어 **현실과 문서 간 편차** 존재 → 본 ADR 로 정정.

---

## 3. Decision (결정)

**결제 수단별 하이브리드 인증 모델을 채택한다.**

### 3.1 카드 (`PAYMENT_STATUS_CHANGED`) — GET 재조회 방식

1. 웹훅 수신 시 **페이로드 본문 신뢰하지 않음** (위조 가능성).
2. `data.paymentKey` 를 추출해 **`GET /v1/payments/{paymentKey}`** 호출 (Basic Auth `base64('{TOSS_SECRET_KEY}:')`).
3. Toss 가 반환한 **권위 있는 상태** (`status`, `totalAmount`, `approvedAt`) 를 기준으로 `orders` · `payment_transactions` 동기화.
4. 위조 시 GET 응답이 `orders.total_amount` 와 불일치하거나 존재하지 않는 `paymentKey` → 401 또는 400 으로 거부.
5. 위조 방어: 공격자가 유효한 `paymentKey` 를 알고 있지 않은 이상 재조회 단계에서 자연 차단.

### 3.2 가상계좌 (`DEPOSIT_CALLBACK`) — per-payment secret

1. 가상계좌 발급 시 Toss 응답의 `secret` 필드를 **`payments.webhook_secret`** (신규 012 마이그레이션) 에 저장.
2. 웹훅 수신 시 top-level `secret` 필드를 DB 저장 값과 **`crypto.timingSafeEqual`** 비교.
3. 불일치 시 401. 일치 시에도 `payments.approved_amount` 와 Toss 재조회 금액 교차 검증(정합성 보장).
4. 저장: MVP 는 **평문** + `payments` RLS = service_role 전용 (pgcrypto 암호화는 Phase 3 로 deferred — 현 SUPABASE_SERVICE_ROLE_KEY 유출 시 secret 유출 영향은 해당 결제 1건에 한정).

### 3.3 공통 규칙

- **CSRF 예외**: `/api/payments/webhook` 은 `enforceSameOrigin` 화이트리스트 (외부 발신자가 원칙이므로 origin 검증 불가). 인증은 §3.1/§3.2 로 대체.
- **멱등성**: `payment_transactions.idempotency_key UNIQUE` 23505 catch → 200 skip. 키 생성 규칙은 **이벤트별 하이브리드** 로 확정 (상세는 `payments-flow.md §3.2.5`):
  - `PAYMENT_STATUS_CHANGED` (일반) → `webhook:{paymentKey}:{lastTransactionKey}`
  - `PAYMENT_STATUS_CHANGED` (PARTIAL_CANCELED) → `webhook:{paymentKey}:partial:{cancels[-1].transactionKey}` (다회 부분취소 감사 손실 방지)
  - `DEPOSIT_CALLBACK` → `webhook:deposit:{orderId}:{paymentStatus}:{createdAt}` (lastTransactionKey 부재)
  - confirm 내부 → `confirm:{paymentKey}` (1 order ↔ 1 payment UNIQUE 와 중복 차단)

  근거: context7 `/llmstxt/tosspayments_llms_txt` 재검증 결과 `PAYMENT_STATUS_CHANGED.data.lastTransactionKey` 존재 · `DEPOSIT_CALLBACK` 에는 부재 · 부분취소는 `data.cancels[]` 배열로 제공됨을 확인.
- **재시도 안전 응답**: 정상·중복·알 수 없는 eventType 모두 200 반환. secret 불일치 = 401, payload 파싱 실패 = 400, DB 오류 = 5xx (Toss 재시도 유도).
- **타이밍 역전**: 웹훅이 confirm 전 도착하여 `orders.status='pending'` 이고 대응 `payments` 행이 없으면 → **503 + `Retry-After: 30`** 로 Toss 재시도 유도. 다음 재시도 전에 confirm 이 완료되어 수렴.
- **로깅**: `raw_payload` 를 `payment_transactions` 에 저장 (감사 로그). 단 `secret` 필드는 저장 시 `[REDACTED]` 치환.

### 3.4 state 머신과의 관계

- 카드: `confirm API` 응답을 1차 진실 소스로 삼고, 웹훅은 안전망 역할.
- 가상계좌: `confirm API` 는 "가상계좌 발급 완료 = status:WAITING_FOR_DEPOSIT" 만 의미. **입금 확정은 `DEPOSIT_CALLBACK` 이 유일한 진실 소스**. 따라서 가상계좌는 웹훅 누락 시 주문이 영구 pending 상태 → 운영 모니터링 필수.

---

## 4. Consequences (결과)

### 4.1 긍정적 영향

- **Toss 공식 패턴 준수** — 결제 수단별 권장 검증 방식을 따르므로 향후 Toss API 변경에도 비교적 안전.
- **위조 방어 강화** — 카드 경로는 Basic Auth 를 보유한 서버만 GET 재조회가 가능하므로, 웹훅 본문 위조 공격이 자연 차단.
- **secret 유출 영향 한정** — 가상계좌 secret 은 결제 1건에 귀속 → 노출 시에도 해당 결제만 영향.
- **멱등성 내장** — DB UNIQUE 제약으로 Toss 7회 재시도 모두 안전하게 흡수.

### 4.2 부정적 영향 · 감수 사항

- **카드 경로 추가 API 호출** — 웹훅당 GET /v1/payments 1회 = 네트워크 레이턴시 + Toss API rate limit 소비. MVP 트래픽 규모에서는 문제 없음.
- **웹훅 라우트 단일 경로 분기 복잡도** — eventType 에 따라 카드·가상계좌 로직이 갈라짐. 서비스 레이어에서 폴리모픽 핸들러 구조(`handleCardWebhook` / `handleVirtualAccountWebhook`) 로 분리 관리.
- **가상계좌 웹훅 누락 취약** — 입금 확정 이벤트가 유일한 진실 소스이므로, Toss 재시도 7회 모두 실패 시 수동 개입 필요. 운영 대시보드(`payment_transactions.event_type='webhook_received' + orders.status='pending'` 쿼리) 필수.
- **`backend-architecture-plan.md §6.2` 문서 편차** — "HMAC-SHA256 웹훅" 표기를 본 ADR 로 정정 공지 (해당 섹션에 링크 추가).

### 4.3 거부된 대안

| 대안 | 이유 |
|---|---|
| **HMAC 공유 시크릿 방식** | Toss 공식 미지원. 임의 구현 시 비표준 → 유지보수 부담 + rotation 전략 필요. |
| **IP 화이트리스트 단독 방어** | Toss 가 공식 IP 범위를 고정 공개하지 않음. CDN·프록시 거치면 판별 불가. secret/GET 재조회 보조로만 활용 가능. |
| **모든 결제수단 GET 재조회 통일** (가상계좌 secret 무시) | 가능하지만 Toss 가 명시적으로 제공한 secret 방어를 버리는 것은 보안 약화. 유지. |
| **`orders` 에 payment_key/secret 컬럼 직접 추가** (옵션 C, 초안) | orders 의 역할이 "주문" + "결제 상세" 로 혼재. 부분환불·재결제 확장 시 정규화 훼손. 옵션 A(payments 테이블 신설) 채택. |

---

## 5. Rollout (배포 계획)

1. **012 마이그레이션 (`012_payments_hardening.sql`)**:
   - `payments` 테이블 신설 (1 order ↔ 1 payment UNIQUE). `webhook_secret text` (nullable, 가상계좌만 설정).
   - `order_status` 전이 트리거 `orders_status_transition_check()`.
   - `confirm_payment` / `apply_webhook_event` RPC.
   - `payments` RLS = service_role 전용.

2. **애플리케이션 코드**:
   - `next/src/lib/payments/tossClient.ts` — `confirmPayment` · `getPayment` (GET 재조회) 포함.
   - `next/src/lib/payments/verifyWebhook.ts` — `verifyVirtualAccountSecret` + `verifyCardPaymentByGet` 두 전략.
   - `next/src/app/api/payments/webhook/route.ts` — eventType 에 따라 분기.
   - `next/src/lib/api/csrf.ts` — `CSRF_EXEMPT_PATHS` 에 `/api/payments/webhook` 추가.

3. **운영 모니터링**:
   - 가상계좌 pending 30분 초과 → 어드민 알림 (Phase 2-B 범위 밖, 플로우 문서에 체크리스트로 기록).
   - 웹훅 5xx 비율·재시도 카운트 로깅.

4. **문서**:
   - `backend-architecture-plan.md §6.2` 에 본 ADR 링크 + 편차 공지.
   - `docs/payments-flow.md` 에 전 구조 반영.

---

## 6. References

- Toss 공식 — Webhooks: https://docs.tosspayments.com/en/webhooks
- Toss 공식 — API Guide · Confirm: https://docs.tosspayments.com/en/api-guide
- context7 `/llmstxt/tosspayments_llms_txt` (2026-04-16 조회)
- `docs/backend-architecture-plan.md` §6.1~§6.3
- `supabase/migrations/006_payment_transactions.sql` (idempotency_key UNIQUE)
- `supabase/migrations/007_rls_policies.sql` (payment_transactions RLS)
- `supabase/migrations/011_orders_hardening.sql` (RPC 단일 경로 패턴)
