# Toss Developer Center 고객센터 문의 템플릿

> **목적:** 프로덕션 배포 전 웹훅 서명 정책 / 재시도 정책 / 발신자 식별 헤더 등 운영 필수 정보 확보
> **작성일:** 2026-04-16 (Backend P2-B Session 6 리뷰 Deferred)
> **재조정일:** 2026-04-17 (security H-3 기각 — `docs/security-research-2026-04-16.md`)
> **관련 문서:**
> - `docs/adr/ADR-002-payment-webhook-verification.md`
> - `docs/payments-flow.md §6.3`
> - `docs/security-research-2026-04-16.md §2.3`
> - `next/src/app/api/payments/webhook/route.ts`

---

## 0. 상태 공지 — IP allowlist 문의 제거됨 (2026-04-17)

최초 작성본은 "웹훅 발신 IP CIDR 을 수령해 IP allowlist 를 추가한다" (security H-3) 를 포함했으나, 2026-04-17 **리서치 기반 재조정으로 기각**했다. 기각 근거:

1. Toss 공식 문서는 웹훅 발신 IP CIDR 을 공개하지 않는다. 고객센터 사례에서도 회신 여부·정확성·변경 공지가 불투명.
2. 우리 ADR-002 의 하이브리드 인증 — ① 카드 웹훅 `GET /v1/payments/{paymentKey}` 권위 재조회 ② 가상계좌 `payments.webhook_secret` 과 페이로드 `secret` 의 `timingSafeEqual` 비교 — 가 **Stripe 의 서명 검증과 동등한 역할**을 수행하므로 IP allowlist 는 중복 방어.
3. OWASP Webhook Security Cheat Sheet 는 서명 검증을 1차 방어로, IP allowlist 를 "서명이 없을 때의 보완책" 으로 정의. 우리는 서명에 상응하는 권위 검증이 이미 있다.
4. Vercel/AWS 양쪽에서 IP allowlist 는 운영 부담(CIDR 변경 대응)만 가중시키고 실질 방어력 추가가 미미.

따라서 본 문서의 **문의 1 (IP CIDR)** 은 제거되었다. 나머지 문의 2/3/4 는 운영상 유용한 정보이므로 유지한다. 상세 근거: `docs/security-research-2026-04-16.md §2.3`.

---

## 1. 문의 배경 (사내 공유용)

웹훅 엔드포인트(`/api/payments/webhook`)의 인증 · 재시도 · 발신자 식별 이슈를 프로덕션 배포 전에 확정하기 위해 Toss 에 아래 3건을 문의한다.

- **서명 헤더:** 공식 문서상 카드 웹훅에 HMAC/JWT 서명 헤더가 없으나, 최근 추가되었는지 재확인. 추가되었다면 ADR-002 를 서명 검증 우선으로 개정한다.
- **재시도 정책:** 503 + `Retry-After: 30` 응답에 대한 실제 backoff 동작을 확인하고 타이밍 역전 구간(§5.3.1) 설계 수치를 공식화한다.
- **발신자 식별 헤더:** WAF · 감사 로깅 필터 설계용 `User-Agent` 값과 이벤트 타입 목록 확보.

현재 구축된 인증:

1. **카드 PAYMENT_STATUS_CHANGED** — Toss Payments API `GET /v1/payments/{paymentKey}` 권위 재조회로 교차검증.
2. **가상계좌 DEPOSIT_CALLBACK** — DB `payments.webhook_secret` 과 페이로드 `secret` 을 `timingSafeEqual` 비교.

---

## 2. 문의 경로

### 옵션 A — Toss Developer Center 고객센터 (권장)

1. https://developers.tosspayments.com 접속 → 우측 상단 **"고객센터"** 클릭
2. **"1:1 문의"** 선택 → 분류: **"기술/연동"** → 항목: **"웹훅(Webhook)"**
3. 아래 §3 템플릿을 그대로 붙여넣는다.

### 옵션 B — 이메일 직접 문의

- **수신:** `support@tosspayments.com` (기술 지원 채널)
- **참조(CC):** 내부 담당자
- **제목:** §3 템플릿의 제목 줄을 그대로 사용

