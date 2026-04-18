# OAuth Security Plan (P-Series)

> **작성일:** 2026-04-16  
> **최종 업데이트:** 2026-04-16 (P0 전체 완료 — P0-1·P0-2·P0-3·P0-4)
> **상태:** P0 완료 ✅ / P1 착수 대기
> **범위:** `/api/auth/*` + `/auth/callback` + `/mypage` + `/checkout`
> **관련:** B-2 소셜 로그인 (Naver · Kakao · Google) 구현

---

## 30초 요약

**무엇을** — Supabase Auth + 소셜 로그인 3종(Google/Naver/Kakao)의 4대 보안 취약점을 5단계(P0~P3)로 해결. 3계층 분리 원칙: **Zustand = UI / Supabase = 세션 / 서버 + RLS = 보안 경계.**

**왜** — B-2 소셜 로그인 디버깅 중 CSRF state 미검증, localStorage 조작으로 `/mypage` 우회 가능, 더미 auth와 실 Supabase 혼재, magic link 리다이렉트 타이밍 문제가 동시에 발견됨. 하나라도 방치 시 프로덕션 보안 공백.

**어떻게** — (1) CSRF state 쿠키 + AuthSyncProvider를 P0로 즉시 차단 → (2) IdP 이메일 검증 + 서버 컴포넌트 가드로 보안 경계 확정 → (3) Zustand auth 제거 + RLS + 서버 토큰 소비로 아키텍처 정리 → (4) 관측성 확보.

**순서** — `P0-1 ✅ → P0-2 ✅ → P0-3 ✅ → P0-4 ✅ → (B-2 3종 정상화 완료) → P1-2 → P1-1(ADR 이행) → P2-1 → P2-2 → P3-1 → P3-2`. P2-3은 P0-3에 흡수·완료. PR은 3개로 분리 (P0+P1 묶음 / P2 묶음 / P3 묶음).

---

## 아키텍처 원칙

1. **Zustand `isLoggedIn`은 절대 보안 결정의 근거가 아니다.** UI 힌트(헤더 아바타 등)용이며, devtools로 조작 가능한 localStorage 값.
2. **보안 결정은 `supabase.auth.getUser()` (JWT 서명 검증) + Supabase RLS.** 쿠키 기반 세션이 유일한 truth source.
3. **클라이언트 가드는 UX 도구, 서버 가드는 보안 경계.** `useAuthGuard`는 "이미 인증된 상태에서 즉시 렌더" 역할, `/mypage/page.tsx`의 서버 컴포넌트가 진정한 보안.
4. **IdP 이메일을 맹신하지 않는다.** `email_verified !== true`면 internal email fallback, 동일 이메일 + 다른 provider 충돌 시 거부 (탈취 방지).

---

## 발견된 취약점

| ID | 취약점 | 심각도 | 영향 |
|----|--------|--------|------|
| V1 | CSRF state 미검증 (Naver/Kakao) | HIGH | 공격자가 피해자 브라우저로 공격자 계정 로그인 유도 가능 |
| V2 | Zustand localStorage 조작으로 `/mypage` 접근 | MEDIUM | 클라이언트 가드 우회 (단, 서버 데이터는 Supabase 세션 없이 불가 — 실질 피해는 UI 노출) |
| V3 | 더미 auth + 실 Supabase 혼재 | MEDIUM | 세션 관리 책임 불명확, OAuth 성공해도 /mypage 튕김 (B-2 블로커) |
| V4 | magic link `redirectTo=/mypage` | MEDIUM | Supabase verify 중간 URL이 브라우저 히스토리 노출, 세션 미확립 상태 깜빡임 |

---

## P0 — 블로킹 ✅ (전체 완료 2026-04-16)

### P0-1 · CSRF state 쿠키 구현 (Naver/Kakao) ✅

**목표** — OAuth 인증 시작 시 state를 HttpOnly 쿠키에 저장하고 콜백에서 timing-safe 대조하여 CSRF 공격을 차단한다.

**의존성** — 없음 (최우선 차단)
**예상 공수** — 낙관 2h · 기대 4h · 비관 6h

