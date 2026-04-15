# GTR 프로젝트 마일스톤

> Good Things Roasters 웹사이트 프로젝트의 진행 상태를 추적합니다.
>
> **운용 모드:** 이미지 모드 (Photoshop 기반 시안 + 마크다운 스펙 문서)
> **최종 업데이트:** 2026-04-16 (Backend P0 완료 — Supabase CLI 도입 + 마이그레이션 9종 클라우드 dev 적용. 001~008 스키마 + 009 security_hardening(prevent_id_change search_path 고정 + orders 트리거 보정). 테이블 6/ENUM 5/RLS forced 6/정책 11/함수 6/트리거 11. Security·Performance advisors No issues. `docs/backend-architecture-plan.md` §11.5 모델 선택 가이드 실험 단계. 다음: P1 — @supabase/ssr + proxy.ts CSP + zod 검증)

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
| Phase 3 — Backend | 3 | 2 | 1 | 0 | ~45% |
| Phase 4 — Infrastructure | 1 | 0 | 1 | 0 | ~20% |
| Phase 5 — Quality Assurance | 3 | 0 | 0 | 3 | 0% |
| User AI | 1 | 0 | 0 | 1 | 0% |

**현재 위치: Backend P0 완료 — DB 스키마 9종 + RLS forced 6개 + 보안 하드닝(009) 클라우드 dev 적용. 다음: Backend P1 — @supabase/ssr 설정 + proxy.ts CSP + Route Handler + zod + Resend**

---

## Phase 1 — Design ✅ (완료 · 상세는 산출물 참조)

| 그룹 | 산출물 | 핵심 |
|------|--------|------|
| 1. Research | `docs/archive/research-plan-v1.md`, `research/track-a~d-*.md`, `gtr-research-presentation.*` | 4트랙 프레임워크 + 23슬라이드 리포트 |
| 2. UX Writing | `docs/ux-writing-v1.md`, `docs/gtr-design-guide.md` Part 7 | "차분한 자신감" 톤 + 페이지별 카피 시트 |
| 3. Critique | `docs/design-qa-report.md` | ~250건 하드코딩→토큰 치환, 10페이지 비주얼 검증 |
| 4. UI Design | `docs/gtr-design-guide.md` Part 0~6, `docs/layout-wireframe-v2.md`/`.html` | Warm-shifted B&W 토큰, 모션·Z-index·컴포넌트 토큰 |
| 5. Handoff | `docs/prototype-handoff.md`, `goodthings_v1.0.html` :root | 179개 토큰, 12 서브 페이지·7 드로어·40+ 상태 함수 명세 |

> Photoshop/모바일 별도 시안 ➖ — HTML 프로토타입 + Next.js 반응형으로 대체

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

### 🔒 프로덕션 전 필수 처리 (잔여)

> 완료 항목은 git log 참조. 미완만 잔존.

| ID | 이슈 | 처리 시점 | 상태 |
|----|------|-----------|------|
| H3 | 사업자 정보 소스코드 하드코딩 → 환경변수/DB 이관 | Phase 2-G | ⬜ |
| M7 | CSP 등 보안 응답 헤더 미설정 → `next.config.ts` headers() | Phase 2-G | ⬜ |

---

### 🔍 코드 리뷰 계획

> 각 Phase 완료 직후 리뷰어 병렬 실행, 지적 사항 반영 후 커밋. 결제·인증 단계는 security-reviewer 추가 투입. 상세 기록은 각 커밋 메시지·handover 메모리 참조.

#### 원개발 (R-x)

| 순서 | 대상 | 결과 |
|------|------|------|
| R-0a~c · R-1~R-4 | 상품·메뉴·갤러리·2-A~2-D 전체 | ✅ HIGH 35 + MEDIUM 15 수정 |
| R-5 | 2-E 플로우 복구 + `/biz-inquiry` | ⬜ (RP 재이식 이후 필요 시) |
| R-6 | 2-F 검색 + 콘텐츠 | ⬜ |
| R-7 | 2-G 반응형 + 프로덕션 | ⬜ |

#### pixel-port 재이식 (RP-x)

> `claude/pixel-port` 브랜치 — 각 RP 완료 + 시각 확인 직후 3총사(ts-reviewer + code-reviewer + security-reviewer) 병렬.

| 순서 | 대상 | 커밋 | 결과 |
|------|------|------|------|
| RP-1~2 | 공통 레이아웃 + 홈 섹션 7개 | 2026-04-11 | ✅ HIGH 7 + MEDIUM 2 |
| RP-3 | Shop 재이식 | `18af1435`→`09365e43` | ✅ HIGH 3 + MEDIUM 2 · Deferred 4 |
| RP-4 | 상품 상세 재이식 | `a7b19102` | ✅ HIGH 5 · `lib/products.ts` canonical |
| RP-5 | 카페 메뉴 재이식 | 2026-04-12 | ✅ URL 쿼리 복구 · Deferred 3 |
| RP-6 | Story · BizInquiry · GoodDays | `d3aec51e` | ✅ HIGH 3 · same-page reentry · Deferred 6 |
| RP-7 | Checkout + OrderComplete | `037946e7` | ✅ PurchaseRow 카트 연결 · Cart persist |
| RP-8 | Login + MyPage + 인풋 UX | `c87a9ea2` | ✅ blur 검증·자동 포맷·전용 훅 7종 |
| RP-9 | TextField/Textarea 공통화 + 3총사 Pass 1 | `8752d3b9`→`50e6820e` | ✅ CRITICAL 2 · HIGH 7 · MEDIUM 12 · Deferred 5 |
| RP-10 | 검색 시스템 4-layer (TDD 80%↑) | — | ⬜ |
| RP-11 | 반응형(4 BP) + 프로덕션(CSP·env·빌드) | — | ⬜ |