### 옵션 C — 영업/계정 매니저(이미 배정된 경우)

상용 가맹점 대상 전담 CSM 이 배정돼 있다면 해당 메일로 직접 전달 — 회신이 가장 빠름.

---

## 3. 문의 본문 템플릿 (복사용)

> 아래 `[굳띵즈]` 는 실제 가맹점명, `[MID-XXXXXXX]` 는 Toss 가맹점 ID(MID),
> `[담당자 이름]`, `[담당자 이메일]`, `[회신 희망일]` 을 실제 값으로 치환하세요.

---

**제목:**
[굳띵즈 / MID-XXXXXXX] 웹훅 서명 정책·재시도 정책·발신자 식별 헤더 문의 (프로덕션 배포 전 운영 설정 목적)

**본문:**

안녕하세요. [굳띵즈] 가맹점(MID: [MID-XXXXXXX]) 의 [담당자 이름] 입니다.

현재 신규 커머스 서비스의 결제 연동을 진행 중이며, 프로덕션 배포 전 웹훅 엔드포인트의 운영 구성을 마무리하고자 아래 3가지 사항을 문의드립니다.

---

### 문의 1. 웹훅 HMAC 서명 헤더 지원 여부

현재 구현은 아래와 같이 인증하고 있습니다:

| 이벤트 | 현재 인증 방식 |
|---|---|
| `PAYMENT_STATUS_CHANGED` (카드) | Toss `GET /v1/payments/{paymentKey}` 권위 재조회로 페이로드의 `status` / `totalAmount` / `orderId` 교차검증 |
| `DEPOSIT_CALLBACK` (가상계좌) | 발급 시 저장한 `virtualAccount.secret` 과 수신 페이로드의 `secret` 을 서버 DB 와 `timingSafeEqual` 비교 |

공식 문서 기준 **카드 웹훅(`PAYMENT_STATUS_CHANGED`) 에는 별도 서명 헤더가 없다** 고 이해하고 있습니다.

- **[질문 1-1]** 위 이해가 **현재도 정확한지** 확인 부탁드립니다.
- **[질문 1-2]** 혹시 최근 또는 곧 도입 예정인 **HMAC/JWT 서명 헤더**(예: `X-Toss-Signature`, `X-Tosspayments-Signature` 등)가 있다면 스펙(해시 알고리즘, 서명 대상 바디 형식, 키 수령 경로)을 알려주세요.
- **[질문 1-3]** 가상계좌 `secret` 외에 발급 단계에서 내려오는 **다른 웹훅용 비밀값** 이 더 있는지 확인 부탁드립니다.

---

### 문의 2. 웹훅 재시도 정책 상세

현재 저희 설계에서는 다음 두 상황에 대해 **HTTP 503 + `Retry-After: 30`** 으로 응답하여 Toss 재시도를 유도합니다:

| 상황 | 설명 |
|---|---|
| 카드 타이밍 역전 | 가맹점의 `confirm` 처리보다 웹훅이 먼저 도착 → 아직 `payments` 행 없음 |
| 가상계좌 secret 부재 | 발급 레코드 아직 커밋 전 |

- **[질문 2-1]** 2xx 가 아닌 응답에 대한 **재시도 최대 횟수 / 최대 총 소요 시간** 의 공식 스펙을 알려주세요.
  (공개 문서에는 "exponential backoff" 만 안내되어 있어 구체 수치 확인이 필요합니다.)
- **[질문 2-2]** `Retry-After` 응답 헤더의 **값을 Toss 가 실제로 존중하는지**, 또는 독자 backoff 시간표를 따르는지 알려주세요.
- **[질문 2-3]** 503 이 지정된 재시도 총 횟수 안에 성공 2xx 로 수렴하지 못한 경우 **이벤트가 유실되는지**, 아니면 데드레터로 보관돼 수동 재전송 가능한지 확인 부탁드립니다.

---

### 문의 3. (보조) 발신자 식별 헤더 및 이벤트 타입 목록

