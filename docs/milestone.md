# GTR 프로젝트 마일스톤

> Good Things Roasters 웹사이트 프로젝트의 진행 상태를 추적합니다.
>
> **운용 모드:** 이미지 모드 (Photoshop 기반 시안 + 마크다운 스펙 문서)
> **최종 업데이트:** 2026-04-16 (P2-1 완료 — Zustand 더미 auth action 제거 + logout/updatePassword Supabase 직접 연동 + 코드리뷰 반영(signOut 에러처리·에러메시지 한국화·모달 문구 수정). 다음: P2-2 RLS — Phase 3 스키마 설계 시 처리)

---

## 범례

| 기호 | 의미 |
|------|------|
| ✅ | 완료 |
| 🔄 | 진행 중 |
| ⬜ | 미착수 |
| ➖ | 해당 없음 / 스킵 |

---

## 전체 요약

| Phase | 그룹 수 | 완료 | 진행 중 | 미착수 | 진행률 |
|-------|---------|------|---------|--------|--------|
| Phase 1 — Design | 5 | 5 | 0 | 0 | 100% |
| Phase 2 — Frontend | 2 | 0 | 2 | 0 | ~80% |
| Phase 3 — Backend | 3 | 0 | 1 | 2 | ~5% |
| Phase 4 — Infrastructure | 1 | 0 | 1 | 0 | ~20% |
| Phase 5 — Quality Assurance | 3 | 0 | 0 | 3 | 0% |
| User AI | 1 | 0 | 0 | 1 | 0% |

**현재 위치: Phase 2-F P2-1 완료 — Zustand 더미 auth action 제거 + logout/updatePassword Supabase 직접 연동. 다음: P2-2 RLS (Phase 3 스키마 설계 후)**

---

## Phase 1 — Design

### 1. Research ✅

| 항목 | 상태 | 산출물 | 비고 |
|------|------|--------|------|
| 리서치 설계 | ✅ | `docs/archive/research-plan-v1.md` | 4트랙 리서치 프레임워크 수립 |
| 경쟁사 벤치마킹 | ✅ | `docs/archive/research/track-a-*.md` | 동종 커피 브랜드 웹사이트 비교 분석 |
| UX 벤치마킹 | ✅ | `docs/archive/research/track-b-*.md` | UX 패턴 비교 분석 |
| 브랜드 포지셔닝 | ✅ | `docs/archive/research/track-c-*.md` | 브랜드 스펙트럼·차별화 포인트 |
| 타겟 유저 분석 | ✅ | `docs/archive/research/track-d-*.md` | 페르소나·유저 시나리오 |
| 리서치 프레젠테이션 | ✅ | `docs/archive/gtr-research-presentation.*` | 23슬라이드 통합 리포트 |
| 설문/인터뷰 분석 | ➖ | — | 실제 유저 데이터 없음 (1인 프로젝트) |

---

### 2. UX Writing ✅

| 항목 | 상태 | 산출물 | 비고 |
|------|------|--------|------|
| 보이스 & 톤 가이드 | ✅ | `docs/gtr-design-guide.md` Part 7 | "차분한 자신감" 톤 정의 |
| 섹션별 카피 시트 | ✅ | `docs/ux-writing-v1.md` | 페이지별 헤드라인·본문·CTA 카피 (상세) |
| CTA 가이드 | ✅ | `docs/gtr-design-guide.md` Part 7 | 버튼 레이블·마이크로카피 패턴 |
| 에러 메시지 가이드 | ✅ | `docs/ux-writing-v1.md` | 입력 검증·시스템 에러 메시지 톤 |
| 용어 / 맞춤법 검수 | ✅ | — | 영문: sentence case, 한글 브랜드명: 굳띵즈 |

---

### 3. Critique ✅

| 항목 | 상태 | 산출물 | 비고 |
|------|------|--------|------|
| 디자인 크리틱 | ✅ | — | 5관점 디자인 비평 기반 전면 교정 완료 |
| UX 크리틱 | ✅ | — | 프로토타입 구현 과정에서 사용자 흐름 검증 완료 |
| UI 크리틱 | ✅ | `docs/design-qa-report.md` | 코드 레벨 토큰 일관성 감사 + 비주얼 검증 완료 |
| 브랜드 일관성 검증 | ✅ | — | 브랜드명 통일(굳띵즈), 컬러·폰트·모션 토큰 전면 교정 |
| 디자인 QA | ✅ | `docs/design-qa-report.md` | ~250건 하드코딩→토큰 치환, 10페이지 비주얼 검증 완료 |

