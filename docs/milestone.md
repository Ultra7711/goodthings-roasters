# GTR 프로젝트 마일스톤

> Good Things Roasters 웹사이트 프로젝트의 진행 상태를 추적합니다.
>
> **운용 모드:** 이미지 모드 (Photoshop 기반 시안 + 마크다운 스펙 문서)
> **최종 업데이트:** 2026-04-10 (pixel-port 재이식 시작: P-0 자산 이식 완료 — next/public/images/ 140파일 이관)

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
| Phase 2 — Frontend | 2 | 0 | 2 | 0 | ~30% |
| Phase 3 — Backend | 3 | 0 | 0 | 3 | 0% |
| Phase 4 — Infrastructure | 1 | 0 | 1 | 0 | ~20% |
| Phase 5 — Quality Assurance | 3 | 0 | 0 | 3 | 0% |
| User AI | 1 | 0 | 0 | 1 | 0% |

**현재 위치: Phase 1 — Design 100% 완료 → Phase 2 Next.js 전환 준비**

---

## Phase 1 — Design

### 1. Research ✅

리서치 전 과정의 계획, 수집, 분석, 아카이빙.

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

브랜드 가이드 기반 카피 작성과 라이팅 품질 검수.

| 항목 | 상태 | 산출물 | 비고 |
|------|------|--------|------|
| 보이스 & 톤 가이드 | ✅ | `docs/gtr-design-guide.md` Part 7 | "차분한 자신감" 톤 정의 |
| 섹션별 카피 시트 | ✅ | `docs/ux-writing-v1.md` | 페이지별 헤드라인·본문·CTA 카피 (상세) |
| CTA 가이드 | ✅ | `docs/gtr-design-guide.md` Part 7 | 버튼 레이블·마이크로카피 패턴 |
| 에러 메시지 가이드 | ✅ | `docs/ux-writing-v1.md` | 입력 검증·시스템 에러 메시지 톤 |
| 용어 / 맞춤법 검수 | ✅ | — | 영문: sentence case, 한글 브랜드명: 굳띵즈 |

---

### 3. Critique ✅

디자인 품질을 다각도로 피드백하고 QA.

| 항목 | 상태 | 산출물 | 비고 |
|------|------|--------|------|
| 디자인 크리틱 | ✅ | — | 5관점 디자인 비평 기반 전면 교정 완료 |
| UX 크리틱 | ✅ | — | 프로토타입 구현 과정에서 사용자 흐름 검증 완료 |
| UI 크리틱 | ✅ | `docs/design-qa-report.md` | 코드 레벨 토큰 일관성 감사 + 비주얼 검증 완료 |
| 브랜드 일관성 검증 | ✅ | — | 브랜드명 통일(굳띵즈), 컬러·폰트·모션 토큰 전면 교정 |
| 디자인 QA | ✅ | `docs/design-qa-report.md` | ~250건 하드코딩→토큰 치환, 10페이지 비주얼 검증 완료 |

---

### 4. UI Design ✅

UI 생성, 반응형 변환, 인터랙션 설계.

| 항목 | 상태 | 산출물 | 비고 |
|------|------|--------|------|
| 컬러 시스템 | ✅ | `docs/gtr-design-guide.md` Part 1 | Warm-shifted B&W 토큰 체계, 구현 완전 일치 |
| 타이포그래피 스케일 | ✅ | `docs/gtr-design-guide.md` Part 2 | Display~Label 15단계 + Caption 토큰 신규 |
| 스페이싱 & 그리드 | ✅ | `docs/gtr-design-guide.md` Part 3 | 4px 기반, 4 브레이크포인트 |
| 모션 토큰 | ✅ | `docs/gtr-design-guide.md` Part 4 | 6 duration + 4 easing 토큰 |
| Z-index 체계 | ✅ | `docs/gtr-design-guide.md` Part 5 | 8단계 레이어 토큰 |
| 컴포넌트 토큰 | ✅ | `docs/gtr-design-guide.md` Part 6 | CTA·Tab·TextLink·CloseBtn·Arrow·Icon |
| 브랜드 에센스 | ✅ | `docs/gtr-design-guide.md` Part 0 | 차별점·전환 목표·UX 원칙 통합 |
| 아이콘 시스템 | ✅ | `goodthings_v1.0.html` + `images/icons/` | inline SVG 전환 완료, 상태별 아이콘 분기 (location_add/change 등) |
| 레이아웃 와이어프레임 | ✅ | `docs/layout-wireframe-v2.md`, `.html` | 데스크탑 + 모바일, 실제 구현값 반영 v2.1 |
| 인터랙션 스펙 | ✅ | `docs/gtr-design-guide.md` Part 4 | 모션 토큰 + 안티패턴 정의 |
| ~~Photoshop 시안 제작~~ | ➖ | — | HTML 프로토타입으로 대체 완료 |
| ~~모바일 시안 제작~~ | ➖ | — | Next.js 전환 시 반응형 구현으로 대체 |

