# ADR-001: OAuth 계정 병합 및 이메일 검증 정책

**상태:** Accepted
**작성일:** 2026-04-15
**작성자:** JW (굳띵즈 로스터스)
**관련:** `docs/oauth-security-plan.md` (P1-1), `docs/milestone.md` Phase 3-9

---

## 1. Context (배경)

굳띵즈 로스터스는 Phase 2-F에서 다음 3종 OAuth 제공자를 지원한다.

| 제공자 | 이메일 제공 | 이메일 검증 제공 | 비즈앱 인증 필요 |
|--------|------------|-----------------|----------------|
| Google | ✅ 기본 | ✅ `email_verified` 필드 | ❌ |
| Kakao | ⚠️ 비즈앱 인증 시에만 | ⚠️ `is_email_verified` 필드 (비즈앱 전용) | ✅ |
| Naver | ⚠️ 선택 스코프 | ❌ 검증 필드 미제공 | ❌ |

추가로 굳띵즈는 **이메일+비밀번호 가입(Supabase Auth 기본)** 도 지원한다.

이 구조에서 다음 문제가 발생한다.

### 1.1 문제 시나리오

**시나리오 A — 이메일 탈취 공격**
1. 공격자가 `victim@example.com` 으로 이메일 가입 완료 (Supabase 가입·비밀번호 검증)
2. 피해자가 동일 `victim@example.com` 으로 Naver OAuth 가입 시도
3. Naver는 이메일 검증 필드를 제공하지 않아 **Naver 계정이 실제로 해당 이메일을 소유한다는 보장이 없다**
4. 만약 이메일 일치만으로 계정을 병합하면 → 공격자는 Naver 로그인만으로 피해자 계정에 접근 가능

**시나리오 B — 서로 다른 IdP의 동일 이메일**
1. 동일 이메일로 Google 가입 후 Kakao 로 재로그인 시도
2. 이메일이 같지만 IdP가 다른 경우 **자동 병합할 것인가, 별도 계정으로 둘 것인가** 가 정책 미정

**시나리오 C — 이메일 미제공 OAuth (Kakao 비즈앱 미인증 / Naver 스코프 미동의)**
1. Kakao 비즈앱 인증 없이 로그인 → 이메일 미제공
2. 현재 코드는 `kakao_{id}@kakao-oauth.internal` 가상 이메일로 Supabase 유저 생성
3. **이 가상 이메일이 유출되거나 서비스 내부 로직에서 실제 이메일로 취급되면** 혼선 발생

### 1.2 Supabase 기본 동작

Supabase Auth는 기본적으로 **동일 이메일 기준으로 계정을 자동 병합한다** (Identity linking). 이는 보안적으로 위험할 수 있으며, 프로젝트 설정의 `auth.identity_linking = manual` 로 수동 제어해야 한다.

---

## 2. Problem (해결해야 할 문제)

1. OAuth 제공자의 **이메일 검증 여부를 IdP별로 일관성 있게 처리** 해야 한다.
2. 이메일 미검증 OAuth 가입자와 기존 이메일 가입자 간 **계정 병합 정책** 을 결정해야 한다.
3. 이메일 미제공 OAuth (Kakao 비즈앱 미인증, Naver 선택 스코프 미동의) 처리 방침을 정해야 한다.
4. 사용자 경험(가입 마찰)과 보안을 **어떤 기준으로 타협할지** 결정해야 한다.

---

## 3. Decision (결정)

### 3.1 이메일 검증 정책

**IdP별 이메일 검증 신뢰 수준**

| IdP | 신뢰 수준 | 검증 방법 | 근거 |
|-----|---------|---------|------|
| Google | **High** | `id_token.email_verified === true` 필수 확인 | OpenID Connect 표준, Google 자체 이메일 검증 |
| Kakao (비즈앱 ✅) | **Medium-High** | `kakao_account.is_email_verified === true` 필수 확인 | Kakao 자체 이메일 검증, 비즈앱 인증 필수 |
| Kakao (비즈앱 ❌) | **N/A** | 이메일 사용하지 않음 — 가상 이메일 생성 | 이메일 스코프 미취득 |
| Naver | **Low** | 검증 필드 없음 — 항상 미검증으로 간주 | Naver API는 이메일 검증 상태 미제공 |
| 이메일 가입 | **Medium** | Supabase `email_confirm` 메일 링크 클릭 후 | 굳띵즈 자체 메일 발송 |

