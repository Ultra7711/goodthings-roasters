# Email Infrastructure (Resend 공통 레이어)

> **버전:** v1.0 (2026-04-17 Session 7)
> **상태:** 스펙 확정 (구현 대기)
> **의존성:** Session 11 (P2-D Resend 전면) 에서 이 레이어 기반으로 템플릿 구축

---

## 1. 목적과 범위

### 1.1 목적
Resend v4 Node SDK 기반 트랜잭셔널 메일 공통 레이어 구축. Session 11 (P2-D) 에서 주문확정 / 입금대기 / 발송알림 템플릿이 이 레이어 위에서 동작하도록 인프라만 선행 구축.

### 1.2 Session 7 범위
- ✅ `next/src/lib/email/` 디렉터리 7개 파일 (client · sendEmail · rateLimit · errors · types · config · index)
- ✅ Stub mode 지원 (API 키 없이 로컬·CI 동작)
- ✅ 토큰버킷 rate limiter (5 req/s)
- ✅ Idempotency-Key SDK 공식 필드
- ✅ PII 마스킹 로깅
- ✅ 테스트 15 케이스
- ✅ `.env.example` 갱신

### 1.3 Session 7 범위 **외**
- ❌ React Email 템플릿 (`<WelcomeEmail/>` 등) — Session 11
- ❌ 주문/결제 훅 통합 (confirmOrder → OrderConfirmationEmail) — Session 11
- ❌ DNS SPF/DKIM/DMARC 검증 — Session 11 DoD
- ❌ `email_outbox` 테이블 + pg_cron 재시도 — Phase H (인프라 단계)

---

## 2. Context7 재검증 결과 (2026-04-17)

> **Open Q-0 해소:** 플래너는 Context7 접근 불가로 보류했으나, 메인 에이전트가 직접 재조회 완료.

### 2.1 변경 3건

| 항목 | 기존 가정 | Context7 확인 결과 | 스펙 반영 |
|---|---|---|---|
| **Rate limit** | 2 req/s | **팀당 기본 5 req/s** (Pro 플랜 상향 가능) | `RESEND_RPS=5` default |
| **Idempotency-Key** | `headers['Idempotency-Key']` 수동 주입 | **SDK 공식 필드** `idempotencyKey` (payload 레벨 또는 2nd arg option) | `EmailPayload.idempotencyKey` 정식 필드 |
| **React 컴포넌트** | HTML 수동 렌더 | **`react: <Component/>`** 옵션으로 자동 렌더 (SDK 내부에서 `@react-email/render` 호출) | Session 11 에서 활용 |

### 2.2 유지 4건
- `from`/`to`/`subject`/`html`/`text` 기본 필드 시그니처
- 429 에러 타입 (`rate_limit_exceeded`)
- 발송 실패 시 `{ data: null, error: {...} }` 반환 형태
- `resend@^4` 패키지명

### 2.3 증거 출처
- Resend Node SDK v4 공식 문서 (Context7 MCP `/resendlabs/resend-node` 조회, 2026-04-17)
- Idempotency-Key: `emails.send(payload, { idempotencyKey })` 2nd arg 또는 `payload.idempotencyKey`
- Rate limit: "Teams are limited to 5 req/s by default"

---

## 3. 디렉터리 구조

```
next/src/lib/email/
├── client.ts          # Resend SDK 싱글톤 (live) + stub 구현
├── sendEmail.ts       # 공용 sendEmail() — rate limit + 에러 매핑 + 로깅
├── rateLimit.ts       # 토큰버킷 (self-implemented, ~30 lines)
├── errors.ts          # EmailError 클래스 + Resend 에러 정규화
├── types.ts           # EmailPayload · EmailResult · EmailMode
├── config.ts          # env 파싱 + 런타임 가드
├── index.ts           # barrel export
└── templates/
    └── .gitkeep       # Session 11 에서 채움
```

### 3.1 파일당 책임