---

### 5. Handoff ✅

디자인에서 개발로의 스펙 전달.

| 항목 | 상태 | 산출물 | 비고 |
|------|------|--------|------|
| 디자인 토큰 파일 (CSS) | ✅ | `goodthings_v1.0.html` :root | 179개 토큰 (컬러 4개 신규 추가), ~320건 하드코딩 치환 완료 |
| 컴포넌트 명세서 | ✅ | `docs/prototype-handoff.md` | 12 서브 페이지, 7 드로어/패널, 9 데이터 구조, 40+ 상태 함수 |
| 상태별 동작 스펙 | ✅ | `docs/prototype-handoff.md` | 페이지 열기/닫기 패턴, 카트, 검색 4계층, 폼 5종, 애니메이션 |
| 핸드오프 스펙 문서 | ✅ | `docs/prototype-handoff.md` | 14개 섹션, Next.js 전환 결정 사항 포함 |
| 접근성 기초 적용 | ✅ | `goodthings_v1.0.html` | aria-label 7개, skip-nav, 갤러리 alt, 검색 label |

---

## Phase 2 — Frontend

### 6. Frontend Development 🔄

디자인 스펙을 실제 코드로 구현.

| 항목 | 상태 | 산출물 | 비고 |
|------|------|--------|------|
| HTML 프로토타입 | ✅ | `goodthings_v1.0.html` (11,100+ lines) | 12 서브 페이지, 검색 시스템, 장바구니, 결제, 마이페이지, 주문완료 UI |
| CSS 디자인 토큰 적용 | ✅ | CSS Custom Properties | 컬러·폰트·letter-spacing·모션·z-index 179개 + 스페이싱 14+5 토큰 체계 완비 |
| 인터랙션 / 애니메이션 | ✅ | 프로토타입 내 JS/CSS | 히어로 비디오, 스크롤 리빌, 드로어, 오버레이, 크로스페이드, 토스트 시스템 |
| Next.js 프로젝트 셋업 | ✅ | `next/` | Tailwind v4 + 179 토큰 이관 완료 |
| 공통 레이아웃 (Header/Footer) | ✅ | `next/src/components/` | 글래스모피즘 헤더, 푸터, 어나운스바, 코드 리뷰 8건 반영 |
| 상태 관리 (Zustand) | ✅ | `next/src/lib/store.ts` | 장바구니·인증 스토어 + Header 직접 연동 |
| UI 베이스 컴포넌트 | ✅ | `next/src/components/ui/` | Button·Input·Tabs·Badge 4종, 리뷰 8건 수정 반영 |
| 페이지 라우팅 셋업 | ✅ | `next/src/app/` | /story, /menu, /shop, /gooddays 4개 라우트 + Metadata SEO |
| 상품 컴포넌트 | ✅ | `next/src/components/product/` | ProductCard·ProductGrid — IO 스크롤 리빌, 리뷰 13건 수정 완료 |
| 메뉴 컴포넌트 | ✅ | `next/src/components/menu/` | MenuCard·MenuGrid·NutritionDrawer — Tabs 필터 + 온도 배지 + 540px 우측 슬라이드인 영양정보 드로어(Radix Dialog), 리뷰 수정 완료 |
| 갤러리 컴포넌트 | ✅ | `next/src/components/gallery/` | GalleryGrid·Cell·Lightbox·GalleryClient — 벤토 5패턴, 리뷰 수정 완료 |
| 공통 히어로 컴포넌트 | ✅ | `next/src/components/layout/PageHero` | 3개 페이지 DRY 추출, CSS Module 토큰 적용 |
| 복합 UI 컴포넌트 (2-A) | ✅ | `next/src/components/ui/` | Drawer·Modal·Toast + Pretendard 로컬 폰트, R-1 리뷰 9건 수정, 스페이싱 토큰 적용 |
| 상품 상세 페이지 (2-B) | ✅ | `next/src/components/product/`, `next/src/app/shop/[slug]/` | ImageGallery·PurchaseOptions·RadarChart·RoastStage·RecipeGuide·ProductAccordion 11컴포넌트, SSG 6상품, R-2 리뷰 7건 수정 |
| 장바구니·체크아웃 (2-C) | ✅ | `next/src/components/cart/`, `next/src/components/checkout/`, `next/src/components/order/`, `next/src/app/(checkout)/` | CartDrawer(4)·CheckoutForm(5)·OrderComplete 13컴포넌트 + Route Group `(main)`/`(checkout)` 분리 + H6 Header `openDrawer` 직접 연동, R-3 리뷰 HIGH 5건 + MEDIUM 2건 수정 |
| 로그인·마이페이지 (2-D) | ✅ | `next/src/app/(main)/login/`, `next/src/app/(main)/mypage/`, `next/src/components/login/`, `next/src/components/mypage/`, `next/src/components/ui/ConfirmModal.tsx`, `next/src/hooks/{useLoginForm,useRegisterForm,useAuthGuard,useAddressForm,usePasswordChangeForm}.ts`, `next/src/lib/formHelpers.ts` | LoginForm·RegisterForm·PasswordResetForm·GuestLookupForm + MyPageView(Account·Subscription·Manage·OrderList) + ConfirmModal + `useAuthGuard`(`useSyncExternalStore` 기반 SSR 안전, `/mypage` static prerender 복구). R-4 리뷰 HIGH 9건 수정 완료 (PII 최소화·inert·중첩 interactive·비동기 모달). **묶음 보강 (2026-04-10):** (1) `formHelpers.focusNextOnEnter` 유틸 신규, IME 조합 가드 포함 → LoginForm·RegisterForm·ManageSection 비밀번호 변경 폼에 Enter 키 다음 필드 이동 적용, (2) `useAuthGuard.bypassRedirect()` 추가 → MyPageView 로그아웃 시 `/login` 튐 레이스 수정(호출 순서 `bypassRedirect → logout → router.replace('/')`). 동적 helper text·실시간 validation 리팩토링은 이월. |
| 플로우 복구 (2-E) | 🔄 | `next/src/app/(main)/cart/`, `next/src/components/cart/{CartPageView,CartPageRow}.*`, `next/src/lib/cartCalc.ts` | **2-E-1 ✅** `/cart` 풀페이지: CartPageView·CartPageRow 신규, `lib/cartCalc.ts` 공용 계산기로 DRY(드로어/풀페이지 공유), CartEmpty `variant='page'` 확장. **2-E-2 ✅** CartDrawer 푸터 `[장바구니 보기][주문하기]` 2버튼, `useProductPurchase` 상품 담기 시 `openDrawer()` 자동 호출 흡수. **2-E-3 ✅** 정적 에셋 이관 `public/images/{gallery,cafe-menu,icons,...}` (pixel-port P-0, 2026-04-10). **2-E-4 ⬜** `/biz-inquiry` B2B 폼. 런타임 검증은 2-E 전체 완료 후 일괄 수행. |
| 검색 시스템 + 콘텐츠 (2-F) | ⬜ | — | **검색 엔진 코어** `lib/search/{constants,normalize,chosung,matcher,engine}` (4-layer + `SEARCH_SYNONYMS` + `CAT_LABEL` + 단음절 규칙 + NFC 재조합) + Vitest TDD 80%↑, **검색 오버레이 + `/search` SRP** (`.has-panel` 토글, Radix early return 금지), **콘텐츠 채우기**: GoodDays 갤러리 22장 연결 / Story 섹션 / MyPage ManageSection 실콘텐츠 |
| 반응형 + 프로덕션 (2-G) | ⬜ | — | **반응형 일괄**: 카페 메뉴 카드 터치(`project_cat_card_hover_responsive`) / 영양정보 모바일 인라인 아코디언(`project_nutrition_panel_responsive`) / 구매 옵션 행(`project_purchase_row_responsive`) + 4 브레이크포인트(360/768/1024/1440) 회귀 점검. **프로덕션 전 필수 처리** 5건(H3·H4·H5·H6·M7) 잔여 마감. **`useFormValidation` 훅 통일** (`project_nextjs_form_validation`) — 로그인/회원가입/체크아웃/주소/비번/비즈문의 6개 폼 마이그레이션 |

