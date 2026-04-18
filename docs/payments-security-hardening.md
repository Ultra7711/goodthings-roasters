# Good Things Roasters — 결제 보안 하드닝 (Session 8 보안 4건)

> **버전:** v1.0 (confirmed, 2026-04-17)
> **상태:** Approved — 권장안 전부 확정 (D1~D11). 구현 착수.
> **범위:** Carding rate limit · Referrer-Policy · order_number 난독화 · PCI 로그 보존
> **관련 문서:** [payments-flow.md](./payments-flow.md) · [ADR-002 웹훅 인증](./adr/ADR-002-payment-webhook-verification.md) · [email-infrastructure.md](./email-infrastructure.md) · [oauth-security-plan.md](./oauth-security-plan.md)

---

## §0. 30초 요약

**무엇을** — Session 7(B-5 정산) 완료 후 식별된 결제 경로 보안 4건을 Session 8 단위로 일괄 하드닝한다:
1. `POST /api/payments/confirm` 카드 테스팅(carding) 공격 차단
2. 결제 완료 페이지 Referer 누출 차단
3. `GT-YYYYMMDD-NNNNN` 순차 주문번호 enumeration 방어
4. Vercel/Supabase 로그에 남는 Toss paymentKey/PII 보존 정책 확정

**왜** — P2-B B-4 웹훅까지 ADR-002 하이브리드 인증으로 공격 표면은 좁혔으나, confirm 라우트는 여전히 IP 기반 10 req/min 단일 preset 에 의존. 프로덕션 출시 전 PCI DSS v4.0 §3.4 / §10.7, OWASP ASVS v4.0 §1.8·§7.1·§13.2 기준선을 충족시켜야 하며, 본 스펙이 그 도달선이다.

**우선순위 / 롤아웃 순서** — `#4 PCI 로그` → `#1 Carding RL` → `#2 Referrer-Policy` → `#3 order_number`. 시스템 파급도 vs 구현 리스크 균형.

---

## §1. 개요 · 위협 모델

### 1.1 OWASP / PCI 맵핑

| 항목 | OWASP Top 10 2021 | OWASP ASVS v4.0 | PCI DSS v4.0 |
|---|---|---|---|
| #1 Carding RL | A04 Insecure Design · A07 Auth Failures | §4.2.2 anti-automation | §6.4.3 payment page integrity |
| #2 Referrer-Policy | A05 Security Misconfiguration | §14.4.4 referrer policy | §6.4.1 browser-side protections |
| #3 order_number | A01 Broken Access Control · A04 | §4.2.1 IDOR · §8.2.2 opaque identifiers | §3.3.1 render unreadable |
| #4 PCI 로그 | A09 Security Logging Failures | §7.1.1 · §8.3.5 sensitive data in logs | §3.4 · §10.7 · §10.4.1 |

### 1.2 현재 구현 스냅샷 (근거)

- Rate limiter: `next/src/lib/auth/rateLimit.ts` — `payment_confirm = 10 req/60s (IP)`. 실패/성공 구분 없이 단일 카운터.
- CSRF: `next/src/lib/api/csrf.ts` — Origin 헤더 화이트리스트. 웹훅 경로 예외.
- 보안 헤더: `next/next.config.ts:SECURITY_HEADERS` — 전역 `Referrer-Policy: strict-origin-when-cross-origin`.
- 주문번호 채번: `supabase/migrations/011_orders_hardening.sql` — `public.set_order_number` 트리거, `order_number_seq` sequence + `GT-YYYYMMDD-NNNNN[N]` CHECK.
- Toss 민감 필드 마스킹: `next/src/lib/payments/mask.ts:maskTossPayload` — `payments.raw_response` 저장 전 card/VA/cashReceipt/email/phone 마스킹.
- 로그:
  - `next/src/lib/services/paymentService.ts:326` — `console.warn` 에 `paymentKey` 전체 값 출력.
  - `next/src/app/api/payments/confirm/route.ts:98` — 예외 `console.error` (스택 포함).
  - `next/src/app/api/payments/webhook/route.ts:103, 147` — 예외 `console.error`.
  - `next/src/lib/services/webhookService.ts:310` — eventType/idempotencyKey 만 출력 (정상).

---

## §2. 위협 #1 — Carding Rate Limit