| 파일 | 책임 | 라인 목표 |
|---|---|---|
| `client.ts` | Resend 클라이언트 초기화 (live/stub 분기), 싱글톤 보장 | < 60 |
| `sendEmail.ts` | `sendEmail(payload)` 공용 진입점, rate limit 호출, 에러 매핑, PII 마스킹 로깅 | < 120 |
| `rateLimit.ts` | 토큰버킷 (`RESEND_RPS` capacity, 1초 refill), `await acquire()` | < 50 |
| `errors.ts` | `EmailError` (code · message · retryable) + `normalizeError(resendError)` | < 60 |
| `types.ts` | `EmailPayload`, `EmailResult`, `EmailMode`, `EmailErrorCode` | < 50 |
| `config.ts` | env 검증, 프로덕션 fail-fast, 기본값 주입 | < 70 |
| `index.ts` | 공개 API 재노출 (`sendEmail`, 타입) | < 20 |

---

## 4. 타입 시스템

### 4.1 `EmailPayload`

```ts
// next/src/lib/email/types.ts

/**
 * sendEmail() 공용 진입 페이로드.
 * SDK 공식 `idempotencyKey` 필드를 1급 인자로 노출한다.
 */
export type EmailPayload = {
  from?: string;              // 생략 시 RESEND_FROM_EMAIL 사용
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  /**
   * Resend SDK 공식 idempotency-key.
   * - 24시간 이내 동일 키 재요청 시 SDK 가 이전 응답을 반환한다.
   * - 주문번호 기반 조합(`order-confirm:{orderNumber}`) 권장.
   * - Session 11 templates 에서 활용.
   */
  idempotencyKey?: string;
  /**
   * Session 11 에서 `react: <OrderConfirmationEmail {...}/>` 형태로 전달.
   * v1.0 스펙에서는 옵션만 정의 (stub 에서 무시).
   */
  react?: unknown;
};

export type EmailResult =
  | { ok: true; id: string; mode: EmailMode }
  | { ok: false; error: EmailError; mode: EmailMode };

export type EmailMode = 'live' | 'stub';

export type EmailErrorCode =
  | 'rate_limit_exceeded'    // 429 - 토큰 고갈 또는 Resend 429
  | 'invalid_payload'        // 400 - to/from/subject 검증 실패
  | 'auth_failed'            // 401/403 - API 키 오류
  | 'provider_error'         // 5xx - Resend 측 장애
  | 'network_error'          // fetch 실패·타임아웃
  | 'not_configured'         // 프로덕션에서 API 키 누락 (fail-fast)
  | 'unknown';
```

### 4.2 `EmailError`

```ts
// next/src/lib/email/errors.ts

export class EmailError extends Error {
  constructor(
    public readonly code: EmailErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'EmailError';
  }
}

/** Resend SDK 에러 → EmailError 정규화. */
export function normalizeResendError(err: unknown): EmailError {
  // 구현: err.name === 'rate_limit_exceeded' → retryable=true
  //       err.statusCode === 401/403 → auth_failed, retryable=false
  //       err.statusCode >= 500 → provider_error, retryable=true
  //       기타 → unknown, retryable=false
}
```

---

## 5. 환경변수

### 5.1 목록

| 변수 | 필수 | 기본값 | 용도 |
|---|---|---|---|
| `RESEND_API_KEY` | prod `EMAIL_MODE=live` 일 때 필수 | 없음 | Resend API 키 |
| `RESEND_FROM_EMAIL` | prod `live` 일 때 필수 | `onboarding@resend.dev` (stub 전용) | 발신자 |
| `RESEND_REPLY_TO` | 선택 | 없음 | 기본 Reply-To |
| `EMAIL_MODE` | 선택 | `auto` | `live` / `stub` / `auto` |
| `RESEND_RPS` | 선택 | `5` | 토큰버킷 용량 (req/s) |
| `NODE_ENV` | 빌드 | `production` / `development` / `test` | `auto` 판정 근거 |

### 5.2 `EMAIL_MODE=auto` 판정 로직

```
if EMAIL_MODE is explicitly set → 그대로 사용
else if NODE_ENV === 'production' → live (API 키 필수, 없으면 fail-fast)
else if RESEND_API_KEY is present → live
else → stub
```

### 5.3 프로덕션 Fail-Fast 가드

