# Good Things Roasters — 백엔드 아키텍처 계획

> **버전**: v1.0 (2026-04-16)
> **상태**: 초안 (사용자 검토 대기)
> **관련 문서**: [oauth-security-plan.md](./oauth-security-plan.md) · [payments-flow.md](./payments-flow.md) · [adr/ADR-001-oauth-account-merge-policy.md](./adr/ADR-001-oauth-account-merge-policy.md) · [adr/ADR-002-payment-webhook-verification.md](./adr/ADR-002-payment-webhook-verification.md) · [milestone.md](./milestone.md)

---

## §1. 개요 · 원칙

### 1.1 목적

본 문서는 Good Things Roasters (이하 GTR) 의 백엔드 아키텍처를 설계·합의하는 단일 출처 문서다. DB 스키마 · 인증 · 결제 · 보안 · API · 운영 전략을 포괄한다.

### 1.2 범위

- **포함**: Supabase (DB·Auth·Storage), Next.js App Router API (Route Handler), 결제(TossPayments), 이메일(Resend), 보안 헤더·CSP, 암호화, Rate limiting, 마이그레이션 전략.
- **제외**: 프론트엔드 UI·디자인 토큰 (별도: `gtr-design-guide.md`), 어드민 구현 (Phase 3).

### 1.3 설계 원칙

1. **Defense in depth** — DB(RLS) + Server(인증검증) + Network(CSP) 3중 방어. 한 층이 뚫려도 다음 층에서 차단.
2. **Least privilege** — 클라이언트 `authenticated` 역할은 본인 행만 읽기·쓰기. 민감 작업은 `service_role`.
3. **Zero trust client** — 모든 클라이언트 입력은 서버에서 재검증(zod). JWT 도 `getClaims()` 로 서명 검증.
4. **Audit everything** — 결제·약관 동의·관리자 작업은 영구 감사 로그 (payment_transactions, agreed_at).
5. **Secure by default** — 기본값이 가장 안전하도록. 예: RLS 정책 미선언 = deny, CSP 미지정 = block.

### 1.4 결정 이력

- **ADR-001** (2026-04-14): OAuth 계정 병합 정책 — synthetic email + pending_link_with.
- **P0~P3** (2026-04-15~16): OAuth 보안 4단계 체계화 (`oauth-security-plan.md` §P0~§P3).
- **P2-2** (2026-04-16): DB 스키마 001~008 + 본 문서 통합 → 본 계획 승인 후 Supabase 실행.
- **ADR-002** (2026-04-16): TossPayments 웹훅 인증 모델 — 수단별 하이브리드 (카드 GET 재조회 / 가상계좌 per-payment secret). 본 문서 §6.1~§6.2 의 "HMAC-SHA256" 표기를 정정.

---

## §2. 기술 스택 · 버전 (2026-04-16 확정)

### 2.1 런타임

| 계층 | 기술 | 버전 | 근거 |
|---|---|---|---|
| 프레임워크 | Next.js | **16.2.3** (기설치) | CVE-2025-29927 / CVE-2025-66478 모두 패치된 안정 버전. `middleware.ts` → **`proxy.ts`** 개명에 주의. |
| UI | React | **19.2.4** (기설치) | Next 16 대응. CVE-2025-66478 후속 (19.2.1+) 반영. |
| Node 런타임 | Vercel Node.js | 20.x / 22.x | argon2 prebuilt·bcrypt native 호환. Edge runtime 은 암호화 라우트에서 사용 금지. |

### 2.2 Supabase 스택

| 패키지 | 버전 | 용도 |
|---|---|---|
| `@supabase/ssr` | **^0.10.2** | Server Component · Route Handler · proxy 공통 클라이언트. `auth-helpers-nextjs` 는 **완전 deprecated** → 사용 금지. |
| `@supabase/supabase-js` | **^2.103.2** | ssr 의 피어 디펜던시. 직접 import 는 `createBrowserClient`/`createServerClient` 외 최소화. |

**공식 문서**: https://supabase.com/docs/guides/auth/server-side/nextjs
**최근 보안 권고**: GHSA-v36f-qvww-8w8m (Apple/Azure OAuth, 2026-03) — `supabase/auth` 최신 인프라 유지로 대응(Supabase-side).

### 2.3 결제 · 이메일

| 패키지 | 버전 | 용도 |
|---|---|---|
| `@tosspayments/tosspayments-sdk` | **^2.5.0** | 결제위젯 v2 (payment-sdk v1·payment-widget-sdk 레거시 대체). Basic Auth `base64('{secretKey}:')` + Idempotency-Key. 웹훅 인증은 수단별 하이브리드 ([ADR-002](./adr/ADR-002-payment-webhook-verification.md)). |
| `resend` | **^4.0.0** | 트랜잭셔널 메일 (주문확인·배송안내). 2 req/s 전역 제한. |
| `@react-email/components` | **^0.0.32** | Resend 와 React 기반 메일 템플릿. |

### 2.4 검증 · 보안 유틸