---

## Phase 3 — Backend

### 8. Data & API 🔄

> **계획 문서:** `docs/backend-architecture-plan.md` (14주 로드맵 + §11.5 모델 선택 가이드 실험 단계)

| 항목 | 상태 | 비고 |
|------|------|------|
| **Backend P0** DB 스키마 설계 | ✅ | 마이그레이션 001~009 — profiles/addresses/orders/order_items/subscriptions/payment_transactions + RLS + handle_new_user + security_hardening. 클라우드 dev(`ceqewbbjuhtnarzgkzmx`) 적용 완료 (2026-04-16) |
| **Backend P0** RLS 정책 | ✅ | `relforcerowsecurity=true` 6개 테이블, 정책 11개, PK id UPDATE 차단 트리거 4개(profiles/addresses/orders/subscriptions) (2026-04-16) |
| **Backend P0** Security advisors | ✅ | 009 적용 후 `function_search_path_mutable` WARN 해소. No issues found (2026-04-16) |
| **Backend P1** API 엔드포인트 설계 | ⬜ | Next.js Route Handler + `@supabase/ssr` + zod 검증 |
| **Backend P1** API 구현 | ⬜ | — |

### 9. Auth & Security 🔄

> **계획 문서:** `docs/oauth-security-plan.md` (P 시리즈 전체) · `docs/adr/ADR-001-oauth-account-merge-policy.md`
>
> **원칙:** 3-tier separation — Zustand(UI) / Supabase(Session) / Server+RLS(Security boundary). Zustand 는 UX 힌트일 뿐 보안 경계가 아니다.

**완료 (2026-04-15~16):**

| 항목 | 결과 |
|------|------|
| 인증 플로우 설계 | `docs/oauth-security-plan.md` + ADR-001 |
| P0-1~4 · P1-1~2 | CSRF state 쿠키 + AuthSyncProvider + verifyOtp 서버세션 + useAuthGuard 폴백 + Server Component 가드 + ADR-001 계정 병합(E2E 시나리오 1~3 통과, `accountMerge.test.ts` 21케이스) |
| P2-1 Zustand 인증 상태 제거 | `signOut`/`updateUser` 직접 연동. 더미 action 제거. 코드리뷰 HIGH 2·MEDIUM 4 반영 |
| ~~P2-3~~ | P0-3에 흡수 완료 |
| P3-1 OAuth 이벤트 로깅 | `logger.ts` + 이메일 마스킹(개인정보보호법 §30). Vitest 43/43. Phase 3-B에서 `auth_logs` 테이블 교체 예정 |
| P3-2 Rate Limiting | `@upstash/ratelimit` Sliding Window. initiate 10/60s · callback 20/60s. 5개 라우트. Vitest 56/56 |

**잔여:**

| 항목 | 상태 | 비고 |
|------|------|------|
| P2-2 Supabase RLS 정책 | ⬜ | Backend P0 에서 `relforcerowsecurity=true` 6개 테이블 + 정책 11개 선적용. 앱 레벨 `cart_items` 설계는 Phase 3 스키마 확장 시 |
| RBAC / 인가 정책 | ⬜ | admin/customer 역할 분리 — Phase 3-10 이후 |
| 최종 보안 감사 | ⬜ | P2-2 완료 후 security-reviewer 전면 감사 |

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
| Supabase 프로젝트 설정 | 🔄 | — | dev 프로젝트(`ceqewbbjuhtnarzgkzmx`) + CLI v2.91.2 + 마이그레이션 9종 적용 완료. staging/prod 환경 분리 남음 (2026-04-16) |
| CI/CD 파이프라인 | ⬜ | — | Vercel 자동 배포 |
| 모니터링 / 에러 트래킹 | ⬜ | — | Sentry, Vercel Analytics |

---

## Phase 5 — Quality Assurance ⬜

> 개발 완료 후 일괄 실시. 현재 착수 항목 없음.

| 그룹 | 항목 | 비고 |
|------|------|------|
| 12. Accessibility | WCAG 2.1 AA 자동 검수 + 수정 | — |
| 13. Performance & SEO | Core Web Vitals · 번들 최적화 · 메타·구조화데이터 | 배포 후 측정 |
| 14. Testing & QA | 크로스 브라우저(Chrome·Safari·Firefox·Edge) · 시각 회귀 · E2E(Playwright) | — |

---

## User AI ⬜

| 항목 | 상태 | 비고 |
|------|------|------|
| AI 페르소나 시뮬레이션 | ⬜ | 리서치 페르소나 기반 대화 검증 가능 |
| 유저 클론 검증 | ➖ | 실제 유저 데이터 필요 (서비스 출시 후) |