**코드 기대 동작**
- Google 콜백 핸들러: `id_token.email_verified !== true` 인 경우 가입 거부 (`auth_email_not_verified` 리다이렉트)
- Kakao 콜백 핸들러: `kakao_account.is_email_verified !== true` 인 경우 이메일 없는 것으로 취급 (가상 이메일 경로로 fallback)
- Naver 콜백 핸들러: **이메일이 있어도 `email_verified: false` 로 user_metadata 에 기록**

### 3.2 계정 병합 정책

**원칙:** 이메일 검증 상태가 낮은 쪽이 높은 쪽으로 병합되는 것을 허용하지 않는다.

| 기존 계정 | 신규 로그인 | 이메일 동일 | 정책 |
|----------|-----------|------------|------|
| 없음 | Google (검증) | — | 신규 계정 생성 |
| 없음 | Kakao 비즈앱(검증) | — | 신규 계정 생성 |
| 없음 | Kakao 비즈앱 미인증 | — | 가상 이메일로 신규 계정 생성 |
| 없음 | Naver (미검증) | — | **신규 계정 생성하되 `email_verified: false` 기록** |
| 없음 | 이메일 가입 | — | Supabase `email_confirm` 링크 발송, 확인 후 활성화 |
| Google | Google 재로그인 | ✅ | 동일 계정 로그인 |
| Google | 이메일 가입 시도 | ✅ | **가입 차단** → "이미 Google 로 가입되어 있습니다. Google 로 로그인 하세요." 안내 |
| Google | Kakao 비즈앱(검증) | ✅ | **자동 병합 허용** (양쪽 다 검증 완료) |
| Google | **Naver (미검증)** | ✅ | **자동 병합 금지** → 별도 계정으로 처리, 로그인 UI 에 "이 이메일은 이미 Google 로 가입되어 있습니다. 병합하려면 Google 로 로그인 후 [설정 > 계정 연결] 에서 Naver 연결을 완료하세요." 안내 |
| 이메일 가입 (검증 완료) | Naver (미검증) | ✅ | **자동 병합 금지** → 위와 동일 가이드 |
| 이메일 가입 (검증 완료) | Google (검증) | ✅ | **자동 병합 허용** |
| Naver | 이메일 가입 시도 | ✅ | **이메일 가입 우선 처리** → Supabase `email_confirm` 성공 시 Naver 계정을 이메일 계정에 linking |

**구현 위치:**
- Supabase 대시보드 Settings → Authentication → `Enable manual linking` = ON
- 병합 로직은 `lib/auth/accountMerge.ts` (신설)에 중앙화
- Naver/Kakao 콜백 핸들러는 `accountMerge.resolve({ email, emailVerified, provider })` 호출

### 3.3 이메일 미제공 OAuth 처리

**Kakao 비즈앱 미인증 케이스**
- 가상 이메일 포맷: `kakao_{kakao_id}@kakao-oauth.internal`
- `user_metadata.synthetic_email = true` 플래그 설정
- **UI 에서 해당 이메일을 표시하지 않는다** (마이페이지에서 "이메일 미등록" 으로 표시, 설정 > 이메일 추가 유도)
- 주문 완료 등 이메일 발송이 필요한 경우 → **해당 기능을 차단** 하고 이메일 추가 유도 모달 띄움

**Naver 이메일 미동의 케이스 (향후)**
- 현재 구현은 이메일 스코프를 필수로 요구하지 않음
- 선택 스코프로 전환 시 Kakao 비즈앱 미인증과 동일한 가상 이메일 경로 적용

### 3.4 CSRF 방어 (참조: P0-1)

모든 OAuth 시작 라우트는 **`state` 파라미터를 HttpOnly 쿠키에 저장** 하고 콜백에서 검증한다. 상세는 `docs/oauth-security-plan.md` P0-1 참조.

---

## 4. Alternatives Considered (검토했으나 기각한 안)

### Alt-1: 모든 IdP 에서 이메일 일치 시 자동 병합
- **기각 사유:** Naver 가 이메일 검증을 제공하지 않아 탈취 위험. 시나리오 A 가 현실화된다.

### Alt-2: 모든 IdP 에서 자동 병합 금지 (완전 분리)
- **기각 사유:** Google+Kakao 비즈앱 처럼 양쪽 다 검증된 경우에도 별도 계정이 되어 사용자 경험 저하. 또한 같은 사람이 3 계정을 갖게 되어 주문 이력·포인트 파편화.

### Alt-3: 최초 가입 시 이메일 검증 강제 (Supabase `email_confirm`) — Naver 포함 전체
- **기각 사유:** OAuth 의 UX 이점(원클릭 가입)을 훼손. 또한 Naver 만 별도 확인 메일을 보내면 "왜 다른 SNS 와 다른가" 민원 발생. 대신 미검증 상태를 표기하고 병합만 제한.

