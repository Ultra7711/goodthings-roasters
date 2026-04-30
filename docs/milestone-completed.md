# GTR 프로젝트 — 완료 이력 아카이브

> `docs/milestone.md` 에서 분리. 완료된 Phase / 그룹 / 세션 단위 산출물을 기록한다.
> 활성 잔여 작업과 다음 단계는 `docs/milestone.md` 를 참조.

---

## Phase 1 — Design ✅

| 그룹 | 산출물 | 핵심 |
|------|--------|------|
| 1. Research | `docs/archive/research-plan-v1.md` · `research/track-a~d-*.md` · `gtr-research-presentation.*` | 4트랙 프레임워크 + 23슬라이드 리포트 |
| 2. UX Writing | `docs/ux-writing-v1.md` · `docs/gtr-design-guide.md` Part 7 | "차분한 자신감" 톤 + 페이지별 카피 시트 |
| 3. Critique | `docs/design-qa-report.md` | ~250건 하드코딩→토큰 치환, 10페이지 비주얼 검증 |
| 4. UI Design | `docs/gtr-design-guide.md` Part 0~6 · `docs/layout-wireframe-v2.md`/`.html` | Warm-shifted B&W 토큰 + 모션·Z-index·컴포넌트 토큰 |
| 5. Handoff | `docs/prototype-handoff.md` · `goodthings_v1.0.html` :root | 179개 토큰 + 12 서브 페이지·7 드로어·40+ 상태 함수 명세 |

Photoshop / 모바일 별도 시안 ➖ — HTML 프로토타입 + Next.js 반응형으로 대체.

---

## Phase 2 — Frontend (완료 범위)

### 6. Frontend Development — 완료 항목

| 항목 | 산출물 |
|------|--------|
| HTML 프로토타입 | `goodthings_v1.0.html` (11,100+ lines) — 12 서브 페이지, 검색, 카트, 결제, 마이페이지 |
| CSS 디자인 토큰 | CSS Custom Properties — 컬러·폰트·letter-spacing·모션·z-index 179개 + 스페이싱 14+5 토큰 |
| Next.js 프로젝트 셋업 | `next/` — Tailwind v4 + 179 토큰 이관 |
| 공통 레이아웃 | `next/src/components/` — 글래스모피즘 헤더, 푸터, 어나운스바 |
| 상태 관리 | `next/src/lib/store.ts` — Zustand 장바구니·인증 스토어 + Cart persist(localStorage) |
| UI 베이스 컴포넌트 | `next/src/components/ui/` — TextField·Textarea·Button·Tabs·Badge |
| 페이지 라우팅 | `next/src/app/` — /story /menu /shop /gooddays + Metadata SEO |
| 도메인 컴포넌트 | product/menu/gallery/layout — ProductCard·CafeMenuCard·GalleryGrid·PageHero |
| 2-A 복합 UI | Drawer·Modal·Toast + Pretendard 로컬 폰트 |
| 2-B 상품 상세 | ImageGallery·PurchaseOptions·RadarChart·RoastStage·RecipeGuide·ProductAccordion + SSG 6상품 |
| 2-C 장바구니·체크아웃 | CartDrawer·CheckoutPage·OrderCompletePage + Route Group `(main)` / `(checkout)` |
| 2-D 로그인·마이페이지 | LoginForm·RegisterForm·MyPageView + ConfirmModal + `useAuthGuard` (SSR 안전) |
| 2-E 플로우 복구 | `/cart` 풀페이지 + CartDrawer 2버튼 + `/biz-inquiry` B2B 폼 |
| 2-F 검색 시스템 | 4-layer(사전 인덱스·쌍방향 동치류·스코어 랭킹·하이라이트 spans) + SRP UI + SiteHeader Enter 제출 (TDD 123/123, `f52bc6ac`·`5a21842b`) |

### 7. Content & Asset — 완료 항목

| 항목 | 산출물 |
|------|--------|
| 아이콘 시스템 | Lucide 기반 inline SVG + `--color-icon-default` + `images/icons/` 동기화 |