---

### 4. UI Design ✅

| 항목 | 상태 | 산출물 | 비고 |
|------|------|--------|------|
| 컬러 시스템 | ✅ | `docs/gtr-design-guide.md` Part 1 | Warm-shifted B&W 토큰 체계, 구현 완전 일치 |
| 타이포그래피 스케일 | ✅ | `docs/gtr-design-guide.md` Part 2 | Display~Label 15단계 + Caption 토큰 신규 |
| 스페이싱 & 그리드 | ✅ | `docs/gtr-design-guide.md` Part 3 | 4px 기반, 4 브레이크포인트 |
| 모션 토큰 | ✅ | `docs/gtr-design-guide.md` Part 4 | 6 duration + 4 easing 토큰 |
| Z-index 체계 | ✅ | `docs/gtr-design-guide.md` Part 5 | 8단계 레이어 토큰 |
| 컴포넌트 토큰 | ✅ | `docs/gtr-design-guide.md` Part 6 | CTA·Tab·TextLink·CloseBtn·Arrow·Icon |
| 브랜드 에센스 | ✅ | `docs/gtr-design-guide.md` Part 0 | 차별점·전환 목표·UX 원칙 통합 |
| 아이콘 시스템 | ✅ | `goodthings_v1.0.html` + `images/icons/` | inline SVG 전환 완료, 상태별 아이콘 분기 |
| 레이아웃 와이어프레임 | ✅ | `docs/layout-wireframe-v2.md`, `.html` | 데스크탑 + 모바일, 실제 구현값 반영 v2.1 |
| 인터랙션 스펙 | ✅ | `docs/gtr-design-guide.md` Part 4 | 모션 토큰 + 안티패턴 정의 |
| ~~Photoshop 시안 제작~~ | ➖ | — | HTML 프로토타입으로 대체 완료 |
| ~~모바일 시안 제작~~ | ➖ | — | Next.js 전환 시 반응형 구현으로 대체 |

---

### 5. Handoff ✅

| 항목 | 상태 | 산출물 | 비고 |
|------|------|--------|------|
| 디자인 토큰 파일 (CSS) | ✅ | `goodthings_v1.0.html` :root | 179개 토큰, ~320건 하드코딩 치환 완료 |
| 컴포넌트 명세서 | ✅ | `docs/prototype-handoff.md` | 12 서브 페이지, 7 드로어/패널, 9 데이터 구조, 40+ 상태 함수 |
| 상태별 동작 스펙 | ✅ | `docs/prototype-handoff.md` | 페이지 열기/닫기 패턴, 카트, 검색 4계층, 폼 5종, 애니메이션 |
| 핸드오프 스펙 문서 | ✅ | `docs/prototype-handoff.md` | 14개 섹션, Next.js 전환 결정 사항 포함 |
| 접근성 기초 적용 | ✅ | `goodthings_v1.0.html` | aria-label 7개, skip-nav, 갤러리 alt, 검색 label |

---

## Phase 2 — Frontend

### 6. Frontend Development 🔄