| 패키지 | 버전 | 용도 |
|---|---|---|
| `zod` | **^4.3.6** | Route Handler 바디 검증. v4 stable (2025-05 릴리즈), 성능 v3 대비 6~14× 향상. CVE 없음. |
| `@node-rs/argon2` | **^2.x** | 게스트 PIN 해시 (argon2id). Vercel prebuilt binary, Turbopack 비호환(dev Webpack 분기). |
| `@upstash/ratelimit` | **^2.0.8** | Sliding window rate limit. |
| `@upstash/redis` | **^1.34.0** | Upstash Redis REST 클라이언트. Vercel Marketplace 통합으로 env 자동 주입. |

**deprecated 경고**:
- `@vercel/kv` — 2024-12 Upstash 로 이관 완료. 신규 프로젝트 사용 금지.
- `bcryptjs`/`bcrypt` — argon2id 로 대체. OWASP 2026 권고 반영.

### 2.5 기타

- **Storage**: Supabase Storage (상품 이미지 Phase 3, 현재 `/public/images/` 정적).
- **로깅·모니터링**: Supabase 내장 로그 + Vercel Analytics (MVP). Sentry 는 Phase 3.
- **마이그레이션**: Supabase CLI (`supabase/migrations/*.sql` + `supabase db push`).

---

## §3. 데이터 모델

### 3.1 테이블 목록 (`supabase/migrations/001~008`)

| # | 파일 | 테이블 / 함수 | 요약 |
|---|---|---|---|
| 001 | `001_profiles.sql` | `profiles` + `set_updated_at()` + `prevent_id_change()` + `prevent_profiles_email_change()` + `sync_profiles_email()` | 사용자 프로필. email 불변·자동 동기화, id 불변. |
| 002 | `002_addresses.sql` | `addresses` | 1:N 배송지. `is_default` 부분 유니크. |
| 003 | `003_orders.sql` | enums (`order_status`, `payment_method`) + `order_number_seq` + `set_order_number()` + `orders` | 주문 헤더. 회원·게스트 배타. `ON DELETE RESTRICT`. 약관 증빙(agreed_at, terms_version). 배송 추적 필드. |
| 004 | `004_order_items.sql` | enums (`order_item_type`, `subscription_period`) + `order_items` | 상품 스냅샷 + 할인 전·후 단가. |
| 005 | `005_subscriptions.sql` | `subscription_status` + `subscriptions` | 정기배송 계약. 자동 결제 집행은 Phase 3. |
| 006 | `006_payment_transactions.sql` | `payment_event_type` + `payment_transactions` | 결제 감사 로그 + 웹훅 멱등성(idempotency_key UNIQUE). |
| 007 | `007_rls_policies.sql` | 전 테이블 RLS | `(select auth.uid())` 래핑. `orders_insert_own` 에 `status='pending'` 강제. |
| 008 | `008_handle_new_user.sql` | `handle_new_user()` | auth.users INSERT 트리거. full_name XSS sanitize + email nullif 폴백. |

### 3.2 ER 관계도 (텍스트)

```
auth.users (Supabase 관리)
   │ 1:1 (id FK cascade)
   ├──► profiles
   │ 1:N (user_id FK cascade)
   ├──► addresses
   │ 1:N (user_id FK restrict) ◄── 탈퇴 시 주문·구독 남아있으면 차단
   ├──► orders
   │        │ 1:N (order_id FK cascade)
   │        ├──► order_items
   │        │ 1:N (order_id FK restrict) ◄── 결제 이력 영구 보존
   │        └──► payment_transactions
   └──► subscriptions (initial_order_id 참조, on delete set null)
```

### 3.3 핵심 제약 (리뷰 Pass 1 반영)

- **C1**: 모든 RLS 정책 `(select auth.uid())` 래핑 (성능·initPlan 캐시).
- **C2**: `orders_insert_own` WITH CHECK — `status='pending'` 만 INSERT 허용.
- **C3**: `orders.user_id ON DELETE RESTRICT` — 탈퇴 시 주문 있으면 차단. 탈퇴 실사용 플로우는 **§6.5 회원 탈퇴** 참조 (soft-delete + 30일 익명화).
- **C4**: `agreed_at timestamptz` + `terms_version text` (전자상거래법 제21조 증빙).
- **C5**: `total_amount = subtotal + shipping_fee - discount_amount` (쿠폰 대응).

### 3.4 저장 암호화 — Q1 권장안 반영

`pgcrypto` 로 선택적 컬럼 암호화. **대상 필드** (검색·정렬 불필요):
- `addresses.addr1`, `addresses.addr2`, `addresses.phone`
- `orders.shipping_addr1`, `orders.shipping_addr2`, `orders.shipping_phone`, `orders.contact_phone`, `orders.guest_email`

**제외 필드** (검색·라우팅·도메인 로직 필요): `profiles.email`, `profiles.full_name`, `addresses.name`, `addresses.zipcode`, `orders.order_number`.