**수락 기준**
- [ ] `/api/auth/naver`·`/api/auth/kakao` 시작 라우트가 `Set-Cookie: gtr_oauth_state_{provider}=<random>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600` 설정
- [ ] 콜백 라우트가 쿠키 state와 `searchParams.state`를 `crypto.timingSafeEqual`로 비교, 불일치 시 `/login?error=oauth_state_mismatch`
- [ ] 검증 성공/실패 모두에서 state 쿠키 즉시 삭제(`Max-Age=0`) — replay 방지
- [ ] 쿠키 이름 provider suffix로 동시 인증 시도 충돌 방지
- [ ] state 값은 `crypto.randomBytes(32).toString('base64url')` 사용
- [ ] `NODE_ENV === 'development'`에서 Secure 플래그 자동 off (localhost 개발 호환)

**영향 파일**
- 수정: `next/src/app/api/auth/naver/route.ts`
- 수정: `next/src/app/api/auth/naver/callback/route.ts`
- 수정: `next/src/app/api/auth/kakao/route.ts`
- 수정: `next/src/app/api/auth/kakao/callback/route.ts`
- 신규: `next/src/lib/oauth/state.ts` — `createState()`, `verifyState(provider, req)`, `clearStateCookie(provider, res)`

**위험**
- `SameSite=Strict` 사용 금지 — OAuth callback은 외부 도메인에서 오는 top-level navigation이므로 Strict면 쿠키 미전송 → 항상 mismatch 실패
- `Path=/api/auth`만으로는 Supabase verify 이후 다른 경로에서 접근 불가 → `Path=/` 권장
- localhost dev 환경에서 Secure 플래그 자동 off 분기 필수

**검증 방법**
- 수동: DevTools Cookies에서 OAuth 시작 직후 state 쿠키 생성·콜백 후 삭제 확인
- 수동: 쿠키 수동 변조 후 콜백 재방문 → `oauth_state_mismatch` 에러 확인
- 자동: Vitest — state 유틸 단위 테스트 (timing-safe, 만료, base64url 형식)

---

### P0-2 · AuthSyncProvider 도입 ✅

**목표** — Supabase `onAuthStateChange` 이벤트를 Zustand store에 단방향 브리지하여, OAuth 완료 직후 `/mypage` 진입이 항상 동작하도록 한다.

**의존성** — 없음 (P0-1과 병행 가능)
**예상 공수** — 낙관 3h · 기대 5h · 비관 8h

**수락 기준**
- [ ] `AuthSyncProvider`가 `app/layout.tsx` 최상위 마운트
- [ ] 마운트 시 `supabase.auth.getSession()`으로 초기 세션 동기화
- [ ] `onAuthStateChange`의 `SIGNED_IN` / `TOKEN_REFRESHED` / `USER_UPDATED` → `useAuthStore.setUser(user)`
- [ ] `SIGNED_OUT` → `useAuthStore.clearUser()`
- [ ] Supabase user → Zustand `User` 매핑은 단일 함수 `mapSupabaseUser(session.user)`로 집중 (`user.user_metadata`에서 full_name·phone 파싱)
- [ ] subscription cleanup이 effect return에서 반드시 호출 (메모리 누수 방지)
- [ ] `useAuthGuard`는 Zustand `isLoggedIn` 대신 Supabase 세션 존재 여부 기준으로 리팩터 (또는 주석으로 AuthSyncProvider 경유 후 Zustand 값이 보장됨 명시)
- [ ] Naver/Kakao callback의 magic link `redirectTo`를 `/auth/callback?next=/mypage`로 변경 (경로 일원화)

**영향 파일**
- 신규: `next/src/components/auth/AuthSyncProvider.tsx`
- 신규: `next/src/lib/auth/mapSupabaseUser.ts`
- 수정: `next/src/app/layout.tsx` (Provider 주입)
- 수정: `next/src/lib/store.ts` (login/register/logout을 Supabase 호출로, set()은 AuthSyncProvider 책임)
- 수정: `next/src/hooks/useLoginForm.ts` (데모 로그인 분기 유지 + `supabase.auth.signInWithPassword`)
- 수정: `next/src/components/auth/LoginPage.tsx` (magic link redirectTo 변경)
- 수정: `next/src/app/api/auth/naver/callback/route.ts` (redirectTo 변경)
- 수정: `next/src/app/api/auth/kakao/callback/route.ts` (redirectTo 변경)

**위험**
- 이중 진실 소스 일시 공존 — 마운트 시 `getSession()` 즉시 호출 + `ready` 플래그로 완화
- SSR 환경에서 supabase.auth 접근 금지 → 'use client' 준수 + `useSyncExternalStore` 패턴
- 무한 루프 방지 — 이벤트 기반 구독만, 명령형 sync는 mount 1회만