```ts
// config.ts 내부
if (mode === 'stub' && process.env.NODE_ENV === 'production') {
  // security H-2 (2026-04-17): stub 모드를 운영에서 원천 차단. env 실수
  // override 로 주문 확인·발송 알림 메일이 침묵 실패하는 상황을 막는다.
  throw new Error(
    '[email] EMAIL_MODE=stub is not allowed in production. ' +
    'Remove the override or set EMAIL_MODE=live with a valid RESEND_API_KEY.',
  );
}
if (mode === 'live' && !process.env.RESEND_API_KEY) {
  throw new Error(
    '[email] RESEND_API_KEY is required in live mode. ' +
    'Set EMAIL_MODE=stub for local dev, or provide the API key.',
  );
}
```

- 앱 부트 시점에 `getEmailConfig()` 최초 호출에서 검증
- **stub + production 조합은 명시 override 여도 throw** (security H-2)
- 프로덕션 배포에서 API 키 누락 시 즉시 크래시 → 침묵 실패 방지
- 개발/CI 에서는 `EMAIL_MODE=stub` 자동 판정으로 회피

### 5.4 `.env.example` 갱신

```dotenv
# --- Email (Session 7 인프라) ---
# EMAIL_MODE: live | stub | auto (default: auto)
# auto: NODE_ENV=production → live, 그 외 RESEND_API_KEY 유무로 판정
EMAIL_MODE=auto

# Resend API 키 (live 모드 필수). 개발/CI 에서는 비워두면 stub 으로 자동 전환.
RESEND_API_KEY=

# 발신자. 프로덕션에서는 Session 11 DNS 검증 완료된 도메인 필수.
RESEND_FROM_EMAIL=noreply@goodthingsroasters.com

# Reply-To (선택). 비어있으면 생략.
RESEND_REPLY_TO=support@goodthingsroasters.com

# Rate limit (선택, 기본 5 req/s). Resend Pro 상향 시 조정.
RESEND_RPS=5
```

---

## 6. Stub Mode

### 6.1 동작

- `RESEND_API_KEY` 없이 전체 코드 경로 실행
- Resend SDK 호출 없음 → 네트워크 없음
- 콘솔에 마스킹된 페이로드 1줄 출력 (`[email:stub] ...`)
- `id` 는 `stub-{uuid}` 형태 반환
- 모든 반환값은 `{ ok: true, id: ..., mode: 'stub' }`
- **예외:** 페이로드 검증 실패(`to` 누락 등)는 stub 에서도 실패 반환 → 개발 중 실제 버그 감지

### 6.2 PII 마스킹

```
johndoe@example.com → j***@example.com      (공용 utils/maskEmail, tail 자리 제거)
a@example.com       → *@example.com          (local ≤ 1자)
010-1234-5678       → 010-****-5678
신용카드번호는 발송 페이로드에 포함되지 않음 (주문번호만 노출)
```

> **2026-04-17 Pass 1 (code-review H-2)** — 기존 `{head}***{tail}@domain` 규칙은
> `lib/utils/maskEmail.ts` 의 `{head}***@domain` 으로 일원화. tail 자리 노출은
> PII 재식별 신호가 될 수 있어 로그·DB 저장 양쪽에서 보수적으로 제거.

### 6.3 로깅 예시 (stub)

```
[email:stub] id=stub-a1b2c3d4 to=j***@example.com subjectLen=28 idempotencyKey="order-confirm…"
```

- **security H-1 (2026-04-17)**: `subject="..."` 원문 임베드 금지. 주문번호·
  상품명 등이 포함되므로 `subjectLen=<n>` 만 기록한다.
- **security M-1 (2026-04-17)**: `idempotencyKey` 는 12자 truncate + `JSON.stringify`
  로 이스케이프. 개행·따옴표가 들어와도 로그 라인이 깨지지 않는다.

### 6.4 로깅 예시 (live 성공)

```
[email:live] id=73a7f4... to=j***@example.com subjectLen=28 duration=142ms idempotencyKey="order-confirm…"
```

### 6.5 로깅 예시 (live 실패)

```
[email:live] FAIL code=rate_limit_exceeded retryable=true to=j***@example.com duration=89ms
```

- **security H-3 / code-review H-3 (2026-04-17)**: 실패 경로는 `console.error`.
  원본 `err.message` 는 EmailError.cause 에만 보존하고, 외부 응답에는
  `'network error'` 같은 고정 문자열로 고정해 공급자 내부 메시지 유출을 막는다.

---

