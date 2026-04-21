# GTR 프로젝트 브리프

> **새 세션 진입용 단일 문서.** 이 파일 하나로 프로젝트 전체 맥락을 5분 내 파악할 수 있도록 유지한다.
>
> 상세 이력 → `docs/milestone.md` / `docs/milestone-completed.md`
> 최종 업데이트: 2026-04-21 · Session 53 완료 시점

---

## 서비스 정의

**Good Things Roasters** — 스페셜티 커피 로스터리 이커머스 + 카페 브랜드 사이트.
"good things, simply roasted." 톤. 원두 6종 판매 + 카페 메뉴 안내 + 굿데이즈 갤러리 + B2B 도매 문의.

---

## 기술 스택

```
[브라우저]
  Next.js 14 App Router  ─  Tailwind v4 + CSS Custom Properties (179 토큰)
  Radix UI (headless)    ─  Pretendard + Inter

[서버]
  Next.js Route Handlers  ─  Zod 스키마 검증  ─  per-request Nonce CSP

[데이터]
  Supabase (PostgreSQL + Auth + RLS)
  migrations 001~022, dev 프로젝트: ceqewbbjuhtnarzgkzmx

[외부 서비스]
  토스페이먼츠  ─  결제위젯 v2 + 웹훅 하이브리드 인증 (ADR-002)
  Resend       ─  트랜잭셔널 이메일 (주문 확인·배송 알림·회원가입)
  Kakao/Naver OAuth  ─  소셜 로그인

[인프라]
  Vercel   ─  프로덕션: goodthings-roasters.vercel.app
  Sentry   ─  에러 트래킹 + 성능 모니터링 (tunnelRoute /monitoring)
  Vercel Analytics + Speed Insights
  도메인: goodthingsroasters.com
```

---

## 페이즈 현황

| Phase | 목표 | 진행률 | 핵심 산출물 |
|-------|------|--------|------------|
| **1 Design** ✅ | 프로토타입 · 디자인 시스템 | 100% | `goodthings_v1.0.html` (11,100줄) · `docs/gtr-design-guide.md` |
| **2 Frontend** 🔄 | Next.js 전환 · 반응형 · 폴리시 | ~95% | `next/src/` 전체 · 4BP 반응형 완성 |
| **3 Backend** 🔄 | 주문·결제·인증·카트·이메일 | ~55% | Route Handlers · Supabase migrations · ADR 4건 |
| **4 Infrastructure** 🔄 | 배포 · CI/CD · 모니터링 | ~80% | Vercel prod · Sentry · Analytics |
| **5 QA** ⬜ | 접근성 · CWV · E2E | 0% | 개발 완료 후 일괄 |

---

## 파일 지도

### 라우트 구조

```
next/src/app/
├── (main)/              # 메인 레이아웃 그룹 (헤더·푸터 포함)
│   ├── page.tsx         # 홈 — 히어로·섹션 7개
│   ├── shop/            # 원두 샵 목록 + [slug] 상품 상세
│   ├── menu/            # 카페 메뉴
│   ├── gooddays/        # 굿데이즈 갤러리
│   ├── story/           # 브랜드 스토리 + 카카오맵
│   ├── search/          # 검색 결과 페이지 (SRP)
│   ├── cart/            # 장바구니 풀페이지
│   └── biz-inquiry/     # B2B 도매 문의
├── checkout/            # 체크아웃 · 주문완료 (별도 레이아웃)
├── login/               # 로그인·회원가입
├── mypage/              # 마이페이지
├── auth/callback/       # Supabase OAuth 콜백
└── api/
    ├── auth/kakao|naver/ # OAuth 소셜 로그인
    ├── cart/            # 카트 CRUD + merge
    ├── orders/          # 주문 생성·조회
    ├── payments/        # confirm + webhook
    ├── account/delete/  # 회원 탈퇴
    └── admin/           # 어드민 (me · orders/ship)
```

### 핵심 lib 파일

| 파일 | 역할 |
|------|------|
| `lib/products.ts` | 상품 타입 + PRODUCTS 배열 — canonical 데이터 소스 |
| `lib/supabase.ts` / `supabaseServer.ts` / `supabaseAdmin.ts` | 클라이언트·서버·어드민 Supabase 클라이언트 |
| `lib/api/errors.ts` | §7.4 표준 API 응답 포맷 |
| `lib/api/validate.ts` | Zod 파서 래퍼 |
| `lib/search/engine.ts` | 4-layer 검색 엔진 (정규화→동의어→발음→초성) |
| `lib/services/paymentService.ts` | 결제 7단계 플로우 |
| `lib/services/webhookService.ts` | 웹훅 처리 + 멱등 방어 |
| `lib/services/cartService.ts` | 카트 DB 연동 서비스 |
| `proxy.ts` | per-request Nonce CSP + 보안 응답 헤더 |
| `hooks/useCart.ts` | TanStack Query 기반 카트 훅 |
| `hooks/useSupabaseSession.ts` | 세션 단일 소스 (ADR-004 결과물) |

