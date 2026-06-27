# 소셜 로그인 출시 전 체크리스트 (카카오 · 구글 · 네이버)

> 작성: 2026-06-27 (S335)
> 목적: 정식 도메인 전환·정식 오픈 시 소셜 로그인 3종이 일반 사용자에게 정상 동작하도록 빠짐없이 처리.
> 관련: `docs/adr/ADR-001-oauth-account-merge-policy.md`, `docs/oauth-security-plan.md`

---

## 0. 구현 방식 (왜 프로바이더마다 할 일이 다른가)

| 프로바이더 | 구현 | OAuth 콜백 경유지 | 도메인 전환 시 영향 |
|-----------|------|------------------|--------------------|
| **구글** | Supabase 네이티브 (`signInWithOAuth`) | `…supabase.co/auth/v1/callback` (고정) | Google 콘솔 Redirect URI **무관**. 대신 Supabase·동의화면 설정 |
| **카카오** | 커스텀 라우트 | `<도메인>/api/auth/kakao/callback` | 카카오 콘솔에 **정식 도메인 콜백 추가 필요** |
| **네이버** | 커스텀 라우트 | `<도메인>/api/auth/naver/callback` | 네이버 콘솔에 **정식 도메인 콜백 추가 필요** + 검수 |

- 콜백 URL은 **접속 도메인(origin) 기준으로 코드가 동적 생성**한다 (`${origin}/api/auth/<provider>/callback`).
- 따라서 사용자가 접속하는 도메인이 곧 콜백 도메인 → 각 콘솔에 그 도메인이 등록돼 있어야 한다.

---

## 1. 순서 의존성 (이 순서를 지켜야 함)

```
① 토스 라이브 심사 통과
② 정식 도메인(goodthingsroasters.com)에 우리 사이트 연결
   (현재 정식 도메인엔 다른 페이지가 연결돼 있음 → 전환 전까지 정식 도메인으로 검수 불가)
③ 각 콘솔에 정식 도메인 등록 + 네이버 검수 신청 / 구글 동의화면 게시
④ 검수·게시 승인 확인 → 일반 사용자 로그인 정상 동작 검증
```

> ⚠️ 정식 도메인에 사이트가 올라가기 전에는 네이버 검수·구글 검증이 "검수원이 접속 불가"로 반려될 수 있다.

---

## 2. 네이버 (NAVER)

현재 상태: **"개발 중"** — 멤버관리에 등록된 네이버 ID만 로그인 가능. 일반 사용자는 차단됨.

- [ ] **검수 신청 → 승인** ("개발 중" → 실서비스). 승인돼야 모든 사용자 로그인 가능. **영업일 며칠 소요** → 정식 도메인 연결 직후 즉시 신청
- [ ] **서비스 URL 변경**: `http://localhost:3000` → `https://goodthingsroasters.com` (루트만, www·경로 없이)
- [ ] **로고 이미지 업로드**: `gtr-naver-app-logo-140.png` (140×140, 2KB, Downloads에 생성 완료)
- [x] Callback URL 등록 — 정식 도메인 포함 4개 완료
  - `http://localhost:3000/api/auth/naver/callback`
  - `https://goodthings-roasters.vercel.app/api/auth/naver/callback`
  - `https://goodthings-roasters.com/api/auth/naver/callback`
  - `https://goodthingsroasters.com/api/auth/naver/callback`
- [ ] (확인) 제공정보에 이메일·이름 동의 항목 설정돼 있는지

콘솔: developers.naver.com → 내 애플리케이션 → Good Things Roasters → API 설정

---

## 3. 카카오 (Kakao)

현재 상태: **정상 작동 중** (현재 운영 도메인 `goodthings-roasters.com`에서 로그인 확인됨). 이메일 미수집(닉네임·프로필이미지만) → 비즈앱 전환·검수 불필요로 추정.

- [ ] **정식 도메인 전환 시** 아래 두 곳에 정식 도메인 추가:
  - [ ] 카카오 로그인 Redirect URI: `https://goodthingsroasters.com/api/auth/kakao/callback`
  - [ ] JavaScript SDK 도메인: `https://goodthingsroasters.com` (이미 등록돼 있으면 생략)
- [ ] (확인) 카카오 Redirect URI에 현재 운영 도메인 콜백이 실제로 들어있는지 (정상 작동 중이므로 등록돼 있다고 추정)

콘솔: developers.kakao.com → 앱 설정 → 플랫폼 키 / 카카오 로그인

---

## 4. 구글 (Google)

현재 상태: Supabase 네이티브. 콜백은 Supabase 고정이라 Google 콘솔 Redirect URI는 도메인과 무관.

- [ ] **Supabase Redirect URLs 등록**: Supabase 대시보드 → Authentication → URL Configuration → Redirect URLs 에 정식 도메인 추가
  - `https://goodthingsroasters.com/**` (코드의 `redirectTo`가 우리 도메인이라 허용목록에 없으면 막힘)
- [ ] **Google OAuth 동의 화면 게시 상태 확인**: `Testing`이면 등록된 테스트 사용자만 가능 → **"앱 게시(In production)"** 로 전환
  - email/profile 기본 scope만 사용 → Google 별도 검증(verification) 불필요 추정. 게시 토글만으로 충분할 것
- [ ] (확인) Google Cloud Console Authorized redirect URIs에 Supabase 콜백(`…supabase.co/auth/v1/callback`)이 등록돼 있는지

콘솔: console.cloud.google.com (OAuth 동의 화면 / 사용자 인증 정보) + Supabase 대시보드

---

## 5. 출시 후 검증 (정식 도메인 + 승인 완료 후)

각 프로바이더를 **멤버/테스터로 등록되지 않은 일반 계정**으로 실제 로그인 테스트:

- [ ] 네이버: 정식 도메인에서 동의화면 정상 → 로그인 → 세션 생성
- [ ] 카카오: 정식 도메인에서 로그인 정상
- [ ] 구글: 정식 도메인에서 로그인 정상 (게시 후)
- [ ] 신규 가입·기존 계정 병합 동작 (ADR-001 정책) 정상
- [ ] 로그아웃·재로그인 정상

---

## 확신도 표기

- ✅ 확인됨 / 🔶 추정(검증 필요) / ❓ 미확인
- 카카오 검수 불필요, 구글 검증 불필요는 🔶 — 정식 오픈 시 각 콘솔 안내 재확인 권장.