**검증 방법**
- 수동: Google OAuth → /mypage 도달 → 새로고침 후 로그인 상태 유지 확인
- 수동: Supabase Studio에서 세션 강제 만료 → 다음 API 호출에서 자동 로그아웃 확인
- 자동: Vitest — `onAuthStateChange` 모킹, 이벤트별 store 상태 변화 검증
- 자동: `mapSupabaseUser` 단위 테스트 — provider별(google/kakao/naver) 매핑

---

### P0-3 · 서버사이드 verifyOtp — magic link race condition 근본 해결 ✅

**목표** — `admin.generateLink`의 `hashed_token`을 서버에서 직접 소비해 세션 쿠키를 주입, 브라우저 implicit flow를 완전히 제거한다.

**의존성** — P0-2 완료
**완료일** — 2026-04-16

**핵심 원인**
- 기존: `generateLink` → `action_link`(implicit flow, `#access_token=...` 해시) → 브라우저 비동기 처리
- Zustand 동기 hydration이 먼저 완료 → `useAuthGuard` 미로그인 판정 → `/login` 리다이렉트 (race condition)

**해결**
- `generateLink` → `hashed_token` 추출 → 서버에서 `verifyOtp({ token_hash, type: 'magiclink' })` 직접 호출
- `verifyOtp`가 세션 쿠키를 응답에 주입 → `/mypage` 리다이렉트 시 세션 이미 확립

**영향 파일** (완료)
- 신규: `next/src/lib/supabaseServer.ts` — `createRouteHandlerClient()` 팩토리
- 수정: `next/src/app/api/auth/naver/callback/route.ts`
- 수정: `next/src/app/api/auth/kakao/callback/route.ts`

**비고** — P2-3 (generateLink 우회) 계획이 이 구현으로 완전히 해결·흡수됨. P2-3 별도 착수 불필요.

---

### P0-4 · useAuthGuard getSession 폴백 ✅

**목표** — P0-3이 세션 쿠키를 주입했으나 `AuthSyncProvider`의 `onAuthStateChange`가 Zustand를 업데이트하기 전에 `useAuthGuard`가 실행되는 극소 타이밍 gap을 위한 안전망.

**의존성** — P0-3 완료
**완료일** — 2026-04-16

**해결**
- `isLoggedIn === false` 판정 시 `supabase.auth.getSession()` 직접 확인
- 세션 쿠키 있으면 리다이렉트 생략 (AuthSyncProvider가 곧 Zustand 동기화)
- 세션 없을 때만 `/login` 리다이렉트

**영향 파일** (완료)
- 수정: `next/src/hooks/useAuthGuard.ts`

---

## P1 — 중요

> **실행 우선순위:** P1-2(서버 컴포넌트 가드) → P1-1(ADR 이행) 순으로 진행. P1-2가 보안 경계 확립에 직결되므로 P1-1보다 먼저 착수한다.

### P1-1 · IdP email_verified 검증 + 계정 병합 정책 ADR

**목표** — 미인증 이메일을 가진 IdP 계정의 기존 이메일 유저 탈취를 차단하고, 동일 이메일 복수 provider 시나리오의 정책을 ADR로 명문화한다.

**의존성** — P0-1, P0-2 완료
**예상 공수** — 낙관 4h · 기대 8h · 비관 12h (ADR 1회 리뷰 포함)

**수락 기준**
- [ ] `docs/adr/ADR-001-oauth-account-merge-policy.md` 작성 및 커밋
- [ ] Naver: `profile.email_verified !== true` 또는 이메일 없음 → internal email(`naver_{id}@naver-oauth.internal`) 사용
- [ ] Kakao: `kakao_account.is_email_verified === true` 또는 이메일 없음 → internal email
- [ ] Google: Supabase 내장이 처리하나, `app_metadata.email_verified` 확인 후 미인증 시 거부
- [ ] 동일 이메일 기존 유저 존재 + 신규 provider 시도 → **거부 + 안내 메시지** ("이미 {기존 provider}로 가입된 이메일입니다")
- [ ] `admin.createUser` 실패가 "이메일 이미 존재"일 경우 이 경로 분기