### 주요 컴포넌트

| 컴포넌트 | 역할 |
|---------|------|
| `layout/SiteHeader.tsx` | 글래스모피즘 헤더 + 검색 드롭 + 모바일 햄버거 |
| `layout/MobileNavDrawer.tsx` | 모바일 네비 드로어 |
| `auth/AuthSyncProvider.tsx` | Supabase 세션 → React 상태 동기화 |
| `cart/CartDrawer.tsx` | 카트 드로어 (664px, 3레이어) |
| `checkout/CheckoutPayment.tsx` | 토스페이먼츠 위젯 연동 |
| `product/PurchaseRow.tsx` | 상품 상세 구매 옵션 행 |

---

## 확정된 핵심 결정 (ADR)

| ADR | 결정 | 근거 문서 |
|-----|------|----------|
| **ADR-001** | OAuth 계정 병합: 이메일 일치 → 자동 연결, 불일치 → 신규 계정 | `docs/adr/ADR-001-oauth-account-merge-policy.md` |
| **ADR-002** | 결제 웹훅 인증: 카드=GET 재조회, 가상계좌=timing-safe secret | `docs/adr/ADR-002-payment-webhook-verification.md` |
| **ADR-003** | RBAC: `profiles.role` enum + `is_admin()` RPC + `requireAdmin` 가드 | `docs/adr/ADR-003-rbac-role-separation.md` |
| **ADR-004** | 상태관리: Zustand 완전 제거 → TanStack Query + `useSupabaseSession` 단일 소스 | `docs/adr/ADR-004-state-management-simplification.md` |

---

## 현재 블로커 & 잔여 작업

### 즉시 착수 가능

| 항목 | 문서 |
|------|------|
| BUG-101~108 (프로덕션 버그 8건) | `docs/bug-report-phase4.md` |
| Phase 4 — Supabase staging/prod 분리 | `docs/milestone.md` §Phase 4 |
| Phase 2 — 콘텐츠 채우기 (GoodDays·Story·MyPage) | `docs/milestone.md` §2-F |
| Phase 2 — 이미지 최적화 파이프라인 (WebP/AVIF) | `docs/milestone.md` §항목 7 |

### 선행 조건 필요

| 항목 | 선행 조건 |
|------|----------|
| 정기배송 구독 엔진 (P2-C) | 주기·결제 정책 비즈니스 확정 |
| Supabase prod 프로젝트 | staging 검증 완료 후 |
| Phase 5 QA 전면 | 개발 완료 (Phase 2·3·4 잔여) |
| 최종 보안 감사 | RLS 정책 전체 완성 후 |

### Deferred 항목 위치

`docs/code-review-deferred.md` — 세션별 미처리 코드 리뷰 항목 누적

---

## 설계 원칙 (코드 작성 시 반드시 준수)

1. **프로토타입 = ground truth** — `goodthings_v1.0.html` 수치 그대로 이식, 재해석 금지
2. **CSS 수정 전 grep 전수조사** — 변경 속성을 전체 파일에서 먼저 검색 후 수정
3. **body overflow는 `_restoreOverflow()` 경유** — 직접 `''` 해제 금지
4. **새 서브 페이지 추가 시 DEV 패널 등록 필수**
5. **아이콘 인라인 SVG 추가 시 `images/icons/` 폴더 동기화**
6. **브랜드명: "굳띵즈"** (굿띵스·good things 사용 금지)

---

## 참고 문서 빠른 색인

| 궁금한 것 | 찾을 곳 |
|----------|---------|
| 전체 진행 상황 | `docs/milestone.md` |
| 완료 이력 상세 | `docs/milestone-completed.md` |
| 디자인 가이드 (컬러·타이포·토큰) | `docs/gtr-design-guide.md` |
| 레이아웃 와이어프레임 | `docs/layout-wireframe-v2.md` / `.html` |
| 결제 플로우 스펙 | `docs/payments-flow.md` |
| 결제 보안 하드닝 | `docs/payments-security-hardening.md` |
| 백엔드 아키텍처 로드맵 | `docs/backend-architecture-plan.md` |
| 이메일 인프라 | `docs/email-infrastructure.md` |
| 프로토타입 핸드오프 명세 | `docs/prototype-handoff.md` |
| 프로덕션 버그 리스트 | `docs/bug-report-phase4.md` |
| 핸드오버 메모리 작성 규칙 | `docs/handover-memory-rule.md` |
| OAuth 보안 계획 | `docs/oauth-security-plan.md` |
| 인프라 스택 · 비용 | `docs/GTR_infrastructure.md` |
