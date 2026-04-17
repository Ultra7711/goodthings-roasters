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