**구현 방향** (별도 마이그레이션 009 로 Phase 2-F 진입 시 추가):
- `create extension if not exists pgcrypto;`
- 컬럼 타입을 `bytea` 로 변경, 키는 Supabase Vault 에 저장.
- `view` 생성: `create view public.addresses_decrypted as select id, user_id, name, pgp_sym_decrypt(addr1, vault_key()) as addr1, …`
- API 레이어는 view 경유. service_role 만 view 접근 가능.

**주의**: pgcrypto 는 Supabase 호스팅 PG 에 기본 탑재 — 별도 확장 설치만 하면 됨. Supabase Vault 는 2026-04 기준 GA. 사전 검증: 스테이징 환경에서 암·복호 지연 측정(목표: 단일 행 1ms 이내).

---

## §4. 인증 · 세션

### 4.1 3-Tier 분리 (기존 P1 완료)

| Tier | 역할 | 저장소 | 신뢰도 |
|---|---|---|---|
| UI hint | `isLoggedIn`, `displayName` | Zustand (localStorage persist) | **신뢰 금지** (위·변조 가능) |
| Session | JWT, Refresh token | `@supabase/ssr` 쿠키 (HttpOnly · Secure · SameSite=Lax) | 중간 (쿠키 스푸핑 대비 서버 재검증) |
| Authority | `auth.uid()`, RLS | Supabase Postgres | **유일 신뢰원** |

### 4.2 토큰 정책 — Q4 권장안

| 항목 | 값 | 근거 |
|---|---|---|
| JWT 만료 | **15분** | 리서치상 Supabase 기본 3600 / Dashboard → Authentication → JWT Settings 에서 `900` 초로 단축 |
| Refresh token | 60일 + rotation 기본 활성 | `@supabase/ssr` 가 자동 refresh (middleware/proxy) |
| 쿠키 플래그 | HttpOnly · Secure (prod) · SameSite=**Lax** | strict 금지 — OAuth 콜백 top-level cross-site navigation 시 쿠키 유실 |
| HTTPS 강제 | HSTS 2년 + preload | §5.1 참조 |
| 재인증 요구 | 비번 변경 · 결제 시작 시 최근 로그인 5분 이내 | 클라 로그인 시각 + 서버 재검증 |

### 4.3 서버 가드 패턴

**공식 권장**: `supabase.auth.getClaims()` (서명 검증). `getSession()` 은 서버에서 사용 금지 (쿠키 스푸핑 가능).

```ts
// app/mypage/page.tsx
import { createClient } from '@/lib/supabase/server'

export default async function MyPage() {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims) redirect('/login')
  // claims.sub === auth.uid()
}
```

### 4.4 OAuth Providers

- **Google** (PKCE, §6.4 리뷰 Pass 완료)
- **Kakao** (자체 Route Handler, P1 완료)
- **Naver** (자체 Route Handler, P1 완료)
- 신규 Provider 추가 시 `oauth-security-plan.md` §P1-3 체크리스트 준수.

---

## §5. 보안 계획

### 5.1 전송 보안 (HTTPS)

- Vercel 기본 HTTPS + 자동 인증서.
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` — 2년 HSTS, preload 리스트 등록.
- 개발 서버 (localhost) 는 예외 — `process.env.NODE_ENV` 분기.

### 5.2 저장 암호화 (pgcrypto)

§3.4 참조. Phase 2-F 진입 시 `009_encryption.sql` 신규 마이그레이션 추가.

### 5.3 CSP · 보안 헤더 — Q7 리서치 반영

**파일**: `next/src/proxy.ts` (신규, Next.js 16 규격).
**Nonce 기반 CSP** (unsafe-inline 회피):

```ts
// next/src/proxy.ts (요약)
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const isDev = process.env.NODE_ENV === 'development'

  const csp = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${isDev ? "'unsafe-eval'" : ''}
      https://js.tosspayments.com https://pay.toss.im;
    style-src 'self' 'nonce-${nonce}' ${isDev ? "'unsafe-inline'" : ''}
      https://fonts.googleapis.com https://t1.daumcdn.net;
    img-src 'self' blob: data: https://*.supabase.co https://*.tosspayments.com
      https://t1.daumcdn.net https://postfiles.pstatic.net;
    font-src 'self' https://fonts.gstatic.com data:;
    connect-src 'self' https://*.supabase.co wss://*.supabase.co
      https://api.tosspayments.com https://pay.toss.im https://api.resend.com
      https://dapi.kakao.com https://openapi.naver.com https://accounts.google.com;
    frame-src 'self' https://*.tosspayments.com https://pay.toss.im
      https://t1.daumcdn.net https://postcode.map.daum.net;
    worker-src 'self' blob:; object-src 'none'; base-uri 'self';
    form-action 'self' https://accounts.google.com https://nid.naver.com https://kauth.kakao.com;
    frame-ancestors 'none'; upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim()

  const res = NextResponse.next({ request: { headers: /* x-nonce 주입 */ } })
  res.headers.set('Content-Security-Policy', csp)
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=(), payment=(self)')
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups') // OAuth 팝업 필수
  res.headers.set('Cross-Origin-Resource-Policy', 'same-site')
  return res
}
```

**핵심 포인트**:
- COOP `same-origin-allow-popups` — Google/Kakao/Naver OAuth 팝업 `window.opener` 유지.
- `X-Frame-Options` 미설정 (CSP `frame-ancestors 'none'` 으로 대체, 중복 시 frame-ancestors 우선).
- Nonce 사용 페이지는 `export const dynamic = 'force-dynamic'` 또는 `await connection()` 명시 (PPR·ISR 비호환).

### 5.4 비밀 관리

**3-tier 계층**:

| 계층 | 파일/저장소 | 접근 |
|---|---|---|
| 로컬 개발 | `next/.env.local` (git ignore) | 개발자만 |
| 스키마 문서 | `next/.env.example` | 공개 |
| 프로덕션 | Vercel Environment Variables | 서버 런타임만 |

**키 목록** (2026-04 기준):

```
# 공개 (NEXT_PUBLIC_ 접두사, 클라이언트 번들 포함)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY  # = publishable key
NEXT_PUBLIC_TOSS_CLIENT_KEY