### 코드 리뷰 — 완료 내역

**원개발 (R-x):**

| 순서 | 대상 | 결과 |
|------|------|------|
| R-0a~c · R-1~R-4 | 상품·메뉴·갤러리·2-A~2-D | ✅ HIGH 35 + MEDIUM 15 |
| R-6 | 2-F 검색 엔진 + UI | ✅ HIGH 5 + MEDIUM 정리 (`5a21842b`) |

**pixel-port 재이식 (RP-x):**

| 순서 | 대상 | 커밋 | 결과 |
|------|------|------|------|
| RP-1~2 | 공통 레이아웃 + 홈 섹션 7개 | 2026-04-11 | HIGH 7 + MEDIUM 2 |
| RP-3 | Shop 재이식 | `18af1435`→`09365e43` | HIGH 3 + MEDIUM 2 · Deferred 4 |
| RP-4 | 상품 상세 재이식 | `a7b19102` | HIGH 5 · `lib/products.ts` canonical |
| RP-5 | 카페 메뉴 재이식 | 2026-04-12 | URL 쿼리 복구 · Deferred 3 |
| RP-6 | Story · BizInquiry · GoodDays | `d3aec51e` | HIGH 3 · same-page reentry · Deferred 6 |
| RP-7 | Checkout + OrderComplete | `037946e7` | PurchaseRow 카트 연결 + Cart persist |
| RP-8 | Login + MyPage + 인풋 UX | `c87a9ea2` | blur 검증 · 자동 포맷 · 전용 훅 7종 |
| RP-9 | TextField/Textarea 공통화 + 3총사 Pass 1 | `8752d3b9`→`50e6820e` | CRITICAL 2 · HIGH 7 · MEDIUM 12 · Deferred 5 |
| RP-10 | 검색 시스템 4-layer (TDD 80%↑) | `f52bc6ac`→`5a21842b` | A+B+C+E 개선 · 단일 음절 가드 · TDD 123/123 · HIGH 5 + MEDIUM 정리 |

---

## Phase 3 — Backend (완료 범위)

> 계획 문서: `docs/backend-architecture-plan.md` (14주 로드맵)

### Backend P0 — DB 기반

| 항목 | 결과 |
|------|------|
| DB 스키마 | 마이그레이션 001~009 — profiles/addresses/orders/order_items/subscriptions/payment_transactions + RLS + handle_new_user + security_hardening. 클라우드 dev(`ceqewbbjuhtnarzgkzmx`) 적용 (2026-04-16) |
| RLS 정책 | `relforcerowsecurity=true` 6개 테이블 + 정책 11개 + PK id UPDATE 차단 트리거 4개(profiles/addresses/orders/subscriptions) |
| Security advisors | 009 적용 후 `function_search_path_mutable` WARN 해소. No issues found |

### Backend P1 — 기반 레이어

| 항목 | 결과 (`677bff52`·`95bb50eb`, 2026-04-16) |
|------|------|
| proxy.ts | Next.js 16 + per-request Nonce CSP + SECURITY_HEADERS (HSTS/COOP/CORP/Permissions-Policy) |
| API 유틸 | `lib/api/errors.ts` §7.4 표준 응답 + `lib/api/validate.ts` zod 파서 |
| Auth 가드 | `getClaims` / `requireAuth` 서버 가드 (mypage·checkout 적용) |
| 환경/CI | `.env.example` 17키 동기화 + gitleaks·npm audit CI |

### Backend P2-A — 주문 생성/조회

| 커밋 | 결과 |
|------|------|
| `6ec1d993` (2026-04-16) | orders · order_items · `create_order` RPC + CheckoutPage 연동 + P2-A 리뷰 Pass 1 (CRITICAL 0 · HIGH 10) |

### Backend P2-B — 결제 (Sessions 3~8)