| 항목 | 상태 | 산출물 | 비고 |
|------|------|--------|------|
| HTML 프로토타입 | ✅ | `goodthings_v1.0.html` (11,100+ lines) | 12 서브 페이지, 검색 시스템, 장바구니, 결제, 마이페이지, 주문완료 UI |
| CSS 디자인 토큰 | ✅ | CSS Custom Properties | 컬러·폰트·letter-spacing·모션·z-index 179개 + 스페이싱 14+5 토큰 체계 |
| 인터랙션 / 애니메이션 | ✅ | 프로토타입 내 JS/CSS | 히어로 비디오, 스크롤 리빌, 드로어, 오버레이, 크로스페이드, 토스트 |
| Next.js 프로젝트 셋업 | ✅ | `next/` | Tailwind v4 + 179 토큰 이관 완료 |
| 공통 레이아웃 (Header/Footer) | ✅ | `next/src/components/` | 글래스모피즘 헤더, 푸터, 어나운스바, 코드 리뷰 반영 |
| 상태 관리 (Zustand) | ✅ | `next/src/lib/store.ts` | 장바구니·인증 스토어 + Cart persist(localStorage) |
| UI 베이스 컴포넌트 | ✅ | `next/src/components/ui/` | TextField·Textarea·Button·Tabs·Badge 등, 코드 리뷰 반영 |
| 페이지 라우팅 | ✅ | `next/src/app/` | /story, /menu, /shop, /gooddays + Metadata SEO |
| 상품 컴포넌트 | ✅ | `next/src/components/product/` | ProductCard·ProductGrid — IO 스크롤 리빌, 리뷰 반영 |
| 메뉴 컴포넌트 | ✅ | `next/src/components/menu/` | CafeMenuCard·CafeMenuGrid·NutritionDrawer — Tabs 필터, 영양정보 드로어(Radix) |
| 갤러리 컴포넌트 | ✅ | `next/src/components/gallery/` | GalleryGrid·Cell·Lightbox — 벤토 5패턴 |
| 공통 히어로 컴포넌트 | ✅ | `next/src/components/layout/PageHero` | 3개 페이지 DRY 추출 |
| 복합 UI (2-A) | ✅ | `next/src/components/ui/` | Drawer·Modal·Toast + Pretendard 로컬 폰트 |
| 상품 상세 (2-B) | ✅ | `next/src/components/product/`, `next/src/app/shop/[slug]/` | ImageGallery·PurchaseOptions·RadarChart·RoastStage·RecipeGuide·ProductAccordion, SSG 6상품 |
| 장바구니·체크아웃 (2-C) | ✅ | `next/src/components/cart/`, `next/src/components/checkout/`, `next/src/components/order/` | CartDrawer·CheckoutPage·OrderCompletePage, Route Group `(main)`/`(checkout)` 분리 |
| 로그인·마이페이지 (2-D) | ✅ | `next/src/app/(main)/login/`, `next/src/app/(main)/mypage/`, `next/src/components/auth/` | LoginForm·RegisterForm·MyPageView + ConfirmModal + `useAuthGuard`(SSR 안전) |
| 플로우 복구 (2-E) | ✅ | `next/src/app/(main)/cart/`, `next/src/components/biz/` | `/cart` 풀페이지, CartDrawer 2버튼, 정적 에셋 이관, `/biz-inquiry` B2B 폼 |
| 검색 시스템 + 콘텐츠 (2-F) | ⬜ | — | 검색 엔진 4-layer, 검색 오버레이 + SRP, GoodDays/Story/MyPage 콘텐츠 채우기 |
| 반응형 + 프로덕션 (2-G) | ⬜ | — | 4 브레이크포인트(360/768/1024/1440) 반응형, CSP·환경변수·빌드 최종화 |

---

### 7. Content & Asset 🔄

| 항목 | 상태 | 산출물 | 비고 |
|------|------|--------|------|
| 이미지 최적화 (WebP/AVIF) | 🔄 | 프로토타입 내 일부 WebP | 본격 파이프라인 미구축 |
| 아이콘 시스템 | ✅ | `goodthings_v1.0.html` inline SVG | Lucide 기반 inline SVG + `--color-icon-default` 토큰, `images/icons/` 동기화 |
| 콘텐츠 매핑 (DB↔UI) | ⬜ | — | Supabase 스키마 확정 후 설계 |

---

### 🔒 프로덕션 전 필수 처리

> 코드 리뷰에서 도출된 항목. 해당 작업 단계에서 반드시 함께 처리한다.