### 2.1 시나리오
공격자가 도난 카드 BIN 리스트 + CVV brute 를 돌릴 때, **봇 프레임워크** 로 결제위젯 DOM 에 타이핑 후 confirm 호출을 반복할 수 있다. 우리 쪽 관측 지점은 `POST /api/payments/confirm` 이고, Toss 거절 응답(`INVALID_CARD`, `REJECT_CARD_COMPANY`, `NOT_SUPPORTED_CARD_TYPE` 등) 이 반복적으로 돌아온다.

### 2.2 확정안 — **B (이중 preset) + C 부분**

- 새 preset `payment_confirm_reject = 5 req / 10min` (Toss 카드 거절 코드 전용).
- 기존 `payment_confirm = 10 req/60s` 유지. 총량 상한 역할.
- **확정 D1**: 로그인 = `user_id`, 게스트 = IP 단독. sessionId 는 복잡도 회피.
- **확정 D2**: 차단 후 자동 해제 (10min 경과). 수동 해제는 Phase H 어드민 대기.
- **확정 D3**: `EXCEED_MAX_DAILY_PAYMENT_COUNT` 는 **제외** — 카드사 레벨 한도라 공격 시그널과 무관.
- 429 응답 body `code: 'too_many_card_attempts'` 로 CheckoutPage FAQ 분기.

### 2.3 구현 계획

- `next/src/lib/auth/rateLimit.ts` — `RateLimitPreset` 에 `payment_confirm_reject` 추가, `LIMITS` 확장.
- `next/src/lib/payments/tossErrorCodes.ts` (신설):
  - `CARD_REJECT_CODES: ReadonlySet<string>` — `INVALID_CARD`, `REJECT_CARD_COMPANY`, `NOT_SUPPORTED_CARD_TYPE`, `INVALID_CARD_NUMBER`, `INVALID_CARD_EXPIRATION`, `EXCEED_MAX_CARD_INSTALLMENT_PLAN`.
  - `isCardRejectionCode(code: string): boolean`.
- `next/src/lib/auth/rateLimit.ts` — `recordCardingAttempt(request, userId, tossCode)` 새 유틸. 키: `{ip}:{userIdOrGuest}`.
- `next/src/app/api/payments/confirm/route.ts`:
  - Toss `toss_failed` catch 시점에 `recordCardingAttempt()` 호출 (카드 거절 코드에만 incr).
  - 다음 호출에서 preset 한도 초과 시 429 `too_many_card_attempts` 거부.
- `CARDING_LIMIT_ENABLED` env flag — 배포 후 24h dry-run (카운트만 기록, 차단 없음) → 실활성화.
- 테스트:
  - unit: `rateLimit.preset.test.ts` — 새 preset 한도 검증.
  - integration: 5회 연속 REJECT_CARD_COMPANY → 6번째 429.

---

## §3. 위협 #2 — Referrer-Policy

### 3.1 시나리오
결제 완료 URL `/order-complete?orderNumber=GT-20260417-00042` 가 GTM / GA4 / 광고 태그 등 3rd-party 스크립트의 이벤트에 full URL 로 기록될 위험.

### 3.2 확정안 — **B (경로별 오버라이드)**

- 근거: GA4 / Vercel Analytics 는 Phase H 에서 본격 도입 예정. 전역 약화 비용이 큼. 결제 경로는 트랜잭션 완료 사후 추적이라 referer 손실 허용.
- **확정 D4**: `same-origin` — 내부 탐색 분석은 유지하면서 외부로는 누출 0.
- **확정 D5**: 서버 리디렉션 세탁 (`/g/{token}`) 은 §7 Deferred.

### 3.3 구현 계획

- `next/src/middleware.ts` (proxy.ts 확장) — 경로 매칭 시 `Referrer-Policy: same-origin` 오버라이드.
  - 매칭: `/order-complete`, `/orders/lookup`, `/checkout`, `/api/payments/*`, `/api/orders/guest-lookup`.
- 페이지 레벨 보강: `app/order-complete/layout.tsx` 에 `<meta name="referrer" content="same-origin" />` — 헤더 실패 시 HTML 2중 방어.
- 테스트:
  - e2e: `/order-complete` 응답 헤더 assertion.
  - unit: middleware 매처 함수.

---

## §4. 위협 #3 — order_number Enumeration

### 4.1 시나리오
- **Competitive intelligence** — 경쟁사가 매일 한 번 게스트 주문 시도 후 `order_number` 증가량 관찰 → 일간 주문량 추정.
- **Guest lookup enumeration** — 피해자 이메일 유출 상태에서 PIN brute 표면 축소.
- 어드민/정산 CSV 공유 시 주문번호 규모 노출.