# 서버 전용 (절대 NEXT_PUBLIC_ 금지)
SUPABASE_SERVICE_ROLE_KEY      # service_role 권한 (RLS 우회)
TOSS_SECRET_KEY                # 결제 승인 API + 웹훅 GET 재조회 Basic Auth (ADR-002)
RESEND_API_KEY                 # 트랜잭셔널 메일
UPSTASH_REDIS_REST_URL         # rate limit (Vercel Marketplace 자동 주입)
UPSTASH_REDIS_REST_TOKEN
NAVER_CLIENT_ID / _SECRET
KAKAO_REST_API_KEY / _CLIENT_SECRET
GOOGLE_CLIENT_ID / _CLIENT_SECRET  # Supabase Auth 설정 경유, 직접 사용 X
OAUTH_COOKIE_SECRET            # state·nonce 쿠키 서명
TERMS_VERSION                  # orders.terms_version 기본값
```

**하드코딩 금지 체크**: `next/` 전역 grep 으로 `SUPABASE_URL|SECRET|API_KEY|TOKEN` 리터럴 문자열 CI 단계 검사 예정 (§10).

### 5.5 Rate Limiting — Q6 권장안 반영

**파일**: `next/src/lib/ratelimit.ts` (Phase 2-F 생성).

```ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

export const loginLimit = new Ratelimit({
  redis, limiter: Ratelimit.slidingWindow(10, '15 m'),
  prefix: 'rl:login', analytics: true,
})

export const guestPinLimit = new Ratelimit({
  redis, limiter: Ratelimit.slidingWindow(5, '10 m'),
  prefix: 'rl:guestpin', analytics: true,
})

export const signupLimit = new Ratelimit({
  redis, limiter: Ratelimit.slidingWindow(3, '1 h'),
  prefix: 'rl:signup', analytics: true,
})
```

적용 위치:
- `app/api/auth/login/route.ts` — IP 기준
- `app/api/orders/guest-lookup/route.ts` — `${ip}:${orderNo}` 복합 키
- `app/api/auth/signup/route.ts` — IP 기준
- Route Handler 외부 모듈 top-level 인스턴스 (hot cache 활용)

### 5.6 CVE 추적

- 월 1회 `npm audit` + GitHub Dependabot 자동 PR 검토.
- Supabase `supabase/auth` GHSA 피드 구독.
- Next.js RSS 공지 (https://nextjs.org/blog) 구독.

---

## §6. 비즈니스 무결성

### 6.1 결제 플로우

> ⚠️ **편차 공지 (2026-04-16)**: 본 섹션의 "HMAC-SHA256 서명" 표기는 **사실과 다르다**. Toss 공식 웹훅(`PAYMENT_STATUS_CHANGED` / `DEPOSIT_CALLBACK`) 은 HMAC 공유 시크릿 방식을 **지원하지 않는다**. 실제 채택 모델은 결제 수단별 하이브리드 — **카드 = GET 재조회**, **가상계좌 = per-payment secret** — 이며, 본 문서는 아래 두 문서로 정정·대체된다:
>
> - [ADR-002: TossPayments 웹훅 인증 모델 — 수단별 하이브리드](./adr/ADR-002-payment-webhook-verification.md)
> - [payments-flow.md — 결제 라이프사이클 단일 출처 문서](./payments-flow.md)
>
> 아래 §6.1 다이어그램·§6.2 멱등성 설명은 참고용 히스토리로 남겨두며, **구현 시에는 `payments-flow.md` §2~§4 를 우선**한다.

```
[클라이언트]                [서버 Route Handler]          [TossPayments]       [DB]
  1. 주문서 작성       →   POST /api/orders
                           - zod 검증
                           - orders INSERT (status=pending) ─────────────→  orders
  2. widgets.requestPayment({orderId, amount, successUrl, failUrl})
     ────────────────────────────────────────────────────→  결제창
  3. 결제 완료 리다이렉트 (?paymentKey&orderId&amount)
                       →   POST /api/payments/confirm
                           - DB orders.total_amount 교차 검증
                           - Idempotency-Key: confirm:{orderId}
                           - Basic Auth (TOSS_SECRET_KEY)
                                                    ───→  /v1/payments/confirm
                                                    ←───  승인 응답
                           - orders.status = 'paid'
                           - payment_transactions INSERT ───────────────→  payment_transactions
  4. 주문완료 페이지 이동
                       ←── Toss 비동기 웹훅 (수단별 검증 — ADR-002 참조)
                           POST /api/payments/webhook
                           - 카드: GET /v1/payments/{paymentKey} 재조회
                           - 가상계좌: top-level secret timing-safe 비교
                           - idempotency_key UNIQUE → 중복 skip
                           - payment_transactions INSERT
                           - 상태 동기화