| 세션 | 범위 | 결과 |
|------|------|------|
| Session 3 — B-1 | 결제 플로우 설계 | ADR-002 하이브리드 웹훅 인증 + `payments-flow.md` v1.0.7 (800줄, §0~§9) + backend-architecture-plan §6.1~§6.2 편차 공지 + 블로커 7건 해결 (`9643bcb0`) |
| Session 3.5 — B-2 | 결제위젯 UI | `CheckoutPayment.tsx`(@tosspayments/tosspayments-sdk v2.6) + `CheckoutPage` step 전환 + OrderCompletePage successUrl 쿼리 수신 · sessionStorage 이관 + failUrl 토스트 + Strict Mode 이중 마운트 방어 |
| Session 4 — B-3 | confirm API + 3중 멱등 방어 | 012 `payments` + `confirm_payment` RPC(SECURITY DEFINER + FOR UPDATE) + `tossClient`(Basic Auth + 10s timeout + 5xx 1회 재시도) + `paymentService` 7단계 흐름 + `POST /api/payments/confirm` + OrderCompletePage 상태 머신(pending/success/deposit_waiting/failed) + 171/171 그린 |
| Session 5 — B-4 | Toss 웹훅 엔드포인트 | `POST /api/payments/webhook` + ADR-002 하이브리드 인증(카드 GET 재조회 · 가상계좌 timing-safe secret) + `webhookVerify` + `KnownWebhookSchema`(discriminatedUnion) + `webhookService`(PARTIAL_CANCELED 멱등 키 + 23505 silent skip + 총액 교차검증 401) + 012 `apply_webhook_event` RPC + §5.3.1 timing-inversion 503 + 193/193 그린 |
| Session 6 — B-7 리뷰 | 3총사 + database-reviewer Pass 1 | 013 마이그레이션(C-1 lock order · C-2 refund lock · H-2 payments absent fail · H-5 coalesce) + `schemas/common.ts` DRY + `payments/mask.ts` 마스킹 + `findOrderWithPaymentByOrderNumber` 단일 쿼리 + TOSS_METHOD_TABLE + approvedAt 누락 시 `toss_failed` + 게스트 이메일 교차검증 + rawPayload/rawResponse 마스킹 + `docs/toss-support-inquiry.md` · 195/195 그린 |
| Session 6 폴리시 | 리서치 기반 재조정 (2026-04-17) | 사용자 지적("업계 표준 리서치 없이 리뷰 권고 기계 수용?") → 3-parallel research(Toss·국내 커머스·OWASP) → `docs/security-research-2026-04-16.md`. H-1 프레이밍 보정(MitM→레퍼러 누출·공유 successUrl 30s 재조회) + `payments-flow.md §6.7/6.8` · H-3 IP allowlist 기각 → ADR-002 §4.3 · M-3 단순화(throw→fallback) |
| Session 7 — B-5 + Resend 인프라 + Pass 1 A안 | 정산 RPC + 이메일 인프라 | (세부는 `docs/settlement-report.md` · `docs/email-infrastructure.md` 참조) — db H-2 실버그 · security H-1/H-2/H-3/M-1/M-3 · code H-1/H-2/H-3 · 213/213 그린 · tsc/eslint/build 클린 |
| Session 8 — 보안 하드닝 + 통합 테스트 | docs/payments-security-hardening.md 구현 | #4 PCI 로그(`798efa86`) · #1 Carding RL(`6cc0937d`) · #2 Referrer-Policy(`a2cfd6b2`) · #3-4a public_token(`39e24564`) · Opt 2 통합 테스트 A/C/B(`2d8a673b`·`13aec2b7`·`dcc55287`) — 310/310 그린. #3-4b 는 Session 11 에 합류 |

### Backend P2 — 기타 완료

| 항목 | 결과 |
|------|------|
| 회원탈퇴 (E) | 015 `delete_account` RPC · `POST /api/account/delete` · MyPageView 연동 |
| 어드민 출고 전환 | 016 `dispatch_order` RPC · `POST /api/admin/orders/[orderNumber]/ship` · `adminAuth`(`ADMIN_API_SECRET` + `crypto.timingSafeEqual`) · 배송 알림 메일 훅 |