**영향 파일**
- 신규: `docs/adr/ADR-001-oauth-account-merge-policy.md`
- 수정: `next/src/app/api/auth/naver/callback/route.ts`
- 수정: `next/src/app/api/auth/kakao/callback/route.ts`
- 신규: `next/src/lib/auth/mergePolicy.ts` — `verifyProviderEmail()`, `resolveEmail()`, `handleExistingUser()`

**위험**
- Naver "이메일 필수" 설정해도 동의 시점 사용자 거부 가능 → internal fallback 정답 여부 검증
- Kakao 이메일 미인증 case 실제 빈도는 모니터링 필요
- 기존 유저 자동 병합 vs 거부 트레이드오프 → ADR에서 절충안(수동 연결 경유) 검토

**검증 방법**
- 수동: Naver 콘솔에서 이메일 권한 거부 로그인 → internal 이메일 유저 생성 확인
- 수동: 기존 이메일 유저 + 동일 이메일 Naver 로그인 → 거부 메시지 노출
- 자동: `mergePolicy.ts` 단위 테스트 (verified/unverified × 기존/신규 조합)

---

### P1-2 · 서버 컴포넌트 가드 (/mypage, /checkout)

**목표** — 클라이언트 사이드 `useAuthGuard`를 우회하는 localStorage 조작 공격 무력화. 보호 페이지의 실제 보안 경계를 서버 컴포넌트 + `getUser()`(JWT 서명 검증)로 상향.

**의존성** — P0-2 (쿠키 기반 세션 확립)
**예상 공수** — 낙관 3h · 기대 5h · 비관 8h

**수락 기준**
- [x] `lib/supabaseServer.ts` 신설 — `createRouteHandlerClient()` 팩토리 (P0-3에서 완료)
- [ ] `/mypage/page.tsx`가 서버 컴포넌트에서 `getUser()` 호출, 실패 시 `redirect('/login')`
- [ ] `/checkout/page.tsx` 동일 적용 (fromCheckout 비회원 플로우는 searchParam 분기)
- [ ] `getSession()` 금지, 반드시 `getUser()` 사용 (JWT 서명 검증) — 주석으로 이유 명시
- [ ] `useAuthGuard`는 UX 개선용으로 강등, 주석으로 "보안 경계 아님" 명시
- [ ] 서버 컴포넌트 redirect 발생 시 Next.js 기본 로깅 확인

**영향 파일**
- 신규: `next/src/lib/supabaseServer.ts`
- 수정: `next/src/app/mypage/page.tsx` (server wrapper + client child 분리)
- 수정: `next/src/app/checkout/page.tsx`
- 수정: `next/src/app/auth/callback/route.ts` (supabaseServer 유틸 사용 리팩터)
- 수정: `next/src/hooks/useAuthGuard.ts` (주석 갱신)

**위험**
- mypage/checkout이 현재 'use client' → 서버 컴포넌트 wrapper 패턴 필요
- `getUser()` 매 요청 Supabase API 호출 비용 → 캐싱 또는 RSC Suspense boundary 배치 검토
- 서버/클라 상태 불일치 깜빡임 → AuthSyncProvider 초기화 완료까지 loading 상태 유지

**검증 방법**
- 수동: DevTools Local Storage `gtr-auth-store`를 `isLoggedIn:true`로 조작 → /mypage 진입 시 서버 redirect로 /login 이동
- 수동: Supabase 쿠키만 삭제 → /mypage → /login redirect
- 자동: Playwright E2E — localStorage 조작 시나리오

---

## P2 — 장기

### P2-1 · Zustand auth 상태 제거 + useCurrentUser 훅

**목표** — 이중 진실 소스 완전 제거. Supabase session이 유일한 auth truth source가 되도록 구조 단순화.

**의존성** — P0-2, P1-2 완료
**예상 공수** — 낙관 5h · 기대 10h · 비관 16h (13 파일 전수 수정)

**수락 기준**
- [ ] `useAuthStore`에서 `user`, `displayName`, `isLoggedIn`, `isLoading`, `login`, `register`, `logout`, `updatePassword`, `withdraw` 제거
- [ ] 신규 `useCurrentUser()` 훅 — Supabase session 구독, `{ user, isLoading, isAuthenticated }` 반환
- [ ] 로그인/회원가입/로그아웃 액션은 `lib/auth/actions.ts` 모듈로 (`signIn`, `signUp`, `signOut`, `updatePassword`)
- [ ] 데모 계정은 별도 플래그(`signInAsDemo()`), `NODE_ENV === 'development'`에서만 export
- [ ] 기존 13개 호출부 전수 교체