## 7. Rate Limiter (토큰버킷)

### 7.1 알고리즘
- Capacity = `RESEND_RPS` (default 5)
- Refill rate = capacity per 1초
- `await acquire()` 토큰 1개 소모. 토큰 없으면 다음 refill 시각까지 대기.
- 자체 구현 (외부 라이브러리 없음). 약 30줄.

### 7.2 스코프
- **프로세스 내부 공유 싱글톤.** Vercel 서버리스에서는 인스턴스당 독립.
- 다인스턴스 동시 폭주 방어는 Session 11 에서 `email_outbox` + pg_cron 전역 큐로 보강 (Phase H 연계).
- 현 단계에서는 인스턴스당 5 req/s × 인스턴스 수 = 체감 상한.

### 7.3 구현 스케치

```ts
// next/src/lib/email/rateLimit.ts

export function createTokenBucket(capacity: number) {
  let tokens = capacity;
  let lastRefill = Date.now();

  return {
    async acquire(): Promise<void> {
      // refill 계산
      const now = Date.now();
      const elapsedSec = (now - lastRefill) / 1000;
      const refilled = Math.floor(elapsedSec * capacity);
      if (refilled > 0) {
        tokens = Math.min(capacity, tokens + refilled);
        lastRefill = now;
      }

      if (tokens > 0) {
        tokens -= 1;
        return;
      }

      // 다음 refill 시각까지 대기 (1초 = capacity 토큰)
      const waitMs = Math.ceil((1 / capacity) * 1000);
      await new Promise((r) => setTimeout(r, waitMs));
      return this.acquire();
    },
  };
}
```

- `sendEmail` 진입 시 항상 `await bucket.acquire()` 후 Resend 호출
- 429 가 Resend 에서 오면 `rate_limit_exceeded` 로 반환하되 **내부 재시도는 하지 않음** (Session 11 outbox 에서 처리)

---

## 8. `sendEmail()` 공용 API

### 8.1 시그니처

```ts
// next/src/lib/email/sendEmail.ts

export async function sendEmail(payload: EmailPayload): Promise<EmailResult>;
```

### 8.2 흐름

```
1. config 검증 (최초 호출 시 env 파싱 + fail-fast 가드)
2. 페이로드 검증 (to 필수, subject 필수, html/text/react 중 최소 1개)
3. from 기본값 주입 (payload.from ?? RESEND_FROM_EMAIL)
4. mode === 'stub' 분기
   - 로그 + { ok: true, id: `stub-${uuid}`, mode: 'stub' } 반환
5. mode === 'live'
   a. await bucket.acquire()
   b. client.emails.send(payload, { idempotencyKey })
      (idempotencyKey 는 payload 에 있으면 그 값, 없으면 undefined)
   c. 응답 파싱
      - { data: { id }, error: null } → { ok: true, id, mode: 'live' }
      - { data: null, error } → normalizeResendError → { ok: false, error, mode: 'live' }
   d. 예외 (네트워크 등) → EmailError('network_error', ..., retryable=true)
6. 로깅 (마스킹)
7. 반환
```

### 8.3 호출 측 계약

**성공 경로는 신경 쓰지 않음, 실패만 분기.**

```ts
const result = await sendEmail({
  to: user.email,
  subject: '주문이 확정되었습니다',
  html: rendered,
  idempotencyKey: `order-confirm:${orderNumber}`,
});

if (!result.ok) {
  // 결제 롤백 금지 (§10 참조). 로그만 남기고 진행.
  logger.warn('email send failed', {
    code: result.error.code,
    retryable: result.error.retryable,
    orderNumber,
  });
  // Phase H: email_outbox 에 retryable=true 인 것만 적재
}
```

---

## 9. 테스트 케이스 (18)

> **파일:** `next/src/lib/email/sendEmail.test.ts` (vitest + `vi.mock('resend', ...)`)