### Auth & Security — 완료 내역

> 계획 문서: `docs/oauth-security-plan.md` (P 시리즈) · `docs/adr/ADR-001-oauth-account-merge-policy.md`
>
> 원칙: 3-tier separation — Zustand(UI) / Supabase(Session) / Server+RLS(Security boundary)

| 항목 | 결과 |
|------|------|
| 인증 플로우 설계 | `docs/oauth-security-plan.md` + ADR-001 |
| P0-1~4 · P1-1~2 | CSRF state 쿠키 + AuthSyncProvider + verifyOtp 서버세션 + useAuthGuard 폴백 + Server Component 가드 + ADR-001 계정 병합(E2E 1~3 통과, `accountMerge.test.ts` 21케이스) |
| P2-1 | Zustand 인증 상태 제거 + `signOut`/`updateUser` 직접 연동 · 코드리뷰 HIGH 2 · MEDIUM 4 |
| P3-1 OAuth 이벤트 로깅 | `logger.ts` + 이메일 마스킹(개인정보보호법 §30) · Vitest 43/43 |
| P3-2 Rate Limiting | `@upstash/ratelimit` Sliding Window · initiate 10/60s · callback 20/60s · 5개 라우트 · Vitest 56/56 |
| Backend P1 보안 기반 | proxy.ts 세션 갱신 + per-request Nonce CSP(strict-dynamic) + HSTS/COOP/CORP/Permissions-Policy + `requireAuth()` 서버 가드 통합 (`95bb50eb`) |

---

## Phase 4 — Infrastructure (완료 항목)

| 항목 | 산출물 |
|------|--------|
| 인프라 스택 확정 | `docs/GTR_infrastructure.md` — Vercel + Supabase + Resend + 토스페이먼츠 |
| 도메인 / DNS | goodthingsroasters.com |
| 비용 구조 분석 | `docs/GTR_infrastructure.md` — ~₩10,500/월 베이스라인 |
| Vercel 프로젝트 + 환경변수 | S52 (2026-04-21) — `goodthings-roasters.vercel.app` 배포 + 환경변수 18종 Import + CSP nonce 동적 렌더링 해결 + Kakao Maps/OAuth · Naver OAuth · Supabase Auth 콜백 등록 |
| 모니터링 / 에러 트래킹 | S53 — Vercel Analytics + Speed Insights (`609d3293`) · Sentry Next.js SDK + tunnelRoute `/monitoring` + source map 업로드 (`8b8f4562`) · 프로덕션 스모크 통과 |
| CI/CD | GitHub → Vercel 자동 배포 (master push → prod) |

---

## Session 묶음 아카이브 (S9 ~ S116)

> 세션 단위 상세는 `memory/project_session{N}_complete.md` 참조. 본 섹션은 묶음 단위 요약.

### A. Sessions 9~17 — Backend P2 후속 + ADR-004 Step A~D

| 묶음 | 범위 | 결과 |
|------|------|------|
| S11 | P2-D Resend 이메일 통합 + 보안 #3-4b | `orderConfirmationEmail`/`shippingNotificationEmail` 에 `?token={public_token}` CTA · prod `?orderNumber=` 차단 (404) · welcome email OAuth 콜백 연동 · 통합 테스트 |
| S12 | P2-F 카트 DB 인프라 | `cart_items` 테이블 + RLS 4종 + Repo/Service/API + 회귀 테스트 |
| S13 | guest cart merge + RBAC | 트리거 + `profiles.role` enum + `is_admin()` + `grant/revoke_admin` RPC + `requireAdmin` (ADR-003) |
| S13.5 | S8~13 리뷰 하드닝 | CRITICAL 2 + HIGH 4 · migration 021 |
| S14 | 카트 UI DB 연동 + ADR-004 Step A | hydrate + write-through mirror · `useHasHydrated` · C-M3 bulk RPC (migration 022) · E2E 스모크 통과 |
| S15 | ADR-004 Step B | TanStack Query 도입 + `useCart*` 훅 + `useCartStore` 제거 |
| S16 | ADR-004 Step C | `useSupabaseSession` + `useAuthStore`·`DEMO_CREDENTIALS` 제거 + BUG-004 근본 해결 |
| S17 | ADR-004 Step D | zustand 의존성 제거 + `useToast` 분리 + AuthSyncProvider 하드닝 (HIGH 4·MED 4·LOW 2) |