### Alt-4: 이메일 미제공 OAuth 차단
- **기각 사유:** Kakao 비즈앱 인증은 사업자등록+실사용 후 심사(통상 1~2주)가 필요. 초기 서비스 론칭 시 Kakao 로그인을 완전히 못 쓰게 된다.

---

## 5. Consequences (영향)

### Positive
- **시나리오 A 차단:** Naver 를 통한 이메일 탈취 공격 불가
- **시나리오 B 해결:** 검증 상태 기반으로 자동 병합 여부가 결정되어 일관성 확보
- **시나리오 C 투명성:** 가상 이메일이 내부 플래그로 명확히 식별됨

### Negative / Trade-offs
- **Naver 사용자 UX 마찰:** 이미 이메일 또는 Google 로 가입한 사용자가 Naver 로 로그인하면 에러 안내를 받게 된다. 안내 문구를 친절하게 작성해야 한다.
- **accountMerge 로직 복잡도 증가:** 콜백 핸들러마다 중복 방지를 위해 공통 모듈화 필요
- **Kakao 비즈앱 신청 지연 시 UX 제약:** 비즈앱 미인증 상태에서는 이메일 알림 발송 기능이 제한됨

### 운영 영향
- Supabase 대시보드 설정 변경 1건 (`Enable manual linking = ON`)
- 문의 응대 FAQ 에 "같은 이메일인데 Naver 로 로그인이 안 된다" 케이스 추가 필요

---

## 6. Implementation Notes (구현 메모)

### 6.1 작업 순서 (오케스트레이션)
1. Supabase 대시보드 `Enable manual linking = ON` 적용
2. `lib/auth/accountMerge.ts` 작성 (병합 규칙 중앙화)
3. Google 콜백 → `email_verified` 체크 추가 (Supabase `signInWithOAuth` 기본 핸들링으로 덮이나, 서버 검증 필요 시 콜백에서 재확인)
4. Kakao 콜백 → `is_email_verified` 체크 + 가상 이메일 fallback 유지
5. Naver 콜백 → `user_metadata.email_verified = false` 명시적 기록
6. Supabase RLS 정책에 `email_verified` 기반 조건 추가 검토 (예: 주문 작성은 검증된 이메일 필요)

### 6.2 가상 이메일 식별
```ts
// lib/auth/syntheticEmail.ts
export const SYNTHETIC_EMAIL_SUFFIX = '-oauth.internal';
export const isSyntheticEmail = (email: string) =>
  email.endsWith(SYNTHETIC_EMAIL_SUFFIX);
```

### 6.3 마이페이지 이메일 표시
```tsx
// components/mypage/ProfileEmail.tsx
const email = user.email;
const isVirtual = isSyntheticEmail(email) || user.user_metadata?.synthetic_email === true;
return isVirtual
  ? <Link href="/settings/email">이메일 추가하기</Link>
  : <span>{email}</span>;
```

### 6.4 Google OAuth PKCE Flow 제약 (구현 리뷰어용 기록)

> **목적:** `accountMerge` 연결 시 Google 콜백만 유독 "세션 수립 **후** 역검증 → `signOut` → 리다이렉트" 라는 비대칭 패턴을 취한다. 리뷰어가 이 비대칭을 코드 스멜로 오해하지 않도록 근거와 대안 기각 이유를 명시한다.

#### 제약 요약

Google OAuth는 Supabase 클라이언트의 `signInWithOAuth` (PKCE flow)로 처리되며, 콜백 라우트 `/auth/callback`은 `code`만 수신한다. **이메일·검증상태·프로필은 `exchangeCodeForSession`을 호출해 세션을 수립한 이후에만 접근 가능** 하다.

#### Naver/Kakao와의 차이

| 항목 | Naver/Kakao | Google (PKCE) |
|-----|------------|--------------|
| 콜백 수신 정보 | `code` + `state` → 서버가 IdP에 직접 토큰 교환 요청 | `code` + `state` + `code_verifier`(쿠키) — Supabase가 내부 교환 |
| 이메일 획득 시점 | 토큰 교환 → 프로필 조회로 **세션 수립 전** 획득 | `exchangeCodeForSession` 이후 `session.user.email`로 획득 (**세션 수립 후**) |
| 정책 검사 위치 | 세션 수립 **전** → `block` 시 단순 리다이렉트 | 세션 수립 **후** → `block` 시 `signOut` + 쿠키 삭제 필수 |
| 세션 쿠키 잔존 위험 | 없음 (verifyOtp 호출 전 종료) | `signOut` 누락 시 block 무력화 위험 |

#### 왜 Google만 이런 구조인가 (대안 기각 사유)

