# GTR 프로젝트 마일스톤

> Good Things Roasters 웹사이트 프로젝트의 진행 상태를 추적합니다.
>
> **운용 모드:** 이미지 모드 (Photoshop 기반 시안 + 마크다운 스펙 문서)
> **최종 업데이트:** 2026-04-17 (Backend P2-B Session 8 E 시리즈 회원탈퇴 완료 — B안(선 해지 후 탈퇴 + 원클릭 동선) 업계 리서치 기반 채택. ① `015_account_delete.sql`: `orders.account_deleted_at` 컬럼 + `orders_user_or_guest` 3분기 CHECK 재작성(회원/게스트/익명화) + RPC `delete_account(p_user_id)` SECURITY DEFINER(활성 구독 차단·PII sentinel 치환·cancelled/expired 구독 DELETE 단일 트랜잭션), ② `rateLimit.ts` `account_delete` 프리셋(3req/15m) + `logger.ts` `account.delete.blocked/success/failed` 이벤트, ③ `POST /api/account/delete` 8단계 플로우(CSRF→RateLimit→getClaims→confirm '탈퇴'→RPC→admin.deleteUser→signOut→log), 409 `subscription_active` / 500 orphan 경로 방어, ④ `MyPagePage.tsx` `confirmWithdraw()` 실제 API 연동(409/429/일반 오류 토스트 분기), ⑤ `route.test.ts` 6 케이스(401/400/409/500/200/invalid_json). 219/219 그린 · tsc clean · build 성공.)

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
| Phase 2 — Frontend | 2 | 0 | 2 | 0 | ~85% |
| Phase 3 — Backend | 3 | 2 | 1 | 0 | ~55% |
| Phase 4 — Infrastructure | 1 | 0 | 1 | 0 | ~20% |
| Phase 5 — Quality Assurance | 3 | 0 | 0 | 3 | 0% |
| User AI | 1 | 0 | 0 | 1 | 0% |