| # | 카테고리 | 케이스 | 기대 결과 |
|---|---|---|---|
| 1 | config | `NODE_ENV=production` + `RESEND_API_KEY` 없음 | fail-fast throw `not_configured` |
| 2 | config | `EMAIL_MODE=stub` + prod | **부트 throw** (security H-2 · 2026-04-17) |
| 3 | config | `EMAIL_MODE=auto` + dev + 키 있음 | live 모드 |
| 4 | config | `EMAIL_MODE=auto` + dev + 키 없음 | stub 모드 |
| 5 | stub | to 누락 | `{ ok: false, error.code: 'invalid_payload' }` |
| 6 | stub | 정상 페이로드 | `{ ok: true, id: /^stub-/, mode: 'stub' }` |
| 7 | stub | 콘솔 로그 마스킹 확인 | `j***@example.com` 포함, 원본 이메일 미포함 |
| 7-a | stub | security H-1 · subject 원문 없음 | `subjectLen=<n>` 만 기록 |
| 7-b | stub | security M-3 · idempotencyKey 형식 불일치 | `invalid_payload`, retryable=false |
| 7-c | stub | security M-1 · idempotencyKey truncate | `idempotencyKey="…"` JSON 스트링 |
| 8 | live | 정상 응답 | `{ ok: true, id, mode: 'live' }` |
| 9 | live | 429 응답 | `error.code='rate_limit_exceeded'`, retryable=true |
| 10 | live | 401 응답 | `error.code='auth_failed'`, retryable=false |
| 11 | live | 500 응답 | `error.code='provider_error'`, retryable=true |
| 12 | live | fetch throw | `error.code='network_error'`, retryable=true, `message='network error'` 고정 |
| 13 | live | `idempotencyKey` 전달 확인 | `client.emails.send` 2nd arg 에 `{ idempotencyKey }` |
| 14 | rate limit | 6건 연속 호출 (5 rps) | 6번째 호출이 >= 150ms 지연 |
| 15 | rate limit | Resend 429 오면 내부 재시도 없음 | `client.emails.send` 1회만 호출 |

---

## 10. 결제-메일 실패 커플링 정책 (확정: **결제 롤백 없음**)

### 10.1 결정

**결제 승인 성공 후 메일 발송 실패 시 결제는 롤백하지 않는다.**

### 10.2 근거 6가지

1. **결제가 Source of Truth.**
   - DB 트리거(`012_payments_state_machine.sql`)가 `paid → cancelled` 역방향 전이를 차단한다.
   - 정상 결제 완료 후 메일 실패를 이유로 주문 상태를 되돌리면 트리거에 막히고 중복 복잡도만 증가.

2. **Best-effort 전송 (산업 표준).**
   - Stripe / PayPal / Shopify 모두 결제 성공 응답을 먼저 커밋하고, 메일은 비동기 재시도 큐로 처리한다.
   - 결제 API 응답 시간에 외부 메일 SLA 를 묶는 것은 UX·가용성 모두 악화.

3. **이메일 실패 원인이 결제와 무관.**
   - DNS 미검증 / Resend 장애 / Rate limit / 스팸 필터 모두 결제 자체에는 문제 없음.
   - "결제 성공 + 메일 재시도" 로 충분.

4. **사용자 측 보상 경로 존재.**
   - `/orders` 마이페이지 + 게스트 `/orders/lookup` 조회에서 주문내역·영수증 확인 가능.
   - Session 11 에서 OrderCompletePage 에 "메일이 도착하지 않았나요?" 재발송 버튼 추가 옵션.

5. **실제 구현은 인라인 try/catch.**
   ```ts
   // confirmOrder 성공 후
   try {
     await sendEmail({ to, subject, html, idempotencyKey: `order-confirm:${order.order_number}` });
   } catch (err) {
     // 롤백 없음. 로깅만.
     logger.warn('order confirm email failed', { orderNumber, err });
   }
   ```

6. **실패 타입별 대응 매트릭스.**

   | 에러 코드 | retryable | Phase H outbox 적재 | 즉시 알림 |
   |---|---|---|---|
   | `rate_limit_exceeded` | true | O | 없음 |
   | `provider_error` (5xx) | true | O | 없음 |
   | `network_error` | true | O | 없음 |
   | `auth_failed` | false | X | 운영자 Sentry 알림 |
   | `invalid_payload` | false | X | 운영자 Sentry 알림 (코드 버그) |
   | `not_configured` | false | — | 부트 타임 fail-fast |