| ID | 이슈 | 처리 시점 | 상태 |
|----|------|-----------|------|
| H3 | 사업자 정보 소스코드 하드코딩 → 환경변수/DB 이관 | Phase 2-G | ⬜ |
| H4 | Pretendard CDN SRI 미적용 → 로컬 폰트 전환 | Phase 2-A | ✅ |
| H5 | Footer 전체 `'use client'` → Server/Client 분리 | Phase 2-B | ✅ |
| H6 | Header 정적 부분 클라이언트 번들 포함 → `useCartStore` 직접 구독 | Phase 2-C | ✅ |
| M7 | CSP 등 보안 응답 헤더 미설정 → `next.config.ts` headers() | Phase 2-G | ⬜ |
| **P0-1** | OAuth `state` 쿠키 미설정 → CSRF 방어 (Naver/Kakao 커스텀 라우트) | Phase 2-F (즉시) | ✅ |
| **P0-2** | Zustand `isLoggedIn` ↔ Supabase 세션 괴리 → `AuthSyncProvider` 브리지 | Phase 2-F (즉시) | ✅ |
| **P0-3** | magic link implicit flow race condition → `verifyOtp` 서버사이드 세션 발급 | Phase 2-F (즉시) | ✅ |
| **P0-4** | `useAuthGuard` Zustand 판정 → `getSession()` 폴백 안전망 | Phase 2-F (즉시) | ✅ |
| **P1-2** | 보호 라우트 클라이언트 가드 의존 → Server Component `supabase.auth.getUser()` 가드 도입 | Phase 2-F | ✅ |
| **P1-1** | IdP 이메일 검증(`email_verified`) 미확인 + 계정 병합 정책 부재 → ADR-001 코드 이행 | Phase 2-F | ✅ |

---

### 🔍 코드 리뷰 계획

> 각 단계 구현 완료 직후 리뷰 실행, 지적 사항 반영 후 커밋. 결제·인증 단계는 security-reviewer 추가 투입.

#### 원개발 단계 (R-x)

| 순서 | 대상 | 리뷰어 | 상태 |
|------|------|--------|------|
| R-0a~c | 상품·메뉴·갤러리 컴포넌트 | ts-reviewer + code-reviewer | ✅ HIGH 13 + MEDIUM 5 |
| R-1 | 복합 UI (2-A: Drawer·Modal·Toast) | ts-reviewer + code-reviewer | ✅ HIGH 3 + MEDIUM 5 |
| R-2 | 상품 상세 (2-B) | ts-reviewer + code-reviewer | ✅ HIGH 5 + MEDIUM 3 |
| R-3 | 장바구니·체크아웃 (2-C) | ts-reviewer + security-reviewer | ✅ HIGH 5 + MEDIUM 2 |
| R-4 | 로그인·마이페이지 (2-D) | ts-reviewer + code-reviewer + security-reviewer | ✅ HIGH 9 |
| R-5 | 플로우 복구 (2-E) + `/biz-inquiry` | ts-reviewer + code-reviewer | ⬜ |
| R-6 | 검색 시스템 + 콘텐츠 (2-F) | ts-reviewer + code-reviewer + security-reviewer | ⬜ |
| R-7 | 반응형 + 프로덕션 (2-G) | ts-reviewer + code-reviewer + security-reviewer | ⬜ |

#### pixel-port 재이식 (RP-x)

> `claude/pixel-port` 브랜치 — 각 Phase 완료 + 시각 확인 직후 3총사(ts-reviewer + code-reviewer + security-reviewer) 병렬 실행.

| 순서 | 대상 | 상태 |
|------|------|------|
| RP-1 | 공통 레이아웃 (Header·Footer·AnnouncementBar) | ✅ |
| RP-2 | 홈 섹션 7개 | ✅ |
| RP-3 | Shop 페이지 재이식 | ✅ |
| RP-4 | 상품 상세 재이식 | ✅ |
| RP-5 | 카페 메뉴 페이지 재이식 | ✅ |
| RP-6 | Story · BizInquiry · GoodDays 재이식 | ✅ |
| RP-7 | 체크아웃 + OrderComplete 재이식 | ✅ |
| RP-8 | 로그인 + MyPage 재이식 + 인풋필드 UX 전면 적용 | ✅ |
| RP-9 | TextField/Textarea 공통화 + 3총사 리뷰 Pass 1 | ✅ |
| RP-10 | 검색 시스템 4-layer 재이식 (TDD 80%↑) | ⬜ |
| RP-11 | 반응형(4 breakpoints) + 프로덕션 (CSP·환경변수·빌드) | ⬜ |

#### RP 완료 기록