**영향 파일**
- 수정: `next/src/lib/store.ts` (AuthStore 섹션 제거)
- 신규: `next/src/hooks/useCurrentUser.ts`
- 신규: `next/src/lib/auth/actions.ts`
- 수정 (13 파일): LoginPage.tsx · MyPagePage.tsx · CheckoutPage.tsx · SiteHeader.tsx · useAddressForm.ts · useRegisterForm.ts · useCheckoutForm.ts · useLoginForm.ts · usePasswordChangeForm.ts · useAuthGuard.ts · app/mypage/page.tsx · types/auth.ts

**위험**
- 13 파일 동시 수정 → 한 PR 내 파일별 커밋 분리
- `updateAddress` 경로 — Supabase profiles 테이블로 이관(P2-2 연동)
- `displayName` localStorage persist 제거는 Supabase 쿠키에 세션 있으므로 불필요

**검증 방법**
- 수동: 인증 관련 전 플로우 회귀 (로그인·가입·로그아웃·주소·비번변경·탈퇴)
- 자동: Vitest — `useCurrentUser` + `lib/auth/actions` 80%↑ 커버리지

---

### P2-2 · Supabase RLS 정책 작성

**목표** — DB 레벨에서 "본인 데이터만 접근" 강제. API 레이어 실수 시에도 방어선 유지.

**의존성** — P2-1, Phase 3 백엔드 스키마 설계 연계
**예상 공수** — 낙관 4h · 기대 8h · 비관 16h

**수락 기준**
- [ ] `supabase/migrations/001_profiles.sql` — profiles 테이블 + RLS 활성화
  - 컬럼: `id (uuid, fk auth.users)`, `email`, `full_name`, `phone`, `address_*`, `created_at`, `updated_at`
- [ ] RLS 정책: `SELECT`·`UPDATE` = `auth.uid() = id`, `INSERT` = handler trigger (`auth.users` 신규 시 profiles row 자동 생성)
- [ ] orders·addresses 등 향후 테이블 동일 패턴 (`user_id = auth.uid()`)
- [ ] Service role 사용처 명문화 — 관리자 조회, admin.generateLink
- [ ] 로컬 Supabase CLI 마이그레이션 실행 절차 문서화

**영향 파일**
- 신규: `supabase/migrations/001_profiles.sql`
- 신규: `supabase/migrations/002_profiles_rls.sql`
- 신규: `supabase/migrations/003_on_auth_user_created.sql` (trigger)
- 신규: `docs/supabase-schema.md`

**위험**
- 스키마 선설계 필요 — P2-2는 profiles만 우선 착수, orders는 Phase 3로 분리
- 기존 user_metadata → profiles 이중 저장 방지
- Service Role 남용 리스크 — callback 라우트 외 사용 금지 문서화

**검증 방법**
- 수동: Supabase Studio SQL editor — `set role authenticated; select * from profiles;` → 본인 row만 반환
- 수동: 악의 UUID UPDATE 시도 → 0 rows affected
- 자동: pgTAP 또는 Vitest + Supabase test client로 RLS 정책 검증

---

### P2-3 · admin.generateLink 우회 → 서버 내부 세션 발급 ✅ (P0-3에 흡수 완료)

> **삭제됨** — P0-3(`verifyOtp` 방식)이 이 목표를 완전히 달성했으므로 별도 착수 불필요.  
> `hashed_token` → `verifyOtp` 방식이 "generateLink 서버 소비"의 현실적 최선이었으며, 이미 구현 완료.

**목표** (완료) — Naver/Kakao 콜백의 magic link 브라우저 리다이렉트 왕복 제거. 서버에서 직접 세션 쿠키 발급으로 2단계 UX 개선 + 중간 노출 리스크 제거.

**의존성** — ~~P2-1, P2-2 완료~~ (P0-3 선완료)
**예상 공수** — ~~낙관 6h · 기대 12h · 비관 20h~~ (불필요)

**수락 기준**
- [ ] Naver/Kakao callback이 `admin.generateLink` 대신:
  1. `admin.createUser` 또는 기존 user 조회
  2. `signInWithIdToken` 또는 `createSession` 대체 경로 (Supabase가 비표준 provider 지원하는지 확인)
  3. 불가능 시 `generateLink` 후 **서버에서 직접 소비**하여 `exchangeCodeForSession`을 서버에서 수행