### 4.2 확정안 — **A (Public token 이중 식별자)**

- `orders.public_token uuid DEFAULT gen_random_uuid() UNIQUE`. 고객 대면 = token, 내부/어드민 = `order_number` 유지.
- 업계 표준 (Stripe `pi_xxx` / Toss `tviva_xxx`).
- **확정 D6**: UUID v4 (36자) — DB 네이티브, crypto-quality.
- **확정 D7**: production 에서 `?orderNumber=` 경로 **즉시 제거**. dev/staging 만 유지.
- **확정 D8**: 토큰 노출 범위 — URL/이메일 only. 응답 body 에는 token + orderNumber 병기 가능.

### 4.3 구현 계획

- `supabase/migrations/018_orders_public_token.sql` (신설):
  ```sql
  alter table public.orders add column public_token uuid not null default gen_random_uuid();
  create unique index orders_public_token_idx on public.orders(public_token);
  ```
- `next/src/lib/services/orderService.ts` — lookup 오버로드 (`public_token` or `order_number`).
- `app/order-complete/page.tsx` — `?token=...` 수신. `?orderNumber=...` 는 `NODE_ENV === 'production'` 에서 404.
- `app/api/orders/guest-lookup/route.ts` — `public_token + email + pin` 삼중.
- 이메일 템플릿 (Session 11) — `/order-complete?token={public_token}` 링크.
- 테스트:
  - migration: `public_token` 생성·unique.
  - route: production 에서 orderNumber 404, token 정상.

### 4.4 롤아웃 2단계 분리
- **4a**: migration + public_token backfill + 이메일 링크 token (기존 `?orderNumber=` 병행).
- **4b**: production 에서 `?orderNumber=` 경로 차단.

---

## §5. 위협 #4 — PCI 로그 보존

### 5.1 현재 상태
- `paymentService.ts:326` — `console.warn` 에 `paymentKey` 전체 출력. Toss `paymentKey` 는 재조회/환불 인증 토큰 → §10.4.1 "민감 인증 데이터" 근접.
- `confirm/route.ts:98` · `webhook/route.ts:103,147` — err 스택 전체 노출 가능.
- `payments.raw_response` — `maskTossPayload` 로 마스킹 완료 (긍정).

### 5.2 확정안 — **A + C 병행**

- A: `lib/logging/paymentLogger.ts` 신설 + 전면 치환.
- C: ESLint custom rule 회귀 방지.
- **확정 D9**: paymentKey 마스킹 포맷 — `tviva_XX****XX#a3f1b` (해시 prefix 5자 추가, 상관관계 추적).
- **확정 D10**: 프로덕션 로그는 `err.message` only. stack 은 Sentry 연동 전까지 `NODE_ENV !== 'production'` 에서만.
- **확정 D11**: `logPaymentEvent` — **allowlist** 방식. Supabase service_role 키/URL 우발 노출 방지.
- 보존 정책 (Vercel 로그 설정) 은 `docs/ops/log-retention.md` (§7 Deferred) 로 분리.

### 5.3 구현 계획