### B. Sessions 18~49 — Phase 2 디자인 폴리시 + 반응형 4BP

| 묶음 | 범위 | 결과 |
|------|------|------|
| S18~36 | 디자인 폴리시 Phase 1~3 | 카트 풀페이지 + 게이지/레이더 통일 + 팔레트(Warm-shifted B&W + gold accent + 섹션 로테이션) + CTA hover gold + 검색 시스템 4-layer (TDD 123/123) |
| S37~49 | 반응형 4BP | clamp 토큰화 + container queries + 햄버거 드로어 + tap-area sweep + 360/768/1024/1440 전 페이지 QA · PR#2(`2170f795`) · PR#3(`d0d76835`) · PR#4(`bc72219e`) master 머지 |
| S50 | 반응형 1차 리뷰 | CRITICAL 0 · HIGH 4 (1건 빌드차단 즉시 수정) · MED 5 · LOW 3 · `memory/review_session37_49_responsive.md` |

### C. Sessions 51~60 — Phase 4 인프라 + Phase 1 인터랙션 + 프로덕션 마감

| 묶음 | 범위 | 결과 |
|------|------|------|
| S51 | H3·M7 처리 | `NEXT_PUBLIC_BUSINESS_*` 5종 env 이관 + `proxy.ts` nonce 기반 CSP + HSTS/COOP/CORP/Permissions 정적 헤더 검증 |
| S52~53 | Phase 4 인프라 | Vercel 배포 + 환경변수 + OAuth 콜백 등록 + Vercel Analytics·Speed Insights + Sentry SDK + tunnelRoute |
| S54~60 | Phase 1 디자인 인터랙션 ②⑤⑧ | Editorial Scale · Staggered Reveal 등 (`project_design_interaction_plan.md`) — ①Scroll Variable Font · ③Staggered Reveal Phase 2 대기 |

### D. Sessions 62~63 — 결제·체크아웃 정상화

| 세션 | 핵심 |
|------|------|
| S62 | PGRST202 (Turbopack 스코프 버그) 해결 · CSP Toss 내부 엔드포인트 wildcard · 공용 데모 키 교체 · `requireAuth()` 제거 · 배송비 누락 해소 · "비회원으로 주문하기" silent return 수정 (`b90c5723`) |
| S63 | loadFailed secondary CTA 디자인(mp-cancel-btn 재사용) · Toss 결제창 "이전" 후 bfcache 복원 시 CheckoutPage submitting 누수 근본 수정 (pageshow persisted + onBack 복구) · 모바일 "이전" 축약 유틸 (`d5fd907f`) |

### E. Sessions 64~66 — BUG-006 Tier 3 Stage C+D 완료

> 단일 진입점: `memory/project_bug006_north_star.md` · 의사결정 `memory/project_bug006_decisions_log.md` (D-001~D-026)

| Stage | 결과 |
|-------|------|
| Stage A·B (이전 세션) | 진단 + 측정 (12섹션 프로토콜, `docs/bug006-reproduction-protocol.md`) |
| Stage C | instant navigation 아키텍처 — Activity preserve + `gtr:route-change` event 도입 |
| Stage D | effectivePath 패턴 + ShopPage·CafeMenuPage 적용 |
| 완료 시점 | **S66 (`9f954e90`)** — Stage C+D 통합 완료 + D-4 후속. `memory/project_bug006_stage_c_d_complete.md` |

### F. Sessions 67~85 — BUG-006 후속 묶음 A~E + 폴리싱 라운드 1

