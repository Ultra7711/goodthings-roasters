# ADR-004: State Management 단일화 — Zustand 제거 로드맵

**Status:** Accepted — Implemented (Step A~D 완료)
**Date:** 2026-04-17 (최종 완료: 2026-04-18)
**Deciders:** GTR Frontend/Backend owners
**Related:** ADR-001 (OAuth 3-tier separation) · ADR-002 (결제 하이브리드 인증) · ADR-003 (RBAC) · BUG-003 · BUG-004

## 1. Context

현재 `next/src/lib/store.ts` 는 두 개의 Zustand persist store 를 보유합니다 — `useCartStore` (`gtr-cart-store`) 와 `useAuthStore` (`gtr-auth-store`). 2026-04-17 기준 아래 다섯 가지 구조적 문제가 누적되었습니다.

1. **ADR-001 "단일 소스 원칙" 침식** — ADR-001 은 `Server getClaims()` 를 보안 경계, `Supabase Session` 을 세션 원천, `Zustand` 를 "UI 힌트" 로만 정의했습니다. 그러나 실제로는 `useAuthStore.isLoggedIn` · `displayName` 이 초기 렌더 분기(헤더 메뉴, `/checkout` 가드 UX)의 **첫 번째 truth** 로 쓰이며, Supabase session 과 불일치할 수 있는 **두 번째 소스** 로 고착되었습니다.
2. **BUG-003/004 의 뿌리** — `/checkout` 직접 진입 시 localStorage persist hydration 이 첫 페인트보다 느려서 비회원 UI 가 고정되는 BUG-003, Zustand ↔ Supabase session mismatch 에서 파생된 `/login` 무한 루프 BUG-004 모두 "persist 상태를 프리렌더 분기의 근거로 삼는 구조" 가 원인입니다. `useHasHydrated` 응급 패치로 증상은 가릴 수 있으나 구조적 해결이 아닙니다.
3. **카트 이중 소스** — Session 12 에서 `cart_items` 테이블 + RLS + `/api/cart` 가 완비되어 DB 가 로그인 사용자 카트의 source of truth 가 되었음에도, `useCartStore.items` 는 여전히 localStorage 에 병렬 persist 됩니다. Session 13 merge 트리거는 "Zustand → DB 병합" 1 회성 이벤트이고, 이후 런타임에서는 양쪽을 수동 동기화해야 합니다.
4. **프로덕션 부적합 코드 잔존** — `DEMO_CREDENTIALS` 기반 `login/register` 가 `NODE_ENV === 'development'` 가드로 남아 있으며, store 내부 `purgeSession()` · `MOCK_LATENCY_MS` 등 데모 유물이 프로덕션 빌드 로직 경로를 흐립니다.
5. **P2-1 "완료" 표기의 부분성** — `docs/milestone-completed.md` 의 P2-1 은 `signOut`/`updateUser` 만 Supabase 직접 연동한 것으로, `useAuthStore` 자체 제거는 미착수입니다. ADR 로 명시적 번복이 필요합니다.

## 2. Decision

Zustand 를 제거하고 아래 구성으로 이행한다.

| 영역 | 최종 상태 |
|------|-----------|
| Auth (서버 경계) | Server Component 에서 `getClaims()` 를 호출하고, 필요한 필드를 Client Component props 로 전달 |
| Auth (클라이언트 반응성) | 경량 `useSupabaseSession` 훅 — `supabase.auth.onAuthStateChange` 구독 + `useSyncExternalStore` 로 React 18 concurrent safe |
| Cart (로그인) | **TanStack Query** 로 `/api/cart` 를 캐시 · `useCart()` / `useAddCartItem()` / `useUpdateCartItem()` mutation |
| Cart (비로그인) | 단일 목적 `useGuestCart` 훅 + localStorage (순수 in-hook 구현, persist middleware 없음) |
| Drawer open/close | React `useState` + `CartDrawerContext` (UI 전용 상태, 영속 불필요) |

**TanStack Query 선택 근거** — `/api/cart` 는 mutation 후 재검증이 잦고, optimistic update · 롤백 · 백오프 재시도가 빈번히 필요합니다. RSC-only Server Action 도 고려했으나 (1) 카트 드로어가 Client 컴포넌트이며 수량 변경 시 서버 왕복을 최소화해야 하고 (2) 이미 팀이 학습한 React Query 패턴의 러닝커브 비용이 낮아 채택합니다. Server Action 은 "카트 담기" 한 번짜리 동작(상품 카드)엔 병행 사용 가능.