**RP-1, RP-2** 완료 (2026-04-11): 3총사 병렬. HIGH 7건 + MEDIUM 2건 수정. useCallback 안정화·DOM 직접 조작 제거·BizToggle React state 전환·env var.

**RP-3** 완료 (2026-04-11~12, `18af1435`→`09365e43`): ts-reviewer + code-reviewer. HIGH 3건 + MEDIUM 2건 수정. Shop 재클릭 `resetTick` 패턴, backdrop-filter GPU 충돌 → inline style 우회. Deferred 4건(`docs/code-review-deferred.md`).

**RP-4** 완료 (2026-04-12, `a7b19102`): 3총사 병렬. HIGH 5건 수정. 데이터 소스 삼중화 제거(`lib/products.ts` canonical), RecipeGuide 컬러 일러스트 7종 이식, 전체 매진 엣지 케이스 처리.

**RP-5** 완료 (2026-04-12): 3총사 병렬. URL 쿼리 복구(`?cat=&item=`), React 19 `set-state-in-effect` 대응, ShopPage `bodyRef` → callback ref. Deferred 3건.

**RP-6** 완료 (2026-04-12, `d3aec51e`): Story·BizInquiry·GoodDays 재이식. 3총사 병렬. HIGH 3건 수정(setTimeout cleanup·body overflow 소유권·set-state-in-effect). same-page reentry 패턴(`gtr:*-reset` + `resetTick`). Deferred 6건.

**RP-7** 완료 (2026-04-12, `037946e7`): CheckoutPage + OrderCompletePage 재이식. PurchaseRow 장바구니 완전 연결. Cart persist(Zustand). 3총사 리뷰는 RP-9에서 일괄 처리.

**RP-8** 완료 (2026-04-13, `c87a9ea2`): LoginPage + MyPagePage 재이식. 인풋필드 UX 전면 적용 — blur 검증·자동 포맷(`usePhoneFormat`·`useOrderNumberFormat`)·아이콘 접근성. 전용 훅 7종 신규.

**RP-9** 완료 (2026-04-15, `8752d3b9`→`50e6820e`): (A-1) bi-field↔chp-field 통합·`TextField` 공통 컴포넌트 추출. (A-2) `SearchIcon`·`ClearIcon` 공통화. (A-3) `Textarea` 공통화·잔여 `.bi-*` CSS 정리. **3총사 리뷰 Pass 1** (RP-7~RP-9 전체 대상) — CRITICAL 2건(DEMO_CREDENTIALS dev-only 격리)·HIGH 7건(span→button 교체·스크롤 셀렉터 버그·타이머 ref·totalQty 구독 통일·formatPhone 중복·비밀번호 최소 길이·StoredOrderSummary 타입)·MEDIUM 12건(EMAIL_RE 강화·zipcode 검증·WARN_CLEARABLE_KEYS·매직 넘버 상수화·`as never` 제거 등) 수정. Deferred 5건(인증 구조·OAuth whitelist·비번 재설정 UX·파일 분리는 Phase 2-F 처리, PASSWORD_MAX_LENGTH 16 현행 유지).

---

## Phase 3 — Backend

### 8. Data & API ⬜

| 항목 | 상태 | 비고 |
|------|------|------|
| DB 스키마 설계 | ⬜ | 상품·주문·유저 테이블 설계 필요 |
| API 엔드포인트 설계 | ⬜ | Next.js Route Handler 구조 |
| API 구현 | ⬜ | — |
| RLS 정책 | ⬜ | Supabase Row Level Security |

### 9. Auth & Security 🔄

> **계획 문서:** `docs/oauth-security-plan.md` (P 시리즈 전체) · `docs/adr/ADR-001-oauth-account-merge-policy.md`
>
> **원칙:** 3-tier separation — Zustand(UI) / Supabase(Session) / Server+RLS(Security boundary). Zustand 는 UX 힌트일 뿐 보안 경계가 아니다.