| 묶음/세션 | 범위 |
|---|---|
| S73 (묶음 A) | BUG-131/132/135 + BUG-130 Prototype A closure · §11-H1 측정 (M-006) · effectivePath + gtr:route-change 재활용 (`263fe57a`) |
| S74 (묶음 B) | BUG-133 카트 back + BUG-128 focus + BUG-135 모바일 + DB-03/BUG-138 1·2단계 closure + 명명 정리 (DB-01/02/03/08 → BUG-136/137/138/139, DB-04 closure 확정) (`3ffd0faf`) |
| S75 (묶음 C) | BUG-139 공통 .page-* 1차 + BUG-134 모바일 body padding-top 30px 축소 (`5f42fbd9`) |
| S76 | BUG-139 closure (D-025) + 묶음 D (BUG-144/145/146) + BUG-147 옵션 NEW 결정 (`4f3579f5`) |
| S77 (묶음 E) | BUG-140/147 — 드로어 3그룹 + `/login` 풀 헤더 (`0f496576`) |
| S78 | BUG-102/113/114/141/151/152/153 등 closure (`e84c4dae`) |
| S79 | BUG-158 closure (드롭다운 click 캡처 관통 차단) + BUG-156/157 등록 (`a361860a`) |
| S80 | BUG-154/155/156 closure · BUG-101 보류 (`75724826`) |
| S81 | BUG-143 closure (모바일 탭 피드백) · NavVisGate ↔ TouchHoverGuard 충돌 진단·수정 + BUG-159 등록 (스켈레톤 도입) (`fed54546`) |
| S82 | BUG-103/105 문서 반영 + BUG-148/149/150 closure (iOS Safari 푸터 flash · 드로어 전환 잔상 · 카트 진입 지연) (`a8c3b28a`) |
| S83 | BUG-149 UX 정제 (슬라이드 아웃 제거·클릭 버튼 단독 피드백) + useNavigation 훅 신규 (`23f6717e`) |
| S84 | BUG-160·112·106(회귀) closure · chp-input background 불투명 고정 (`a62ee204`) |
| S85 | BUG-120/125/161 closure + BUG-115 옵션 Z 확장 설계 (`docs/bug115-payment-easypay-design.md`) |

### G. Sessions 86~91 — BUG-115 옵션 Z + 결제 사고 BUG-172 복구

| 세션 | 핵심 |
|------|------|
| S86 | BUG-115 PR1 백엔드 + DB — 마이그레이션 023/024 + paymentService 9종 provider 매핑 + method_mismatch 비교 제거 · 3관문 리뷰 통과 (`4c93b40b`) |
| S87 | BUG-115 PR2 — 옵션 Z 클라이언트 UI 제거 · 결제수단 라디오+CSS 제거 + `{ method: 'card' }` 고정 (`288629a3`) |
| S88 | closure 5건 (BUG-162/164/165/166/167) + 보강 2건 + 신규 2건 (BUG-168/169) (`a0bea61a`) |
| S89 | BUG-168 closure (마이페이지 백지 시간 제거) + 디버깅 회귀 즉시 fix (`<Image priority>` RSC stuck) (`8e3db7bf`) |
| S90 | BUG-163 closure (order-complete 뱃지→인라인 메타) + BUG-169 closure (login dvh→svh) + BUG-168 심화 백로그 (`0a5fc0ec`) |
| S91 | **BUG-172 결제 사고 4h+ 진단·복구** — public_token 컬럼 누락 + virtualAccount 분기 코드/CHECK 제약 정합화 (`34f351be`). `memory/project_session91_complete.md` + `memory/project_production_toss_key_migration.md` (사고이력) |

### H. Sessions 92~98 — Polishing 라운드 2 + 어드민 정책 변경