- [ ] 브라우저는 `/mypage`로 단 1회 리다이렉트
- [ ] magic link URL이 브라우저 주소창에 노출되지 않음

**영향 파일**
- 수정: `next/src/app/api/auth/naver/callback/route.ts`
- 수정: `next/src/app/api/auth/kakao/callback/route.ts`
- 신규: `next/src/lib/auth/createSession.ts`

**위험**
- **Supabase API 제약 가능성 높음** — 비표준 provider 세션 직접 생성 공식 API 미제공. `generateLink` 서버 소비가 현실적 최선일 가능성
- 착수 전 Supabase GitHub Issues + Context7 문서 조사 선행
- 구현 어렵고 보안 영향 Low면 **디퍼 허용**

**검증 방법**
- 수동: Naver OAuth 브라우저 주소창 이동 횟수 `Naver 동의 → /api/auth/naver/callback → /mypage` 3단계 이내
- 자동: Playwright — 네트워크 기록 리다이렉트 체인 검증

---

## P3 — 관측

### P3-1 · OAuth 실패 이벤트 로깅

**목표** — 보안 사건 관측성. state mismatch·email unverified·provider API error를 구조화 로깅하여 공격 탐지.

**의존성** — P0-1, P1-1
**예상 공수** — 낙관 3h · 기대 5h · 비관 8h

**수락 기준**
- [ ] `lib/logger.ts` — console.error → JSON 구조화 로그
- [ ] 이벤트: `oauth.state_mismatch`, `oauth.token_exchange_failed`, `oauth.profile_fetch_failed`, `oauth.email_unverified`, `oauth.user_exists_different_provider`
- [ ] 각 이벤트에 `provider`, `ip`(X-Forwarded-For 파싱), `user_agent`, `timestamp` 포함
- [ ] 이메일·state·토큰 등 민감 데이터 로그 금지 (이메일은 hash만)
- [ ] Vercel 배포 환경에서 Sentry 또는 Vercel Log Drain 연동 (Phase 4)

**영향 파일**
- 신규: `next/src/lib/logger.ts`
- 수정: Naver/Kakao callback + `/auth/callback/route.ts`

**위험**
- PII 실수 포함 — 로그 검수 체크리스트
- Vercel 무료 플랜 로그 용량 제한

**검증 방법**
- 수동: state 변조 → 콘솔에 `oauth.state_mismatch` JSON 출력
- 자동: logger 단위 테스트 — 이벤트 스키마 검증

---

### P3-2 · /api/auth/* Rate Limiting

**목표** — Brute force · credential stuffing · 비용 공격 차단. Upstash Redis 기반 sliding window.

**의존성** — P3-1
**예상 공수** — 낙관 4h · 기대 6h · 비관 10h