---

### 7. Content & Asset 🔄

디자인 에셋 최적화·체계화와 콘텐츠 데이터 바인딩.

| 항목 | 상태 | 산출물 | 비고 |
|------|------|--------|------|
| 이미지 최적화 (WebP/AVIF) | 🔄 | 프로토타입 내 일부 WebP | 본격 파이프라인 미구축 |
| 아이콘 시스템 | ✅ | `goodthings_v1.0.html` inline SVG | Lucide 기반 inline SVG + `--color-icon-default` 토큰, 원본 SVG 파일 `images/icons/` 동기화 |
| 콘텐츠 매핑 (DB↔UI) | ⬜ | — | Supabase 스키마 확정 후 설계 |

---

### 🔒 프로덕션 전 필수 처리 (코드 리뷰 지적 사항)

> 3명 리뷰어(code-reviewer, typescript-reviewer, security-reviewer) 교차 검증에서 도출된 항목.
> 각 항목은 해당 작업 단계에서 반드시 함께 처리한다.

| ID | 이슈 | 처리 시점 | 담당 작업 | 상태 |
|----|------|-----------|-----------|------|
| H3 | 사업자 정보(휴대폰·이메일) 소스코드 하드코딩 → 환경변수/DB 이관 | Phase 2-G — 프로덕션 마무리 | `.env.local` 임시 이관 → Phase 3에서 DB 이관 | ⬜ |
| H4 | Pretendard CDN — SRI 미적용 → 로컬 폰트 전환 | Phase 2-A — 복합 UI 시 | `next/font/local`로 전환, CDN 의존 제거 | ✅ |
| H5 | Footer 전체 `'use client'` → Server/Client 분리 | Phase 2-B — 상품 상세 시 | `BizInfoToggle` 분리, Footer 셸은 Server Component | ✅ |
| H6 | Header 정적 부분이 클라이언트 번들에 포함 → 경계 재설계 | Phase 2-C — 장바구니 시 | Header가 `useCartStore.openDrawer` 직접 구독, `onCartClick` prop 제거 | ✅ |
| M7 | CSP 등 보안 응답 헤더 미설정 | Phase 2-G — 프로덕션 마무리 | `next.config.ts` headers() 설정 | ⬜ |