**현재 위치: Backend P2-B Session 8 D-4 Pass 1 완료 (트랜잭셔널 메일 전체 완료). 다음 옵션: A 회원탈퇴(E 시리즈) · B 웹훅 배송훅 연동 · C 리뷰 Deferred 처리 · D F-RLS/RBAC**

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
| 검색 시스템 + 콘텐츠 (2-F) | 🔄 | `next/src/lib/search/`, `next/src/components/search/`, `next/src/app/(main)/search/` | 검색 엔진 4-layer(A 사전 인덱스·B 쌍방향 동치류·C 스코어 랭킹·E 하이라이트 spans) + SRP UI + SiteHeader Enter 제출 ✅ (TDD 123/123, `f52bc6ac`·`cd88093e`·`5a21842b`). GoodDays/Story/MyPage 콘텐츠 채우기 ⬜ |
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
| R-6 | 2-F 검색 엔진 + UI | ✅ HIGH 5 + MEDIUM 정리 (3총사 Pass 1, `5a21842b`) · 콘텐츠 파트는 차기 |
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
| RP-10 | 검색 시스템 4-layer (TDD 80%↑) | `f52bc6ac`→`5a21842b` | ✅ A+B+C+E 개선, 단일 음절 가드, TDD 123/123 · HIGH 5 + MEDIUM 정리 |
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
| **Backend P1** 기반 레이어 | ✅ | proxy.ts(Next.js 16) + per-request Nonce CSP + SECURITY_HEADERS(HSTS/COOP/CORP/Permissions-Policy) + `lib/api/errors.ts` §7.4 표준 응답 + `lib/api/validate.ts` zod 파서 + `getClaims`/`requireAuth` 서버 가드(mypage·checkout 적용) + `.env.example` 17키 동기화 + gitleaks·npm audit CI (`677bff52`·`95bb50eb`, 2026-04-16) |
| **Backend P2-A** 주문 생성/조회 API | ✅ | orders · order_items · create_order RPC + CheckoutPage 연동 + P2-A 리뷰 Pass 1 (CRITICAL 0·HIGH 10 반영) (`6ec1d993`, 2026-04-16) |
| **Backend P2-B Session 3 B-1** 결제 플로우 설계 | ✅ | ADR-002 하이브리드 웹훅 인증 + `payments-flow.md` v1.0.7 (800줄, §0~§9 완비) + backend-architecture-plan §6.1~§6.2 편차 공지 + 사용자 블로커 7건 전체 해결 (`9643bcb0`, 2026-04-16) |
| **Backend P2-B Session 3.5 B-2** 결제위젯 UI | ✅ | CheckoutPayment.tsx(@tosspayments/tosspayments-sdk v2.6) + CheckoutPage `step: 'form'→'payment'` 전환 + OrderCompletePage successUrl 쿼리(paymentKey/orderId/amount) 수신 · sessionStorage 이관 + failUrl 안내 toast + Strict Mode 이중 마운트 방어(cancelled flag + cleanup innerHTML) (2026-04-16) |
| **Backend P2-B Session 4 B-3** confirm API + 3중 멱등 방어 | ✅ | 012 `payments` + `confirm_payment` RPC(SECURITY DEFINER + SELECT FOR UPDATE) + tossClient(Basic Auth + 10s timeout + 5xx 1회 재시도) + idempotency 키 합성 유틸 + paymentService(7단계 흐름 · ALREADY_PROCESSED_PAYMENT 리체크) + `POST /api/payments/confirm`(CSRF+RateLimit 10/60s+zod+getClaims) + OrderCompletePage 연동(pending/success/deposit_waiting/failed 상태 머신 · sessionStorage 'gtr-confirmed:{paymentKey}' dedup · clearCart) + 171/171 vitest 그린 (2026-04-16) |
| **Backend P2-B Session 5 B-4** Toss 웹훅 엔드포인트 | ✅ | `POST /api/payments/webhook` + ADR-002 하이브리드 인증(카드 GET 재조회 · 가상계좌 timing-safe secret) + `webhookVerify`(node:crypto timingSafeEqual) + zod `KnownWebhookSchema`(discriminatedUnion PAYMENT_STATUS_CHANGED/DEPOSIT_CALLBACK) + `webhookService`(status 매핑 + PARTIAL_CANCELED cancels[-1] 멱등 키 + 23505 silent skip + 총액 교차검증 401) + 012 `apply_webhook_event` RPC 래퍼 + CSRF `CSRF_EXEMPT_PATHS` 화이트리스트 + §5.3.1 timing-inversion 503(`Retry-After:30` + `x-webhook-timing-inversion:true`) + 193/193 vitest 그린(신규 22/22) (2026-04-16) |
| **Backend P2-B Session 6 B-7** 3총사+database-reviewer Pass 1 | ✅ | 013 마이그레이션(apply_webhook_event 재정의 · C-1 lock order · C-2 refund lock · H-2 payments absent fail · H-5 coalesce payment_key) + `schemas/common.ts` DRY + `payments/mask.ts`(카드·계좌·이메일·폰 allowlist) + `findOrderWithPaymentByOrderNumber` 단일 쿼리(H-4) + paymentService 단계별 helper 분리 + TOSS_METHOD_TABLE(code H-3) + approvedAt 누락 시 `toss_failed`(M-3) + 게스트 이메일 교차검증(security H-1/H-3 · CheckoutPage→OrderCompletePage pass-through) + rawPayload/rawResponse 마스킹(C-3) + tossClient RETRY_ONCE 잔재 정리(ts H-1) + rateLimit non-null assertion 제거(ts H-2) + webhookService.test.ts combo fixture 재구성 + `docs/toss-support-inquiry.md`(IP CIDR/서명/UA/재시도 정책 4문의 템플릿) · 195/195 vitest · tsc/eslint 0 · `next build` 성공 (2026-04-16) |
| **Backend P2-B Session 6 폴리시** 리서치 기반 재조정 | ✅ | 사용자 지적("업계 표준 리서치 없이 리뷰 권고 기계 수용?") → 3-parallel research(Toss 공식·국내 커머스·OWASP) → `docs/security-research-2026-04-16.md` 통합 기록. **H-1** 프레이밍 보정(MitM→레퍼러 누출·공유 successUrl 30s 재조회) + UX 폴백 신설(OrderCompletePage 재입력 프롬프트 3회 한도) + `payments-flow.md §6.7/6.8` · **H-3**(Toss 웹훅 IP allowlist 추가 제안) 기각 — ADR-002 §4.3 행 추가 · `toss-support-inquiry.md` IP 문의 섹션 제거 · **M-3** 단순화(throw→new Date() fallback + console.warn + `_fallback.approved_at` 플래그). 전역 교훈: `memory/feedback_industry_standard_research.md` (2026-04-17) |
| **Backend P2** 잔여 (B-5~H) | ⬜ | 정산 리포트·Resend·회원탈퇴·RLS/RBAC·프로덕션·인프라 (session_plan 참조) |

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
| Backend P1 보안 기반 | proxy.ts 세션 갱신 + per-request Nonce CSP(strict-dynamic) + HSTS/COOP/CORP/Permissions-Policy 정적 헤더 + `requireAuth()` 서버 가드 통합(2026-04-16, `95bb50eb`) |

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