| 항목 | 상태 | 비고 |
|------|------|------|
| 인증 플로우 설계 | ✅ | `docs/oauth-security-plan.md` + ADR-001 작성 완료 (2026-04-15) |
| **P0-1** OAuth state 쿠키 (CSRF) | ✅ | Naver/Kakao 콜백에 HttpOnly+SameSite=Lax CSRF 쿠키 검증·소비 구현 (2026-04-16) |
| **P0-2** AuthSyncProvider (Zustand↔Supabase 브리지) | ✅ | `onAuthStateChange` → Zustand 동기화. `app/layout.tsx` 최상위 마운트 (2026-04-16) |
| **P0-3** magic link race condition → verifyOtp 서버세션 | ✅ | `hashed_token` → `verifyOtp` 서버사이드 소비. `lib/supabaseServer.ts` 신규. Kakao·Naver·Google 3종 정상화 (2026-04-16) |
| **P0-4** useAuthGuard getSession 폴백 | ✅ | Zustand 미로그인 시 `supabase.auth.getSession()` 이중 확인 안전망 (2026-04-16) |
| **P1-2** 보호 라우트 Server Component 가드 | ✅ | `/mypage`·`/checkout` Server Component + `supabase.auth.getUser()` 서버 사이드 검증 완료 (2026-04-16) |
| **P1-1** 이메일 검증 + 계정 병합 (ADR-001 코드 이행) | ✅ | `lib/auth/{providers,syntheticEmail,accountMerge}.ts` 구현. Naver/Kakao/Google 3종 callback 연동 + LoginPage `account_conflict_*` 메시지. ADR §6.4 Google PKCE 제약 리뷰어 기록. **E2E 시나리오 1~3 통과** + `accountMerge.test.ts` Vitest 21 케이스 통과. Issue 1 Google `iss` fallback 탐지 + 자기참조 가드 수정 (2026-04-16) |
| **P2-1** Zustand 인증 상태 제거 (리팩터링) | ✅ | `logout`/`withdraw` → `supabase.auth.signOut()` 직접 연동. `updatePassword` → `supabase.auth.updateUser()` 연동. store.ts 더미 action(`logout`/`withdraw`/`updatePassword`) 제거. 코드리뷰 HIGH 2건·MEDIUM 4건 반영. (2026-04-16) |
| **P2-2** Supabase RLS 정책 | ⬜ | `orders`·`profiles`·`cart_items` 테이블에 `auth.uid()` 기반 정책 |
| ~~**P2-3**~~ generateLink 서버 세션 발급 | ✅ | P0-3에 흡수 완료 (verifyOtp 방식으로 달성) |
| **P3-1** OAuth 이벤트 로깅 | ⬜ | 로그인 성공/실패·CSRF 실패 이벤트 구조화 로깅 |
| **P3-2** 로그인/콜백 Rate Limiting | ⬜ | Upstash Redis + `@upstash/ratelimit` IP 단위 제한 |
| RBAC / 인가 정책 | ⬜ | admin/customer 역할 분리 — Phase 3-10 이후 |
| 최종 보안 감사 | ⬜ | P0~P2 완료 후 security-reviewer 전면 감사 |

### 10. Payment & Order ⬜

| 항목 | 상태 | 비고 |
|------|------|------|
| 토스페이먼츠 API 연동 | ⬜ | 결제 위젯·웹훅 구현 |
| 주문 프로세스 (상태 머신) | ⬜ | 장바구니→결제→확인→배송 |
| 정기배송 구독 엔진 | ⬜ | 정책 확정 대기 중 |

---

## Phase 4 — Infrastructure

### 11. DevOps & Deploy 🔄

| 항목 | 상태 | 산출물 | 비고 |
|------|------|--------|------|
| 인프라 스택 확정 | ✅ | `docs/GTR_infrastructure.md` | Vercel + Supabase + Resend + 토스페이먼츠 |
| 도메인 / DNS | ✅ | — | goodthingsroasters.com |
| 비용 구조 분석 | ✅ | `docs/GTR_infrastructure.md` | ~₩10,500/월 베이스라인 |
| Vercel 프로젝트 설정 | ⬜ | — | Next.js 프로젝트 생성 후 연결 |
| Supabase 프로젝트 설정 | ⬜ | — | DB·Auth·Storage 구성 |
| CI/CD 파이프라인 | ⬜ | — | Vercel 자동 배포 |
| 모니터링 / 에러 트래킹 | ⬜ | — | Sentry, Vercel Analytics |