```

### 6.2 웹훅 인증 · 멱등성

> **인증 모델은 [ADR-002](./adr/ADR-002-payment-webhook-verification.md) 로 이관.** 아래는 멱등성 요점만 유지.

- `payment_transactions.idempotency_key UNIQUE` 제약으로 중복 INSERT 는 23505 오류 → Route Handler 에서 catch 후 200 OK.
- Toss 는 2xx 응답을 받지 못하면 exponential backoff 로 **최대 7회** 재시도 (`payments-flow.md §1.4`).
- idempotency_key 합성 규칙: `webhook:{paymentKey}:{status}:{approvedAt|createdAt}` (Toss 가 고유 eventId 를 제공하지 않음).
- raw body 는 감사 로그용으로 `payment_transactions.raw_payload` 에 저장 (단, `secret` 필드는 `[REDACTED]` 치환).

### 6.3 주문 상태 머신

```
pending ──결제성공──► paid ──배송시작──► shipping ──도착──► delivered
   │                    │                                        │
   └─취소──► cancelled   └─환불요청──► refund_requested ──처리중──► refund_processing ──완료──► refunded
```

**RLS 규칙**:
- 클라이언트(authenticated): `status='pending'` 만 INSERT. 이후 상태 전이는 service_role.
- UPDATE/DELETE 전면 차단 (server-side service_role).

### 6.4 정기배송 (subscriptions)

- MVP: 계약 저장 + 마이페이지 조회·일시정지·해지만 지원.
- Phase 3: `next_delivery_at` 기반 pg_cron 배치 → 자동 결제 집행. TossPayments 빌링키 발급 연동.

### 6.5 회원 탈퇴 — Q2 권장안 (soft-delete + 30일 익명화)

1. 탈퇴 요청 시 `profiles.deleted_at = now()` 설정, 활성 구독·미완료 주문 고지.
2. 30일 유예 (개인정보보호법 대응) 동안 로그인 복구 가능.
3. 31일차 pg_cron 배치:
   - 주문 PII 마스킹 (`shipping_name → '*'`, `shipping_phone → '***'`).
   - `profiles.email = 'deleted_<uuid>@gtr.invalid'`, `full_name = NULL`, `phone = NULL`.
   - `addresses` DELETE (cascade).
   - `subscriptions.status = 'cancelled'`, `cancel_reason = 'account_deleted'`.
   - 마지막으로 `auth.users` DELETE (cascade 로 profiles 삭제).
4. 결제·감사 로그(`payment_transactions`)는 **5년 보존** (전자상거래법).

→ 별도 마이그레이션 `010_account_deletion.sql` Phase 2-F 생성.

---

## §7. API 설계

### 7.1 Route Handler 구조

```
next/src/app/api/
├── auth/
│   ├── login/route.ts          # POST — 이메일/비번 (Supabase)
│   ├── signup/route.ts         # POST — 이메일 가입
│   ├── logout/route.ts         # POST
│   ├── kakao/
│   │   ├── route.ts            # GET — 인가 URL 리다이렉트 (기존 P1)
│   │   └── callback/route.ts   # GET — 콜백 (기존 P1)
│   ├── naver/                  # (기존 P1)
│   └── callback/route.ts       # Google OAuth callback (기존 P1)
├── orders/
│   ├── route.ts                # POST — 주문 생성 (status=pending)
│   ├── [orderNumber]/route.ts  # GET — 본인 주문 조회
│   └── guest-lookup/route.ts   # POST — 게스트 PIN 검증 + 조회
├── payments/
│   ├── confirm/route.ts        # POST — 토스 결제 승인
│   └── webhook/route.ts        # POST — 토스 웹훅 (HMAC 검증)
├── subscriptions/
│   ├── route.ts                # GET (본인 목록) / POST (신규)
│   └── [id]/
│       ├── pause/route.ts
│       └── cancel/route.ts
└── addresses/
    └── route.ts                # GET/POST/PATCH/DELETE