**기각 1 — "Google도 Naver/Kakao처럼 direct token flow로 전환"**
- PKCE flow에서 `code_verifier`는 Supabase가 시작 라우트 쿠키에 저장하고 내부에서만 소비한다. 서버가 `fetch('https://oauth2.googleapis.com/token')`으로 직접 교환하려면 **Supabase PKCE flow를 버리고 수동 flow를 재구현** 해야 한다.
- 이 경우 `client_id`/`client_secret`을 Supabase와 환경변수 두 곳에 이중 관리하게 되어 실수 확률↑ + Supabase의 identity linking 혜택 포기.

**기각 2 — "ID Token만 추출해서 세션 수립 없이 검증"**
- Supabase v2 JS SDK는 `exchangeCodeForSession` 중간에 ID Token만 노출하는 공식 API가 없다.
- `id_token.email_verified`는 세션 수립 시 내부적으로 검증되지만, 개발자 코드에서 세션 수립 없이 꺼낼 수는 없다.

**기각 3 — "Admin API로 code만 보고 이메일 역조회"**
- Admin API는 code 교환 기능 미제공. code 자체에는 이메일이 포함되지 않는다(opaque token).

**기각 4 — "Supabase `skipSessionRefresh` 같은 옵션 활용"**
- Supabase v2 공식 API에 해당 옵션 없음 (2026-04 현재).

→ **결과:** "세션 수립 후 역검증 + signOut" 이 **유일하게 공식 API로 완결 가능한 경로**이다.

#### 선택한 구현 패턴

```typescript
// app/auth/callback/route.ts
const { data, error } = await supabase.auth.exchangeCodeForSession(code);
if (error || !data?.user?.email) {
  return redirectErr(origin, 'auth_exchange_failed');
}

const decision = await resolveAccountMerge({
  email: data.user.email,
  emailVerified: data.user.email_confirmed_at != null,  // Google은 항상 true
  provider: 'google',
  isSynthetic: false,
}, supabaseAdmin);

if (decision.action === 'block') {
  // ⚠️ 세션이 이미 수립되었으므로 반드시 signOut으로 쿠키 제거
  await supabase.auth.signOut();
  return redirectErr(origin, decision.code);
}
return NextResponse.redirect(`${origin}/mypage`);
```

#### 리뷰어 체크포인트

- [ ] **`signOut` 실패 대비 fallback:** `signOut` 에러 시에도 응답에서 `sb-*` 세션 쿠키를 명시적으로 삭제해야 한다. 쿠키가 남으면 block이 무력화된다.
- [ ] **탭 간 경쟁 상황 방어:** `block` → `signOut` → redirect 사이의 짧은 순간 동안 다른 탭에서 `/mypage`를 열어도 안전해야 한다. 이는 P1-2 서버 컴포넌트 가드(`getUser()`)가 이미 차단한다(JWT 서명 검증이므로 클라이언트 조작 무효).
- [ ] **Supabase 세션 쿠키 이름 동적성:** `sb-<project-ref>-auth-token` 등 동적 이름을 사용하므로 `res.cookies.delete('sb-...')`를 하드코딩하지 말고 `supabase.auth.signOut()` 경로를 우선 사용한다.
- [ ] **로그 주의:** `signOut` 직후 `auth.getUser()` 호출 결과가 일시적으로 user를 반환할 수 있으므로 진단 로그는 응답 직전에 찍는다.

#### Naver/Kakao가 이 패턴을 따르지 않는 이유 (대칭성 검토)

- Naver/Kakao는 콜백에서 **IdP access_token → 프로필 조회**를 직접 수행하므로 세션 수립 없이 이메일을 얻는다.
- 따라서 `resolveAccountMerge`를 **프로필 조회 직후, `verifyOtp` 호출 전**에 끼워 넣으면 block 시 그냥 리다이렉트만 해도 세션 누수가 없다.
- 이 비대칭은 IdP와 Supabase flow의 선택 차이에서 기인하며, ADR §3.2 정책은 동일하게 적용된다.

---

## 7. Revision History

| 날짜 | 변경 | 사유 |
|-----|------|------|
| 2026-04-15 | 최초 작성 | P1-1 이행 중 이메일 검증 정책 확정 |
| 2026-04-16 | §6.4 추가 | Google PKCE flow 제약 및 "세션 수립 후 역검증" 패턴 근거 기록 (P1-1 구현 리뷰어 가이드) |

---

**승인:**
- Product Owner: JW (자체 승인)
- Security Review: ECC Security Reviewer Agent (계획 수립 시)
- Architect Review: ECC Architect Agent (3-tier separation 검토 시)