**수락 기준**
- [ ] Upstash Redis 프로젝트 생성 + 환경변수 (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`)
- [ ] `@upstash/ratelimit` 도입
- [ ] 보호 엔드포인트: `/api/auth/naver`, `/api/auth/kakao`, `/api/auth/naver/callback`, `/api/auth/kakao/callback`, `/auth/callback`
- [ ] IP당 10 req/60s (OAuth 시작), 30 req/60s (콜백)
- [ ] 초과 시 429 + `Retry-After` 헤더 + 로그 이벤트
- [ ] 로컬 개발에서는 환경변수 미설정 시 bypass

**영향 파일**
- 신규: `next/src/lib/ratelimit.ts`
- 신규: `next/src/middleware.ts` (또는 각 라우트 내부)
- 수정: Naver/Kakao/Supabase callback 라우트
- 수정: `.env.example`

**위험**
- IP 신뢰 — Vercel Edge는 `x-forwarded-for` 안정적
- 공유 IP 집단 차단 — 모바일 NAT·학교·기업 네트워크 임계치 조정 필요
- Redis 장애 시 auth 전체 불능 → fail-open 전략 (오류 시 통과 + 로그)

**검증 방법**
- 수동: curl 반복 호출 → 11회차 429 확인
- 자동: Vitest — ratelimit wrapper 단위 테스트 (Upstash 모킹)

---

## 실행 순서 & PR 분리 전략

### 실제 완료 이력 + 잔여 타임라인

```
[2026-04-16] ✅ P0-1 (CSRF state)        ─┐
             ✅ P0-2 (AuthSyncProvider)  ─┤
             ✅ P0-3 (verifyOtp 서버세션) ─┤─> B-2 3종(Naver·Kakao·Google) 정상화
             ✅ P0-4 (useAuthGuard 폴백) ─┘
             ✅ Kakao KOE010 해결 (콘솔 Client Secret 활성화)
             ✅ ADR-001 작성 (2026-04-15)
──────────────────────────────────────────────────
[다음]       P1-2 (서버 컴포넌트 가드)   ← lib/supabaseServer.ts 이미 생성됨
             P1-1 (ADR-001 코드 이행)   ← ADR 문서 존재, mergePolicy.ts 구현 필요
──────────── PR #1 머지 (P0 + P1 묶음) ────────────
[Week 2]    P2-1 (Zustand auth 제거)
             P2-2 (RLS profiles)
             ~~P2-3~~ (P0-3에 흡수 완료)
──────────── PR #2 머지 (P2 묶음) ────────────
[Week 3]    P3-1 (로깅)
             P3-2 (rate limit)
──────────── PR #3 머지 (P3 묶음) ────────────
```

### B-2 OAuth 정상화 시점

**P0-2 완료 직후**가 B-2 마무리 시점.
- Naver "동의화면 OK + /mypage 미도달" 원인은 **Zustand↔Supabase 세션 미연결** → 정확히 P0-2가 해결
- Google PKCE 재테스트도 AuthSyncProvider 마운트 후 정상 동작 확인 가능
- Kakao KOE010은 P 시리즈와 무관한 콘솔 설정 이슈 → 병렬 해결

### PR 분리 근거

| PR | 포함 | 이유 |
|----|------|------|
| **PR #1** (P0-1·P0-2·P1-1·P1-2) | 취약점 차단 + 보안 경계 확정 | 보안 픽스는 빠르게 머지. 서로 긴밀히 연결되어 분리 시 중간 상태가 불안정 |
| **PR #2** (P2-1·P2-2·P2-3) | 아키텍처 정리 | 리팩터링 성격. 기능 변경 없이 구조만. 리뷰 시간 여유 |
| **PR #3** (P3-1·P3-2) | 관측성 + 운영 | 배포 인프라(Upstash·Sentry) 의존. Phase 4 배포 준비 연계 |

PR #1을 더 쪼개지 않는 이유: P0-1만 머지하고 P0-2 미머지 상태에서는 OAuth 콜백 정상 동작에도 `/mypage` 미도달이 지속되어 "머지됐지만 동작 안 함" 오해 발생.

---

## 롤백 전략

| 항목 | 롤백 방식 |
|------|-----------|
| P0-1 | 라우트 4개 단위 revert 가능 |
| P0-2 | `AuthSyncProvider` 마운트 해제 + `lib/store.ts` revert |
| P1-1 | callback 라우트 merge policy 분기 revert, ADR은 문서이므로 유지 |
| P1-2 | 서버 컴포넌트 wrapper 제거 → 기존 'use client' 복원 |
| P2-1 | **전체 revert 필요** (13 파일). 커밋 분리로 완화 |
| P2-2 | migration down 스크립트로 롤백 |
| P2-3 | callback 라우트 단위 revert |
| P3-1 | logger import 제거 |
| P3-2 | middleware 제거 + 환경변수 unset |

---

## 완료 체크리스트

- [x] P0-1 (CSRF state 쿠키)
- [x] P0-2 (AuthSyncProvider)
- [x] P0-3 (서버사이드 verifyOtp — race condition 해결)
- [x] P0-4 (useAuthGuard getSession 폴백)
- [x] ADR-001 작성
- [ ] P1-2 (서버 컴포넌트 가드)
- [ ] P1-1 (ADR-001 코드 이행 — mergePolicy.ts)
- [ ] P2-1 (Zustand auth 제거)
- [ ] P2-2 (RLS)
- [ ] P3-1 (로깅)
- [ ] P3-2 (rate limit)
- [ ] 리뷰 3총사(ts-reviewer + code-reviewer + security-reviewer) 통과
- [ ] E2E 회귀 테스트 통과
- [ ] `docs/milestone.md` 업데이트

---

## 참고

- 아키텍처 권고 원본: 본 세션 architect 에이전트 출력 (2026-04-16)
- 플래너 상세 계획: 본 세션 planner 에이전트 출력 (2026-04-16)
- B-2 핸드오버: `memory/session_handover_2026_04_15_oauth.md`
- OWASP ASVS V2 Authentication
- Supabase Auth — Identities 문서