---

## Phase 5 — Quality Assurance

### 12. Accessibility ⬜

| 항목 | 상태 | 비고 |
|------|------|------|
| WCAG 2.1 AA 자동 검수 | ⬜ | 개발 완료 후 실시 |
| 접근성 수정 적용 | ⬜ | — |

### 13. Performance & SEO ⬜

| 항목 | 상태 | 비고 |
|------|------|------|
| Core Web Vitals 분석 | ⬜ | 배포 후 측정 |
| 번들 최적화 | ⬜ | Next.js 빌드 최적화 |
| SEO (메타·구조화데이터) | ⬜ | — |

### 14. Testing & QA ⬜

| 항목 | 상태 | 비고 |
|------|------|------|
| 크로스 브라우저 QA | ⬜ | Chrome·Safari·Firefox·Edge |
| 시각적 회귀 테스트 | ⬜ | — |
| E2E 시나리오 테스트 | ⬜ | Playwright 기반 예정 |

---

## User AI

### 15. User AI ⬜

| 항목 | 상태 | 비고 |
|------|------|------|
| AI 페르소나 시뮬레이션 | ⬜ | 리서치 페르소나 기반 대화 검증 가능 |
| 유저 클론 검증 | ➖ | 실제 유저 데이터 필요 (서비스 출시 후) |

---

## 산출물 전체 맵

| 파일 | Phase | 그룹 |
|------|-------|------|
| `docs/archive/research-plan-v1.md` | 1-Design | Research |
| `docs/archive/research/track-*.md` (4개) | 1-Design | Research |
| `docs/archive/gtr-research-presentation.*` | 1-Design | Research |
| `docs/ux-writing-v1.md` | 1-Design | UX Writing |
| `docs/gtr-design-guide.md` (v2.0) | 1-Design | UI Design |
| `docs/gtr-design-guide.html` | 1-Design | UI Design |
| `docs/layout-wireframe-v2.md` (v2.1) | 1-Design | UI Design |
| `docs/layout-wireframe-v2.html` | 1-Design | UI Design |
| `docs/design-qa-report.md` | 1-Design | Critique (Design QA) |
| `docs/prototype-handoff.md` | 1-Design | Handoff |
| `goodthings_v1.0.html` | 2-Frontend | Frontend Dev |
| `docs/GTR_infrastructure.md` | 4-Infra | DevOps & Deploy |
| `docs/ecc-workflow-guide.md` | — | ECC 워크플로우 가이드 |

---

## 다음 단계 로드맵

```
현재 위치
    ↓
┌─────────────────────────────────────────────────────┐
│  Phase 1 — Design ✅ 완료                              │
└──────────────────────────┬──────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────┐
│  Phase 2 — Frontend (~80%)                            │
│                                                       │
│  ✅ 2-A~E: 공통 레이아웃·상품·메뉴·갤러리·            │
│            장바구니·결제·로그인·마이페이지·플로우      │
│  ✅ RP-1~9: pixel-port 재이식 + 3총사 리뷰 Pass 1    │
│  ⬜ 2-F: 검색 시스템 4-layer + 콘텐츠 채우기          │
│  ⬜ 2-G: 반응형(4 BP) + 프로덕션 마무리(CSP·env)     │
└──────────────────────────┬──────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────┐
│  Phase 3 — Backend                                    │
│                                                       │
│  ⑩ Supabase DB 스키마 설계 + RLS                      │
│  ⑪ API Route Handler 구현                             │
│  ⑫ Supabase Auth 연동 (이메일 + 소셜)                 │
│  ⑬ 토스페이먼츠 결제 연동                              │
│  ⑭ 주문 프로세스 상태 머신                             │
└──────────────────────────┬──────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────┐
│  Phase 4+5 — Infra & QA                               │
│                                                       │
│  ⑮ Vercel 배포 + 도메인 연결                           │
│  ⑯ 모니터링 (Sentry + Vercel Analytics)               │
│  ⑰ WCAG 2.1 AA 접근성 + Core Web Vitals              │
│  ⑱ 크로스 브라우저 QA + E2E 테스트                     │
└─────────────────────────────────────────────────────┘
```
