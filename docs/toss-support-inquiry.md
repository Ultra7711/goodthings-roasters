# Toss Developer Center 고객센터 문의 템플릿

> **목적:** 프로덕션 배포 전 웹훅 발신 IP 범위 확보 및 서명 정책 확인
> **작성일:** 2026-04-16 (Backend P2-B Session 6 리뷰 Deferred security H-3)
> **관련 문서:**
> - `docs/adr/ADR-002-payment-webhook-verification.md`
> - `docs/payments-flow.md §6.3`
> - `next/src/app/api/payments/webhook/route.ts`

---

## 1. 문의 배경 (사내 공유용)

웹훅 엔드포인트(`/api/payments/webhook`)는 Toss 발신자만 허용하도록 다층 방어를 구축해야 한다.
현재 구현된 인증:

1. **카드 PAYMENT_STATUS_CHANGED** — Toss Payments API `GET /v1/payments/{paymentKey}` 권위 재조회로 교차검증.
2. **가상계좌 DEPOSIT_CALLBACK** — DB `payments.webhook_secret` 과 페이로드 `secret` 을 `timingSafeEqual` 비교.

추가 방어(**IP allowlist**) 를 배포 전 도입하려면 **Toss 공식 발신 IP CIDR 블록** 이 필요하다.
공개 문서(https://docs.tosspayments.com/guides/v2/webhooks)에는 "고정 IP 를 사용한다" 는 언급만 있고 **구체 CIDR 이 공개돼 있지 않다**. 따라서 고객센터 문의로 확보한다.

### 부가 확인 사항

| 항목 | 현재 확인된 바 | 확인 필요 이유 |
|---|---|---|
| HMAC 서명 헤더 | 존재하지 않음(Toss 웹훅은 본문에 `secret` 포함) | 혹시 최근 추가되었는지 재확인 — 있다면 `timingSafeEqual` 로 대체 가능 |
| 재시도 정책 | 2xx 가 아닐 시 exponential backoff 최대 7회(≈ 127초) | 타이밍 역전 503 `Retry-After: 30` 가 재시도 안에 들어오는지 확인 |
| 발신 User-Agent | 미공개 | WAF 룰 작성용 보조 식별자 |

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
[굳띵즈 / MID-XXXXXXX] 웹훅 발신 IP 범위 및 서명 정책 문의 (프로덕션 배포 전 보안 설정 목적)

**본문:**

안녕하세요. [굳띵즈] 가맹점(MID: [MID-XXXXXXX]) 의 [담당자 이름] 입니다.

현재 신규 커머스 서비스의 결제 연동을 진행 중이며, 프로덕션 배포 전 웹훅 엔드포인트의 보안 구성을 마무리하고자 아래 3가지 사항을 문의드립니다.

---

### 문의 1. 웹훅 발신 IP 주소 범위 (CIDR 블록)

저희는 다음 두 종류의 Toss 웹훅을 수신하고 있습니다:

1. `PAYMENT_STATUS_CHANGED` (카드 결제 상태 변경)
2. `DEPOSIT_CALLBACK` (가상계좌 입금 통보)

배포 환경(Vercel + AWS WAF)에서 **Toss 발신자 이외의 모든 요청을 차단하는 IP allowlist 룰** 을 구성하려 합니다.

공식 문서(https://docs.tosspayments.com/guides/v2/webhooks)에 "고정 IP 를 사용한다" 는 언급은 있으나, 실제 발신 IP CIDR 블록이 명시돼 있지 않아 아래를 요청드립니다:

- **[질문 1-1]** 현재 운영 중인 웹훅 발신 IP 범위의 **전체 CIDR 목록** 을 알려주실 수 있을까요?
  (예: `52.78.xxx.xxx/24`, `13.124.xxx.xxx/25` 형식)
- **[질문 1-2]** 테스트/샌드박스 환경과 실결제 환경의 IP 범위가 **다른지** 여부를 함께 알려주세요.
- **[질문 1-3]** IP 범위가 **변경될 경우 사전 공지 채널**(이메일 공지, 변경 로그 페이지 등) 이 있는지 알려주세요.
  → 저희 쪽에서 allowlist 자동 갱신 여부 판단에 필요합니다.

---

### 문의 2. 웹훅 HMAC 서명 헤더 지원 여부

현재 구현은 아래와 같이 인증하고 있습니다:

| 이벤트 | 현재 인증 방식 |
|---|---|
| `PAYMENT_STATUS_CHANGED` (카드) | Toss `GET /v1/payments/{paymentKey}` 권위 재조회로 페이로드의 `status` / `totalAmount` / `orderId` 교차검증 |
| `DEPOSIT_CALLBACK` (가상계좌) | 발급 시 저장한 `virtualAccount.secret` 과 수신 페이로드의 `secret` 을 서버 DB 와 `timingSafeEqual` 비교 |

공식 문서 기준 **카드 웹훅(`PAYMENT_STATUS_CHANGED`) 에는 별도 서명 헤더가 없다** 고 이해하고 있습니다.

- **[질문 2-1]** 위 이해가 **현재도 정확한지** 확인 부탁드립니다.
- **[질문 2-2]** 혹시 최근 또는 곧 도입 예정인 **HMAC/JWT 서명 헤더**(예: `X-Toss-Signature`, `X-Tosspayments-Signature` 등)가 있다면 스펙(해시 알고리즘, 서명 대상 바디 형식, 키 수령 경로)을 알려주세요.
- **[질문 2-3]** 가상계좌 `secret` 외에 발급 단계에서 내려오는 **다른 웹훅용 비밀값** 이 더 있는지 확인 부탁드립니다.

---

### 문의 3. 웹훅 재시도 정책 상세

현재 저희 설계에서는 다음 두 상황에 대해 **HTTP 503 + `Retry-After: 30`** 으로 응답하여 Toss 재시도를 유도합니다:

| 상황 | 설명 |
|---|---|
| 카드 타이밍 역전 | 가맹점의 `confirm` 처리보다 웹훅이 먼저 도착 → 아직 `payments` 행 없음 |
| 가상계좌 secret 부재 | 발급 레코드 아직 커밋 전 |

- **[질문 3-1]** 2xx 가 아닌 응답에 대한 **재시도 최대 횟수 / 최대 총 소요 시간** 의 공식 스펙을 알려주세요.
  (공개 문서에는 "exponential backoff" 만 안내되어 있어 구체 수치 확인이 필요합니다.)
- **[질문 3-2]** `Retry-After` 응답 헤더의 **값을 Toss 가 실제로 존중하는지**, 또는 독자 backoff 시간표를 따르는지 알려주세요.
- **[질문 3-3]** 503 이 지정된 재시도 총 횟수 안에 성공 2xx 로 수렴하지 못한 경우 **이벤트가 유실되는지**, 아니면 데드레터로 보관돼 수동 재전송 가능한지 확인 부탁드립니다.

---

### 문의 4. (보조) 발신자 식별 헤더

방화벽 룰의 보조 식별자로 사용하기 위한 문의입니다:

- **[질문 4-1]** 웹훅 요청의 **`User-Agent` 헤더 값**(예: `TossPayments-Webhook/1.0`) 을 공개해 주실 수 있을까요?
- **[질문 4-2]** `PAYMENT_STATUS_CHANGED` / `DEPOSIT_CALLBACK` 이외에 현재 또는 곧 발송 예정인 **다른 `eventType`** 이 있는지 전체 목록을 알려주세요.
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

프로덕션 배포 일정에 직접적으로 영향을 주는 사안이라 가능한 한 빠른 회신을 부탁드립니다.
기밀/NDA 가 필요한 정보는 별도 절차를 안내해 주시면 그에 따르겠습니다.

감사합니다.

[굳띵즈] [담당자 이름] 드림
사업자등록번호: [사업자번호]
회사: [회사명]
연락처: [연락처]

---

## 4. 회신 수령 후 처리 절차

1. **IP CIDR 수령 시:**
   - `next/src/app/api/payments/webhook/route.ts` 최상단에 IP 화이트리스트 체크 추가
     - Vercel 환경에서 `x-forwarded-for` 헤더의 client IP 를 추출하여 CIDR 매칭
     - 라이브러리: `ip-cidr` 또는 직접 구현 (`ipaddr.js`)
   - 또는 Vercel Firewall(Enterprise) / Cloudflare WAF 규칙으로 **인프라 레벨 차단**(권장)
   - `.env.production` 에 `TOSS_WEBHOOK_IP_CIDRS=52.78.x.x/24,13.124.x.x/25,...` 형태로 저장
   - ADR-002 업데이트 → `§4.2 IP allowlist` 섹션 신설

2. **HMAC 서명 헤더 신규 도입 확인 시:**
   - ADR-002 전면 개정 — 카드 웹훅 GET 재조회 **이전** 서명 검증으로 단축 가능
   - `webhookVerify.ts` 에 `verifyTossSignature(rawBody, signatureHeader, secret)` 추가
   - `route.ts` 에서 zod 파싱 전 서명 검증으로 분기 순서 변경

3. **재시도 정책 확정 시:**
   - `docs/payments-flow.md §5.3.1` 의 "exponential backoff (최대 7회 ≈ 127초)" 문장을 공식 수치로 교체
   - 503 의 `Retry-After: 30` 가 무시된다는 답변이면, 단순 503 + 빈 바디로 변경

4. **User-Agent 공개 시:**
   - Vercel Edge Middleware 또는 route.ts 서두에 `User-Agent` 정규식 추가 (IP allowlist 의 2차 방어)

---

## 5. 회신 대기 동안의 현 상태

- IP allowlist **미적용** — ADR-002 하이브리드 인증(GET 재조회 + `timingSafeEqual`)만으로 MVP 배포 진행
- `docs/payments-flow.md §6.3` 에 "**Deferred: Toss 공식 IP 수령 후 구현**" 로 명시
- 배포 후 관측 단계에서 웹훅 수신 IP 를 **로그로 수집**(Supabase `payment_events.raw_payload` 에 `x-forwarded-for` 포함) → 회신 CIDR 과 교차검증 가능

---

## 6. 체크리스트

- [ ] §3 템플릿을 복사해 개인정보([MID-XXXXXXX], [담당자 이름] 등) 치환
- [ ] Toss Developer Center 1:1 문의 또는 `support@tosspayments.com` 에 전송
- [ ] 회신 수령 시 본 문서 §4 절차대로 반영
- [ ] ADR-002 / payments-flow.md 업데이트
- [ ] 회신 내용(스크린샷·이메일) 을 `docs/archive/toss-support-2026-xx.md` 로 보관