---

### 🔍 코드 리뷰 계획

> 각 단계 구현 완료 직후 리뷰를 실행하고, 지적 사항 반영 후 커밋한다.
> 결제·인증 관련 단계는 security-reviewer를 추가 투입한다.

| 순서 | 대상 | 리뷰어 | 보안 리뷰 | 상태 |
|------|------|--------|----------|------|
| R-0a | 상품 컴포넌트 (ProductCard·ProductGrid) | ts-reviewer + code-reviewer | — | ✅ H5 M6 수정 |
| R-0b | 메뉴 컴포넌트 (MenuCard·MenuGrid) | ts-reviewer + code-reviewer | — | ✅ H9 M4 수정 |
| R-0c | 갤러리 컴포넌트 (GalleryGrid·Cell·Lightbox) | ts-reviewer + code-reviewer | — | ✅ H6 M5 수정 |
| R-1 | 복합 UI (2-A: Drawer·Modal·Toast) | ts-reviewer + code-reviewer | — | ✅ H3 M5 수정 |
| R-2 | 상품 상세 (2-B: Gallery·Purchase·Tabs·Nutrition) | ts-reviewer + code-reviewer | — | ✅ H5 M3 수정 |
| R-3 | 장바구니·체크아웃 (2-C: CartDrawer·CheckoutForm) | ts-reviewer + code-reviewer | ✅ security | ✅ HIGH 5 + MEDIUM 2 수정 |
| R-4 | 로그인·마이페이지 (2-D: LoginForm·MyPage) | ts-reviewer + code-reviewer | ✅ security | ✅ HIGH 9 수정 |
| R-5 | 플로우 복구 (2-E: `/cart`·CartDrawer 2버튼·에셋·`/biz-inquiry`) | ts-reviewer + code-reviewer | — | ⬜ |
| R-6 | 검색 시스템 + 콘텐츠 (2-F: 검색 엔진·오버레이·SRP·Story/GoodDays/MyPage) | ts-reviewer + code-reviewer | ✅ security (검색 입력 XSS) | ⬜ |
| R-7 | 반응형 + 프로덕션 (2-G: 반응형·체크리스트 5건·useFormValidation) | ts-reviewer + code-reviewer | ✅ security (CSP) | ⬜ |