### 10.3 Session 11 연계 지점
- OrderCompletePage 에 "영수증 이메일이 오지 않았나요? 마이페이지에서 확인하세요" 링크 추가
- `email_outbox` 테이블은 Phase H (인프라) 에서 도입 — 본 Session 7 범위 아님

---

## 11. 의존성 추가

### 11.1 신규

```json
{
  "dependencies": {
    "resend": "^4.0.0"
  }
}
```

### 11.2 제외 (Session 11 로 이연)

- `@react-email/render` / `@react-email/components` — 템플릿 구축 시점에 추가
- React 컴포넌트 타입은 Session 11 에서 `EmailPayload.react` 에 실제 구현 주입

### 11.3 설치 명령

```bash
cd next && npm install resend@^4
```

---

## 12. Open Q 해소 기록

| # | 질문 | 결정 | 근거 |
|---|---|---|---|
| Q-0 | Context7 Resend v4 재검증 필요 | ✅ 해소 (§2) | `/resendlabs/resend-node` 조회 → 3건 업데이트 반영 |
| Q-1 | API 키 없을 때 무엇을 할 것인가 | Stub mode | 로컬·CI 동작 보장, prod 는 fail-fast |
| Q-2 | Rate limit 구현 방식 | 자체 토큰버킷 ~30줄 | p-limit/bottleneck 의존성 회피 |
| Q-3 | Rate limit 값 | **5 req/s** (기존 2 → Context7 재검증 후 변경) | Resend 팀당 기본값 |
| Q-4 | Idempotency-Key 주입 방식 | **SDK 공식 필드** (기존 headers 주입 → 변경) | `client.emails.send(payload, { idempotencyKey })` |
| Q-5 | React Email 템플릿 Session 7 포함 여부 | 제외 (Session 11) | 템플릿은 P2-D 본체. `react` 옵션만 타입에 노출 |
| Q-6 | email_outbox + pg_cron 재시도 | Phase H 로 이연 | Session 7 는 인프라 뼈대, 재시도 큐는 Session 11 이후 |
| Q-7 | 결제-메일 실패 결제 롤백 여부 | **롤백 안 함** | §10 6-point 근거 |
| Q-8 | 프로덕션 + API 키 누락 시 동작 | Fail-fast throw | 침묵 실패 방지 |
| Q-9 | DNS SPF/DKIM/DMARC 검증 | Session 11 DoD | 템플릿 실전 송출 직전에 수행 |

---

## 13. 변경 이력

- **v1.0 (2026-04-17)** — Session 7 스펙 확정. Context7 Resend v4 재검증 반영. 사용자 "Q시리즈 권장안 진행" 승인.
- **v1.1 (2026-04-17)** — Pass 1 리뷰 반영 (3총사 + database-reviewer 4-병렬).
  - security H-1: 로그 `subject="..."` 제거 → `subjectLen=<n>` (PII 경유 유출 차단)
  - security H-2: `EMAIL_MODE=stub` + `NODE_ENV=production` 조합 부트 throw
  - security H-3 / code-review H-3 / ts M-6: 실패 경로 `console.error`, `err.message` 유출 차단 → 고정 `'network error'` + cause 보존
  - security M-1: `idempotencyKey` 로그 JSON.stringify + 12자 truncate
  - security M-3: `idempotencyKey` 형식 검증 `/^[\w:._\-]{1,255}$/`
  - code-review H-1 / ts M-5 / security M-4: rate limiter 재귀 → while 루프 + `MAX_WAIT_MS=5000`
  - code-review H-2: `lib/utils/maskEmail.ts` 공용 유틸 단일화 (`{head}***@domain`), `payments/mask.ts` 통합
  - 테스트 15 → 18 (7-a/b/c 추가, [2] throw 로 변경).

---

## 14. 참조

- Resend Node SDK: https://resend.com/docs/send-with-nodejs
- `docs/settlement-report.md` — Session 7 B-5 RPC 쌍둥이 스펙
- `docs/payments-flow.md` §4.2–§4.4 — 결제 RPC (메일 훅은 Session 11 에서 연계)
- `supabase/migrations/012_payments_state_machine.sql` — 역방향 전이 차단 트리거 (§10 근거)
- `memory/project_backend_p2_session_plan.md` — 전체 세션 계획
- `memory/project_backend_p2b_session7_entry.md` — Session 7 진입 가이드