## 3. Alternatives Considered

| 안 | 요약 | 결론 |
|----|------|------|
| A. Zustand 유지, persist 만 제거 | 가장 작은 변경, BUG-003 증상만 완화 | 이중 소스 근본 문제 미해결 — 기각 |
| B. Jotai (atoms) | 가볍고 SSR 친화 | 서버 캐시 문제는 여전히 수동 — 카트에 부적합 |
| C. Redux Toolkit Query | RTK Query 강력 | 번들·보일러플레이트 부담, 현 규모 과잉 — 기각 |
| D. SWR | 경량, Vercel 친화 | 기능상 TanStack Query 와 근접하나 mutation/optimistic DX 열세 — 기각 |
| **E. TanStack Query + 경량 hooks** | Cart 서버 캐시 + Auth 얇은 구독 + Drawer useState | **채택** |

## 4. Migration Plan

### Step A — 응급 패치 (Session 14)

- **범위**: `useHasHydrated` 훅 도입, `CheckoutPage.tsx` · `SiteHeader.tsx` · `useAuthGuard.ts` 에서 hydration 완료 전까지 "로딩 스켈레톤" 렌더. Zustand 유지.
- **선행조건**: 없음.
- **리스크**: 낮음. 실패 시 hook 제거만으로 롤백.
- **검증**: `/checkout` 직접 진입 시나리오 수동 스모크 (비회원/회원 각각). BUG-003 클로즈 (응급).
- **예상**: 0.5 세션 (Session 14 전반).

### Step B — Cart 이관 (Session 15)

- **범위**: `@tanstack/react-query` 추가, `QueryClientProvider` 를 `app/layout.tsx` 에 장착. `useCart` · `useAddCartItem` · `useUpdateCartItem` · `useRemoveCartItem` · `useClearCart` 훅 작성. `useGuestCart` 훅 신설 (localStorage 직접). 소비처 6 곳 (`CheckoutPage` · `OrderCompletePage` · `SiteHeader` · `ShopCard` · `PurchaseRow` · `useProductPurchase`) 마이그레이션. `cartMerge.ts` 를 "guest localStorage → `/api/cart/merge` POST" 로 재배선. `useCartStore` 삭제.
- **선행조건**: Step A 완료, `/api/cart*` 안정 (Session 12~13 완료 — 충족).
- **리스크**: 중간. optimistic update 롤백 실패 시 UI 수량 드리프트 → `onError` 에서 `invalidateQueries` 로 서버 값 복원.
- **검증**: Vitest — 훅 단위 테스트 + `cartService` mock. 수동 — 회원/비회원 담기·수량·병합·결제 직전 E2E 1회.
- **예상**: 1.5 세션.

### Step C — Auth 이관 (Session 16)

- **범위**: `useSupabaseSession` 훅 신설. `SiteHeader` · `MyPagePage` · `CheckoutPage` · `useAuthGuard` · `useAddressForm` · `useRegisterForm` · `useLoginForm` · `AuthSyncProvider` · `LoginPage` 를 `getClaims()` props 또는 `useSupabaseSession` 으로 전환. `useAuthStore` · `DEMO_CREDENTIALS` · `MOCK_LATENCY_MS` · `purgeSession` 삭제. Server Component 로 승격 가능한 페이지(`/mypage` 최상위, `/checkout` 가드) 는 props 경로 우선.
- **선행조건**: Step B 완료, Supabase OAuth 플로우 안정 (현재 충족).
- **리스크**: 높음. BUG-004 의 근본 수정이 이 단계에서 완료되어야 하며, session race condition 테스트 필수.
- **검증**: E2E — Kakao/Google/Naver 로그인 → 새로고침 → 로그아웃 → 재로그인 플로우. BUG-003/004 최종 클로즈.
- **예상**: 1.5 세션.

### Step D — 클린업 (Session 17) ✅ 완료 (2026-04-18, `bc6e2258`)