**R-0a~c**: 완료 (2026-04-10). ts-reviewer ×3 + code-reviewer 병렬 실행, HIGH 13건 + MEDIUM 5건 수정 반영.
**R-1**: 완료 (2026-04-10). ts-reviewer + code-reviewer 병렬 실행, HIGH 3건 + MEDIUM 5건 + LOW 3건 수정 반영. 포커스 관리·접근성 대비·토큰 수정·타입 안전성 개선.
**R-2**: 완료 (2026-04-10). ts-reviewer + code-reviewer 병렬 실행, HIGH 5건 + MEDIUM 3건 수정 반영. setTimeout cleanup·ARIA role 충돌·useEffect 의존성·aria-controls·alt 텍스트·use client 경계 명시.
**R-3**: 완료 (2026-04-10). ts-reviewer + security-reviewer 병렬 실행, HIGH 5건 + MEDIUM 2건 수정. OrderCompleteClient `useRef`→`useState` (ESLint react-hooks/refs 블록), 이메일 형식 정규식, 전화번호 형식 정규식, 비회원 비밀번호 최소 길이(4자), `FREE_SHIPPING_THRESHOLD`/`SHIPPING_FEE` 상수 `lib/store`에서 단일 export, `extractKrName` 유틸 `lib/utils`로 추출. 백엔드 연동 전 필수 처리(평문 비밀번호·서버 재검증·주문번호 서버 생성·CSP 헤더)는 Phase 2-F로 이관.
**R-4**: 완료 (2026-04-10). typescript-reviewer + code-reviewer + security-reviewer 병렬 실행, HIGH 9건 수정. (1) ConfirmModal 비동기 `onConfirm` 지원 + `isPending` 상태로 ESC/overlay 닫기 차단, (2) Level 2 PII 최소화 — localStorage에 `{isLoggedIn, displayName}`만 저장, user 객체는 메모리 only, (3) 크로스 스토어 `purgeSession()` 헬퍼로 로그아웃 시 authStorage + cartStorage 동시 클리어, (4-5) 데모 크리덴셜/유저 명백한 placeholder화 (`demo@goodthings.test` / `010-0000-0000`), (6) 아코디언 3종 `aria-hidden`+`tabIndex` → React 19 `inert` 속성 전환, (7) OrderCard 중첩 interactive HTML 위반 수정 (meta 행을 토글 버튼 바깥으로 분리), (8) `useAuthGuard` zustand persist unsubscribe 타입 가드 (NOOP fallback), (9) `/mypage` Static prerender (`useSyncExternalStore` 기반 SSR 안전). TypeScript pass · ESLint 0 errors · next build 성공 · 런타임 검증 (Claude Preview MCP) 완료.

---

## Phase 3 — Backend

### 8. Data & API ⬜

| 항목 | 상태 | 비고 |
|------|------|------|
| DB 스키마 설계 | ⬜ | 상품·주문·유저 테이블 설계 필요 |
| API 엔드포인트 설계 | ⬜ | Next.js Route Handler 구조 |
| API 구현 | ⬜ | — |
| RLS 정책 | ⬜ | Supabase Row Level Security |

### 9. Auth & Security ⬜

| 항목 | 상태 | 비고 |
|------|------|------|
| 인증 플로우 설계 | ⬜ | Supabase Auth (이메일 + 소셜 로그인) |
| RBAC / 인가 정책 | ⬜ | — |
| 보안 감사 | ⬜ | 개발 완료 후 실시 |

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
| `docs/ecc-workflow-guide.md` | — | ECC 워크플로우 가이드 (product-design-agent 대체) |

---

## 다음 단계 로드맵

```
현재 위치
    ↓
┌─────────────────────────────────────────────────────┐
│  Phase 1 — Design ✅ 완료                              │
│                                                       │
│  ① HTML 프로토타입 UI 폴리싱 ✅                        │
│  ② UI Critique + Design QA 검수 ✅                     │
│  ③ Handoff 스펙 문서 작성 ✅                            │
│  ④ 접근성 기초 적용 ✅                                  │
│  ⑤ 코드 리뷰 (XSS 수정, 토큰 치환, 중복 제거) ✅      │
└──────────────────────────┬──────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────┐
│  Phase 2 — Frontend                                   │
│                                                       │
│  ⑥ Next.js 프로젝트 스캐폴딩 (App Router)             │
│  ⑦ React 컴포넌트 전환 (Radix UI 기반)                │
│  ⑧ 이미지 파이프라인 (WebP/AVIF, srcset)              │
│  ⑨ 반응형 구현                                        │
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