```

### 7.2 레이어 분리

```
Route Handler (app/api/…/route.ts)
    ├── zod 검증
    ├── rate limit
    └── service 호출
Service (lib/services/…)
    ├── 비즈니스 로직
    └── repository 호출
Repository (lib/repositories/…)
    └── Supabase 클라이언트 + SQL
```

### 7.3 표준 검증 패턴 (zod 4)

```ts
// app/api/orders/route.ts
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const OrderCreateSchema = z.object({
  items: z.array(z.object({
    productSlug: z.string().min(1),
    quantity: z.number().int().positive(),
  })).min(1),
  shipping: z.object({
    name: z.string().min(1).max(80),
    phone: z.string().regex(/^\+?[0-9\-\s]{9,20}$/),
    zipcode: z.string().regex(/^[0-9]{5}$/),
    addr1: z.string().min(1).max(200),
    addr2: z.string().max(200).optional(),
  }),
  paymentMethod: z.enum(['card', 'transfer']),
  termsVersion: z.string(),
  // ...
})

export async function POST(req: Request) {
  const parsed = OrderCreateSchema.safeParse(await req.json())
  if (!parsed.success) {
    return Response.json(
      { error: 'validation_failed', fields: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }
  // ...
}
```

### 7.4 에러 응답 포맷

```ts
// 성공
{ "data": { ... } }

// 실패
{ "error": "validation_failed", "fields": { "email": ["invalid_format"] } }
{ "error": "unauthorized" }                 // 401
{ "error": "forbidden" }                    // 403
{ "error": "not_found" }                    // 404
{ "error": "rate_limited", "retryAfter": 60 } // 429
{ "error": "payment_failed", "detail": "..." }   // 402
{ "error": "server_error" }                 // 500 (상세는 Sentry)
```

---

## §8. 상태 관리

### 8.1 3계층 (기존 P1 확정)

| 계층 | 도구 | 용도 | 금기 |
|---|---|---|---|
| UI hint | Zustand + persist | `isLoggedIn`, `displayName` | PII·토큰·권한 저장 금지 |
| Session | `@supabase/ssr` 쿠키 | JWT, refresh | localStorage 절대 금지 |
| Authority | Postgres RLS | 권한 판정 | 클라 신뢰 금지 |

### 8.2 Server Component 우선

- 데이터 조회는 기본 Server Component (RSC) + `createServerClient`.
- Client Component 는 인터랙션·폼 상태만.
- 서버 액션(Server Actions) 은 폼 submit 에 우선 사용.

---

## §9. 성능 최적화

### 9.1 렌더링

- RSC 우선 → 클라 번들 최소화.
- `fetch(..., { next: { revalidate: N } })` 또는 `revalidateTag()` 로 캐시 제어.
- CSP nonce 사용 페이지는 `force-dynamic` (캐싱 불가).

### 9.2 DB

- **인덱스 설계** (001~008 마이그레이션에 포함):
  - `profiles_email_unique_idx` (UNIQUE)
  - `addresses_user_id_idx` + `addresses_one_default_per_user` (부분 UNIQUE)
  - `orders_user_id_idx` (부분), `orders_guest_email_idx` (부분)
  - `orders_status_created_at_idx` (복합 — 어드민 대시보드)
  - `order_items_order_id_idx`
  - `subscriptions_next_delivery_idx` (부분, status='active')
  - `payment_transactions_order_id_idx`

- **RLS 성능**: 모든 정책 `(select auth.uid())` 래핑 → initPlan 캐시 → 행별 재평가 방지.

- **쿼리**: Supabase 내장 lint `0003_auth_rls_initplan` 월 1회 점검.

### 9.3 번들

- argon2 는 `serverExternalPackages: ['@node-rs/argon2']` (next.config.mjs).
- 결제·메일 등 서버 전용 패키지는 `'server-only'` import 가드.

---

## §10. 테스트 전략

### 10.1 계층

| 테스트 | 도구 | 대상 |
|---|---|---|
| Unit | Vitest | 유틸 · 서비스 · 리포지토리 mock |
| Integration | Vitest + Supabase dev project | Route Handler + 실 DB (seed) |
| RLS | Vitest + 다중 role 클라이언트 | 정책 — 본인 조회 OK, 타인 차단 확인 |
| E2E | Playwright | 주문 → 결제 → 메일 수신 전체 플로우 (토스 테스트 키) |

### 10.2 RLS 테스트 예시

```ts
test('authenticated user cannot select other user addresses', async () => {
  const userA = await signIn('a@test')
  const userB = await signIn('b@test')
  await insertAddress(userA, { /* ... */ })
  const { data } = await userB.from('addresses').select()
  expect(data).toEqual([])
})
```

### 10.3 커버리지

- 전체 80% 이상 (common/testing.md 규칙 준수).
- 결제·인증·RLS 정책은 **100%** 목표.

### 10.4 보안 CI

- `npm audit --audit-level=high` — high 이상 실패 시 빌드 차단.
- 비밀 문자열 스캔: `gitleaks` pre-commit + CI.
- `supabase/migrations/*.sql` 변경 PR 에 `supabase db lint` 자동 실행.

---

## §11. 운영

### 11.1 마이그레이션

- **도구**: Supabase CLI (`npx supabase`).
- **초기 세팅**: `supabase init` → `supabase/config.toml` 커밋 → `supabase link --project-ref <prod-ref>`.
- **개발 플로우**:
  1. `supabase/migrations/NNN_feature.sql` 작성
  2. 로컬 Docker DB 에서 `supabase db reset` 검증
  3. PR 리뷰
  4. merge 시 GitHub Actions → `supabase db push` (staging 없음, MVP 는 직접 prod)
- **롤백 전략**: 순방향 전용(forward-only) 마이그레이션. 문제 발생 시 새 `NNN+1_fix.sql` 로 보정.

### 11.2 환경

| 환경 | Supabase 프로젝트 | Vercel 배포 | URL |
|---|---|---|---|
| dev | `gtr-dev` | `preview` | localhost:3333 / PR URL |
| prod | `gtr-prod` | `production` | goodthings.coffee (예정) |

dev ↔ prod 간 스키마는 동일 파일 세트. staging 은 트래픽 발생 시 추가.

### 11.3 로그 · 모니터링

- **Supabase**: Auth 로그 · DB 슬로우 쿼리 · Storage 로그 (대시보드 내장).
- **Vercel**: Analytics · Web Vitals · Function 로그.
- **Sentry (Phase 3)**: 서버·클라 에러 트래킹. 결제 실패·웹훅 오류 우선순위.
- **감사 로그**: `payment_transactions` (영구 보존).

### 11.4 백업

- Supabase 자동 일일 스냅샷 (프로 플랜 이상).
- 중요 마이그레이션 전 수동 백업 (`pg_dump` → S3).

### 11.5 모델 선택 가이드 (실험 단계)

백엔드 작업 유형별 권장 Claude 모델 매핑. **본 매핑은 P0 실행 경험을 통해 검증·보정 후 확정한다.**
현재는 **초안(hypothesis)** 이며, P0 완료 시점에 실사용 로그를 반영하여 재평가한다.

**전제 조건**

- pixel-port 에서 Phase 별 스위칭은 폐기했음 ([feedback_pixel_port_model_switching.md](../.claude/projects/C--Git-goodthings-roasters/memory/feedback_pixel_port_model_switching.md)). 단일 기준(픽셀 정합성) 작업에는 단일 모델이 유리.
- 백엔드는 작업 유형이 명확히 분리되므로 **카테고리 단위 매핑** 시도.

**Tier 정의**

| Tier | 모델 | 판단 기준 |
|---|---|---|
| **Architect** | Opus 4.6 | 되돌릴 수 없는 결정·보안 리뷰·복잡한 정합성 분석 |
| **Implement** | Sonnet 4.6 | 스펙이 확정된 구현·반복적 Route Handler·표준 마이그레이션 |
| **Execute** | Haiku 4.5 | 기계적 실행·환경설정·검증 쿼리·타입 생성 |

**초안 매핑 (P0~P2)**

| 작업 | Tier | 근거 |
|---|---|---|
| `supabase db push` + 검증 쿼리 | Execute | SQL 확정됨 — 실행 |
| 환경변수 주입·`supabase gen types` | Execute | 표준 CLI |
| gitleaks CI · npm audit CI 설정 | Execute | 템플릿 기반 |
| `@supabase/ssr` 설치 + 클라이언트 래퍼 | Implement | 문서에 코드 有 |
| `proxy.ts` Nonce CSP 구현 | Implement | 본 문서 §5.1 스니펫 기반 |
| Route Handler + zod 스키마 (반복 구현) | Implement | 패턴 반복 |
| Resend 템플릿 · React Email | Implement | 표준 구현 |
| RLS Integration 테스트 | Implement | Vitest 패턴 반복 |
| `getClaims()` 서버 가드 이행 | Implement | 기존 가드 교체 |
| pgcrypto 암호화 (`009_encryption.sql`) | Architect | 키 회전·성능·장애 시나리오 |
| TossPayments 웹훅 인증·멱등성 (ADR-002 이행) | Architect | 결제 정합성 결정 |
| 소프트삭제 배치 (`010_account_deletion.sql`) | Architect | 익명화 정책 결정 |
| 마이그레이션 003 스키마 개정 (예기치 못한 정책 변경) | Architect | 되돌리기 어려움 |
| 3-agent 병렬 리뷰 (database·architect·security) | Architect | 각 서브에이전트 Opus |

**운용 규칙**

1. **에스컬레이션** — 작업 중 복잡도 발견 시 Opus 로 승격. 사용자 확인 후 전환.
2. **다운그레이드 금지** — 한 세션 내 상위 → 하위는 컨텍스트 손실 비용이 커서 금지.
3. **핸드오프 최소화** — 구현 → 리뷰 → 수정 사이클은 핸드오프 비용 발생. 연속된 TDD 루프는 단일 모델 유지.
4. **병렬 에이전트 비용 고려** — 서브에이전트를 Opus 로 지정하는 건 reviewer 역할 한정.

**검증 지표 (P0 완료 시 수집)**

- 실제 사용한 모델 vs 초안 매핑 일치율
- 에스컬레이션 발생 빈도 + 원인
- 모델별 평균 소요 시간·수정 횟수
- 다운그레이드 금지 규칙 위반 케이스

검증 결과는 [project_backend_model_tier.md](../.claude/projects/C--Git-goodthings-roasters/memory/project_backend_model_tier.md) 메모리로 관리하며, 프로젝트 종료 시 범용 가이드로 문서화한다 (§12 P3 참고).

---

## §12. 체크리스트

### P0 — Launch Blocker (Supabase 실행 전)

- [ ] 본 문서 사용자 승인
- [ ] `supabase/migrations/001~008` 파일 검토 완료 (2026-04-16 완료)
- [ ] Supabase dev 프로젝트에 001~008 실행 + §검증 쿼리 통과
- [ ] 프로덕션 환경변수 키 목록 준비 (§5.4)

### P1 — 높음 (1주 내)

- [ ] `@supabase/ssr@^0.10.2` + `@supabase/supabase-js@^2.103.2` 설치
- [ ] `getClaims()` 기반 서버 가드 전면 전환 (기존 `getUser()` 교체)
- [ ] `proxy.ts` 생성 + Nonce CSP 적용
- [ ] `@node-rs/argon2` 설치 + `serverExternalPackages` 등록
- [ ] `@upstash/ratelimit` 설치 + 로그인·PIN·가입 3곳 적용
- [ ] `zod@^4.3.6` 설치 + Route Handler 검증 패턴 통일
- [ ] `TOSS_SECRET_KEY`, `RESEND_API_KEY` 등 env 세팅
- [ ] JWT 만료 → 900초 (15분) Dashboard 반영
- [ ] gitleaks CI + npm audit CI 설정

### P2 — 중간 (1개월 내)

- [ ] `009_encryption.sql` — pgcrypto 컬럼 암호화 (§3.4)
- [ ] `010_account_deletion.sql` — soft-delete + 익명화 배치 (§6.5)
- [ ] `@tosspayments/tosspayments-sdk@^2.5.0` 결제 위젯 통합
- [ ] 웹훅 수단별 하이브리드 검증 라우트 (ADR-002: 카드 GET 재조회 · 가상계좌 per-payment secret)
- [ ] React Email 템플릿 (주문확인·배송안내)
- [ ] RLS 정책 Integration 테스트 80% 커버
- [ ] Supabase CLI + GitHub Actions 마이그레이션 파이프라인

### P3 — 낮음 (Phase 3)

- [ ] Sentry 에러 트래킹
- [ ] 정기배송 자동 결제 집행 (pg_cron + 빌링키)
- [ ] 어드민 UI (상품·주문 관리)
- [ ] pgTAP DB 테스트
- [ ] staging 환경 추가
- [ ] 다국어 (English)

### 프로젝트 종료 시 — 재사용 가능한 산출물화

- [ ] §11.5 모델 선택 가이드 검증 결과 반영 후 **범용 가이드로 분리 문서화** (다른 프로젝트 재활용 목적)
- [ ] 백엔드 구축 전체 프로세스 회고 (Research → Plan → Schema → P0 → P1 → P2 각 단계의 시간·비용·재작업률)
- [ ] 재사용 가능한 산출물 추출 (Next.js + Supabase + TossPayments 조합의 skeleton 프로젝트)

---

## 부록 A — 참고 링크

- Supabase SSR: https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase RLS 성능: https://supabase.com/docs/guides/database/postgres/row-level-security
- Next.js CSP: https://nextjs.org/docs/app/guides/content-security-policy
- OWASP Password Storage: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- TossPayments SDK v2: https://docs.tosspayments.com/sdk/v2/js
- TossPayments 웹훅: https://docs.tosspayments.com/reference/using-api/webhook-events
- Resend Next.js: https://resend.com/docs/send-with-nextjs
- Upstash Ratelimit: https://upstash.com/docs/redis/sdks/ratelimit-ts/overview
- zod v4: https://zod.dev/v4

## 부록 B — CVE 추적

| CVE | 영향 | 상태 |
|---|---|---|
| CVE-2025-29927 | Next.js middleware auth bypass | Next 16.2.3 **패치 완료** |
| CVE-2025-66478 | React RSC flight protocol RCE | React 19.2.4 **패치 완료** |
| GHSA-v36f-qvww-8w8m | Supabase Apple/Azure OAuth | Supabase 인프라 측 대응 (사용 예정 없음) |
| CVE-2025-57754 | 써드파티 eslint-ban-moment env 유출 | 미설치, 해당 없음 |

---

**문서 끝.** 승인 후 P0 체크리스트부터 순차 실행 예정.