- `next/src/lib/logging/paymentLogger.ts` (신설):
  ```typescript
  // paymentKey → `tviva_XXXXXX****XXXX#a3f1b` (앞 6 + 뒤 4 + sha256 prefix 5자)
  export function maskPaymentKey(key: string): string;

  // allowlist 기반 구조화 로거
  export function logPaymentEvent(
    level: 'info' | 'warn' | 'error',
    event: string,
    ctx: PaymentLogContext,  // allowlist 타입
  ): void;
  ```
- 치환 대상:
  - `paymentService.ts:326` — `console.warn` → `logPaymentEvent('warn', 'approved_at_fallback', { ... })`.
  - `confirm/route.ts:98` · `webhook/route.ts:103,147` — err 로깅 시 `err.message` only, stack 은 dev/staging.
- ESLint 규칙 **(Deferred — config-protection 훅 차단)**:
  - 원안: `no-restricted-syntax` — `console.*` 호출 중 `paymentKey|customerEmail|customerMobilePhone` literal 포함 시 error.
  - 현재 상태: `next/eslint.config.mjs` PreToolUse config-protection 훅이 설정 파일 수정을 차단. 회귀 방지는 런타임 allowlist 타입(`PaymentLogContext`) + 코드 리뷰로 임시 대체.
  - 추후 조치: 훅 일시 해제 권한 확보 시 PCI_LOG_GUARD 규칙 추가 (별도 PR).
- 테스트:
  - unit: `maskPaymentKey` 포맷 검증.
  - lint: eslint rule 실패 케이스.

---

## §6. 영향도 · 롤아웃

### 6.1 사용자 영향

| 대책 | 정상 사용자 | 게스트 결제 | 관리자 |
|---|---|---|---|
| #1 Carding RL | 5회 미만 실패 시 영향 0 | 동일 | 관리 화면 영향 없음 |
| #2 Referrer-Policy | 결제 페이지 referer 신호 소실 | 동일 | 내부 탐색은 same-origin 유지 |
| #3 order_number | 이메일 링크 구조 변경, 북마크 호환 유지 | 동일 | 어드민은 order_number 그대로 |
| #4 PCI 로그 | 무영향 | 무영향 | 디버깅 시 dev/staging 에서만 paymentKey 전체 노출 |

### 6.2 롤아웃 순서

1. **#4 PCI 로그** — 위험 0, 즉시 적용. ESLint rule 이 회귀 방지.
2. **#1 Carding RL** — `CARDING_LIMIT_ENABLED` dry-run 24h → 실활성화.
3. **#2 Referrer-Policy** — 단일 배포.
4. **#3 order_number**
   - 4a: migration + backfill + 이메일 링크 token (병행).
   - 4b: production `?orderNumber=` 차단.

### 6.3 롤백 기준

- #1: 429 비율 > 0.5% / 결제 성공률 전일 대비 -2%p → `CARDING_LIMIT_ENABLED=false`.
- #2: GA 이벤트 누락률 급증 → 매처 narrow.
- #3: 이메일 링크 404 리포트 → backfill 재실행.
- #4: 디버깅 불가 리포트 → staging `LOG_UNMASK=true`.

---

## §7. Deferred (본 스펙 범위 외)

| 항목 | 이유 | 재개 트리거 |
|---|---|---|
| 3DS 강제 정책 | Toss 위젯 옵션 레벨 | Phase 3 정기결제 도입 시 |
| webauthn 어드민 인증 | 어드민 UI 자체가 Phase H | 어드민 직접 구현 시점 |
| Vercel 로그 drain → Datadog/Sentry | 인프라 결정 선행 필요 | Phase H 관측성 |
| `orderNumber` → path segment 이관 | #3 public_token 으로 커버 | SEO 영향 검토 후 |
| 이메일 링크 서버 리디렉션 세탁 (`/g/{token}`) | #3 public_token 으로 필요성 감소 | 이메일 클라이언트별 referrer 실측 후 |
| email_outbox + pg_cron 재시도 | Phase H 인프라 과제 | Phase H 착수 |
| 로그 보존 운영 문서 (`docs/ops/log-retention.md`) | 인프라/법무 협의 선행 | Phase H 또는 법무 리뷰 시 |

---

## §8. 테스트 전략 요약

| 레이어 | 대상 | 도구 |
|---|---|---|
| unit | `maskPaymentKey`, preset 한도, ESLint rule | vitest |
| integration | carding 시나리오, `public_token` 라우트, referrer 헤더 | vitest |
| e2e | `/order-complete` 헤더 assertion | Playwright |
| security | 수동 체크리스트 — curl 로 `Referrer-Policy` · 429 응답 · paymentKey 로그 grep | CI grep step |

목표 커버리지: 신규 유틸 95%+, 회귀 그린 유지 (232/232 → 목표 250+).

---

## §9. 참고 자료

- PCI DSS v4.0 — §3.3, §3.4, §6.4, §10.4, §10.7.
- OWASP Top 10 (2021) — A01·A04·A05·A07·A09.
- OWASP ASVS v4.0.3 — §1.8, §4.2, §7.1, §8.2, §8.3, §13.2, §14.4.
- Toss Payments 개발자 문서 — "결제 확인" · "웹훅" · 에러 코드 레퍼런스.
- Vercel Logs — https://vercel.com/docs/observability/runtime-logs.
- Upstash Ratelimit — `@upstash/ratelimit` sliding window.

---

## §10. 변경 이력

- **v0.1 (2026-04-17, draft)** — 플래너 에이전트 초안 작성.
- **v1.0 (2026-04-17, confirmed)** — D1~D11 전부 권장안 확정. 구현 착수.