감사 로깅 필터·샘플링 룰의 보조 식별자로 사용하기 위한 문의입니다.

- **[질문 3-1]** 웹훅 요청의 **`User-Agent` 헤더 값**(예: `TossPayments-Webhook/1.0`) 을 공개해 주실 수 있을까요?
- **[질문 3-2]** `PAYMENT_STATUS_CHANGED` / `DEPOSIT_CALLBACK` 이외에 현재 또는 곧 발송 예정인 **다른 `eventType`** 이 있는지 전체 목록을 알려주세요.
  → 저희 쪽에서 `UnknownWebhookSchema` 폴백으로 감사 로그만 남기고 있어, 누락 방지용 사전 확인입니다.

---

### 저희 쪽 기술 환경 요약(회신 시 참고용)

- **런타임:** Next.js 15 App Router (Vercel 배포) — Node.js runtime
- **DB:** Supabase (PostgreSQL 15)
- **수신 엔드포인트:** `POST /api/payments/webhook`
- **연동 SDK 버전:** `@tosspayments/tosspayments-sdk` v2 (또는 `@tosspayments/payment-widget-sdk` 사용 버전)
- **결제 수단:** 카드(일반/간편결제 전체) · 가상계좌
- **예상 일 트랜잭션:** MVP 기준 소규모 (Q3 이내 본격 성장 예정)

**회신 희망 경로:** [담당자 이메일]
**회신 희망일:** [회신 희망일]

프로덕션 배포 일정에 영향을 주는 사안이라 가능한 한 빠른 회신을 부탁드립니다.
기밀/NDA 가 필요한 정보는 별도 절차를 안내해 주시면 그에 따르겠습니다.

감사합니다.

[굳띵즈] [담당자 이름] 드림
사업자등록번호: [사업자번호]
회사: [회사명]
연락처: [연락처]

---

## 4. 회신 수령 후 처리 절차

1. **HMAC 서명 헤더 신규 도입 확인 시:**
   - ADR-002 전면 개정 — 카드 웹훅 GET 재조회 **이전** 서명 검증으로 단축 가능
   - `webhookVerify.ts` 에 `verifyTossSignature(rawBody, signatureHeader, secret)` 추가
   - `route.ts` 에서 zod 파싱 전 서명 검증으로 분기 순서 변경

2. **재시도 정책 확정 시:**
   - `docs/payments-flow.md §5.3.1` 의 "exponential backoff (최대 7회 ≈ 127초)" 문장을 공식 수치로 교체
   - 503 의 `Retry-After: 30` 가 무시된다는 답변이면, 단순 503 + 빈 바디로 변경

3. **User-Agent · 이벤트 타입 공개 시:**
   - 감사 로깅 필터에 User-Agent 정규식 체크 추가 (보조 식별자로만 활용 — 단독 신뢰 금지)
   - 신규 eventType 이 있으면 `webhookSchema.ts` 에 zod 스키마 추가하고 `UnknownWebhookSchema` 폴백 로그로 모니터링

---

## 5. 회신 대기 동안의 현 상태

- ADR-002 하이브리드 인증(GET 재조회 + `timingSafeEqual`) 으로 MVP 배포 진행 — 서명 검증과 동등한 수준의 방어력
- 배포 후 관측 단계에서 웹훅 수신 IP 를 **로그로만 수집**(Supabase `payment_events.raw_payload` 에 `x-forwarded-for` 포함) → 사후 이상 패턴 탐지 보조
- IP allowlist 는 도입하지 않음 (§0 참조)

---

## 6. 체크리스트

- [ ] §3 템플릿을 복사해 개인정보([MID-XXXXXXX], [담당자 이름] 등) 치환
- [ ] Toss Developer Center 1:1 문의 또는 `support@tosspayments.com` 에 전송
- [ ] 회신 수령 시 본 문서 §4 절차대로 반영
- [ ] ADR-002 / payments-flow.md 업데이트
- [ ] 회신 내용(스크린샷·이메일) 을 `docs/archive/toss-support-2026-xx.md` 로 보관