- **범위 (실행 결과)**:
  - `package.json` · `package-lock.json` 에서 `zustand` 의존성 삭제
  - `next/src/lib/store.ts` 파일 삭제
  - `useToast` 를 `lib/toastStore.ts` (순수 스토어) + `hooks/useToast.ts` (훅) 로 분리하여 zustand 의존성 완전 제거 · 서버 컴포넌트 import 안전
  - `AuthSyncProvider` 재작성: Zustand setter 제거 · `prevUserIdRef` 기반 cart merge 중복 호출 가드 · `showToast` 실패 피드백 · `.catch` unhandled rejection 방지
  - `DEMO_USER` · `DEMO_CREDENTIALS` · `MOCK_LATENCY_MS` · `purgeSession` 제거
  - `cartCalc.ts` · `orderService.test.ts` 의 `@/lib/store` import 경로를 `@/hooks/useCart` 로 이관
  - localStorage 키 마이그레이션 스크립트는 **불채택** — `persist.partialize` 로 이미 영속화 범위가 `isLoggedIn`/`displayName` 뿐이었고 재로그인 시 `useSupabaseSession` 으로 덮어써지므로 잔여 키 cleanup 불필요 판단 (Session 16 스모크에서 검증)
- **검증 결과**:
  - `grep "from 'zustand'" next/src` → 0 hits ✅
  - `tsc --noEmit` clean ✅
  - `vitest run` 378/378 green ✅
  - `next build` success ✅
  - Session 17 3병렬 리뷰 (code · typescript · silent-failure) HIGH 4·MED 4·LOW 2 → 전량 하드닝 (`bc6e2258`)
- **실제 소요**: 1 세션 (Session 17).

## 5. Non-goals

- RSC 전면 도입 (페이지 전환은 점진적)
- tRPC · GraphQL 도입
- 정기배송 엔진 상태 관리 (P2-C 영역)
- Admin UI 의 별도 상태 레이어

## 6. Consequences

**긍정** — ADR-001 단일 소스 준수, BUG-003/004 구조 해결, 번들 경량화(~8–15KB gzip 추정), 데모 코드 제거, 캐시 무효화 일원화.
**부정** — TanStack Query 학습 곡선, 기존 훅 테스트 재작성, P2-1 "완료" 표기 번복 필요, 마이그레이션 스크립트로 기존 사용자 localStorage 1회 정리.

## 7. Rollout & Success Criteria

단계별 완료 기준은 각 Step 검증 항목과 일치. 최종 수용 기준:

- [x] `rg "from 'zustand'" next/src` → 0 hits (2026-04-18)
- [x] `next/src/lib/store.ts` 삭제 (2026-04-18, `84c9474b`)
- [x] BUG-003 · BUG-004 구조 원인 제거 (Step C 완료 시점, Session 16) — E2E 회귀는 Phase 2-G 테스트 섹션에서 실행 예정
- [x] `DEMO_CREDENTIALS` · `MOCK_LATENCY_MS` 제거 (Session 16~17)
- [ ] 프로덕션 번들 First Load JS gzip 감소 측정 (Phase 2-G 번들 감사 때 일괄)
- [ ] `docs/oauth-security-plan.md` P2-1 · `docs/milestone-completed.md` 에 Step C 이행 각주 추가

## 8. Open Questions

1. **TanStack Query vs Server Action** — 본 ADR 은 카트 드로어의 mutation 빈도와 optimistic DX 를 근거로 TanStack Query 를 선택했다. 단, **상품 카드 "담기" 버튼 한정** Server Action 병행은 허용 — 라우트 세그먼트 `revalidatePath('/cart')` 로 간단히 정합성 유지 가능. 최종 판단은 Step B 킥오프 시 PoC 1일 후 확정 권장.
   - **결론 (Session 15, 2026-04-17):** TanStack Query 단일 채택 확정. Server Action 병행 PoC 는 Step D 번들 메트릭이 동기를 제공할 때까지 defer. 근거: 현재 6 개 소비처 모두 optimistic 경로 공유 + 단일 `['cart']` 키로 auth 이벤트 bridge 가 단순화 · 병행 시 2 경로 캐시 동기화 비용 추가 발생.
2. **Step A + Step B 같은 세션 여부** — **분리 권장**. Step A 는 릴리즈 가능한 응급 패치로 Session 14 전반에 클로즈하고 push. Step B 는 dependency 추가 · provider 배선 · 6 소비처 전환이 겹쳐 1.5 세션이 필요하므로 같은 세션에 묶으면 롤백 단위가 커진다.
3. **DEMO_CREDENTIALS 제거 시점** — Step C 와 동반 권장. 별도 선행 세션으로 빼면 `useAuthStore.login` 본체가 비는 "시체 훅" 상태가 생겨 되레 혼란. Step C 에서 훅 자체를 드랍하며 한 번에 정리.