| 세션 | 핵심 |
|------|------|
| S92 (정책) | **어드민 풀 구축 출시 전 확정** — shadcn/ui · Supabase Storage · `/admin/login` 별도. `memory/project_admin_subscription_plan.md` |
| S94 | shimmer skeleton 전 페이지 확장 + BUG-176/178 closure (hero video · story white flash) (`9e8ec497`) |
| S97 | BUG-130 cream flash specificity fix (`hdr-dark.hdr-at-top`) + 마이페이지 헤더 SiteHeader 통합 (chp-hdr-wrap 폐기) + mp-right 정렬 회귀 fix + last-child hairline 제거 (`c71ac3b8`) |
| S98 | push +10 완료 (origin/master 동기화) + last-child hairline 시각 검증 (.next 클린 후) |

### I. Sessions 99~111 — 마이페이지 아코디언 + 좋아요 + 정기배송 백엔드 + 리뷰 라운드

| 세션 | 핵심 |
|------|------|
| S99 | 마이페이지 구독 아코디언 개편 (3버튼·배송 건너뛰기·구독 해지 모달) + 헤더 아이콘 정렬 fix (`7398114c`) |
| S100 | 카페 메뉴 좋아요 기능 전체 구현 (`f5a4cc66`) |
| S101 | 하트 버튼 전면 리디자인 (pill·glass·파티클) + 뱃지 폴리싱 (`1fe29535`) |
| S102 | 섹션 간격 정비 + season-banner aspect-ratio 제거 + 모바일 그라데이션 버그 + hash 앵커 스크롤 버그 fix (`4ef01b6d`) |
| S103 | 히어로 비디오 멈춤 회귀 fix + 오버레이 딤 blur 전체 제거(6파일) (`7ddc2f5f`) |
| S104 | **R-SEC 보안 리뷰** (3-agent 병렬) + HIGH 2/MEDIUM 3 closure + paymentLogger S91 회귀 fix (`b7e039f3`) · `memory/review_rsec_20260429.md` |
| S105~107 | **R-FE1 Cart+Checkout UI 리뷰** (S105 시작 → S107 closure) — CRITICAL 0·HIGH 4·MEDIUM 15·LOW 8 전체 closure · `checkoutValidation.ts` 신규(+18 테스트) (`6a2e4281`) |
| S108 | **R-FE3 MyPage·Cafe·Shop 리뷰** — HIGH 1·MEDIUM 2·LOW 5 closure · Icons.tsx 신규 (`5b83adf8`) |
| S109 | R-SEC 잔여 M-2/M-5/L-1/L-3 closure · syntheticEmail.test.ts 신규 (`0fe49895`) |
| S110 | CH-L-1 Radix Select · unlike layout 점프 · menu 로딩 병렬화 (`91d9b7e9`) |
| S111 | **정기배송 백엔드 Group B+C** — subscriptionRepo + 7개 Route Handler + MyPagePage real API 연동 · 416/416 vitest green (`8c1620e3`) |

### J. Sessions 112~116 — Likes 격리 + 리뷰 클로저

| 세션 | 핵심 |
|------|------|
| S112 | Shop/Menu/GoodDays flash 수정 + MyPage 재진입 초기화 + 검색 패널 라우트 전환 버그 (`e78e7200`) |
| S113 | **R-FE2 정기배송 백엔드 리뷰** + 정기배송 일시정지 UI + 마이페이지 폴리싱 + 카트 race condition 수정 (`65711255`) · `memory/review_fe2_20260430.md` |
| S114 | User Sessions B안 미들웨어 + 좋아요 race condition + 메뉴 소팅 + 샵 탭 유지 (`e1c8ceb4`) |
| S115 | Vercel 빌드 실패 복구 + User Sessions B안 폐기 (`bd8970ae`) |
| S116 | **카페 메뉴 likes 외부 store 격리 (옵션 B)** — `menuLikesStore` (useSyncExternalStore) + `MenuCardBadges` 신규 + `useMenuLikes` 삭제 + 트릭 6개 제거 + ShopPage 패턴 회귀 · `R-S113/S114` 리뷰 승인 · 416/416 vitest green (`c0b617d4`) · `memory/project_session116_complete.md` |
