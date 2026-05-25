# ADR-010 — Caller-side connection() 책임: server fetch helper 패턴 통일

- **Status:** Accepted
- **Date:** 2026-05-25
- **Session:** S280-B (S279-D 후속 정합화)
- **Related:** DEC-S278-1 (new Date prerender 룰) / DEC-S279-D-1 (caller 측 connection 분리) / BUG-006 D-007 (root layout PPR 정합)
- **Supersedes:** DEC-S278 의 bannersServer helper-internal connection() 패턴 (S280-B 부 caller-side 통일)
- **Implementation:** S280-B — bannersServer.ts 의 `await connection()` 제거. CafeMenuSection / SignatureChapter 의 caller 측 connection() 유지.

## Context

Next.js 16 cacheComponents + PPR (Partial Pre-Rendering) 환경에서 server fetch helper 의 dynamic 강제 패턴이 두 sprint 에 걸쳐 분기됨:

### Pattern A — helper-internal connection() (S278 bannersServer)

```ts
// bannersServer.ts (S278)
export async function getActiveBanner(kind: BannerKind): Promise<Banner | null> {
  await connection();  // ← helper 안 호출
  const banners = await fetchEnabledByKind(kind);
  return selectActiveBanner(banners, kind);
}
```

- **장점**: caller 가 connection() 호출 누락해도 자동 dynamic 강제 (안전망)
- **단점**: build-time caller (generateStaticParams) 가 호출 시 `Error: connection() used inside generateStaticParams` build error

### Pattern B — caller-side connection() (S279-D 3-domain)

```ts
// productsServer.ts (S279-D)
export async function fetchProducts(): Promise<Product[]> {
  const client = getAnonClient();  // ← helper 안 connection() 없음
  // ...
}

// /shop/page.tsx (caller)
export default async function ShopRoute() {
  await connection();  // ← caller 측 명시
  const products = await fetchProducts();
  // ...
}
```

- **장점**: generateStaticParams (build-time) 가 helper 호출해도 안전 (lightweight variant 분리 가능)
- **단점**: caller 가 connection() 호출 누락 시 PPR shell stale 가능 (안전망 없음)

### S279-D 분기 발생 시점

S279-D fix 시 fetchProducts 가 `/shop/[slug]/generateStaticParams` 의 caller — Pattern A 답습 시 build error. 이를 회피하기 위해 Pattern B 채택 + `fetchAllProductSlugs()` lightweight variant 신규 추가.

cafe-menu / gooddays 는 build-time caller 없음 → Pattern A 도 가능했지만 **future-proof + 일관성 우선** 으로 Pattern B 적용. banners 만 Pattern A 잔존.

→ code-reviewer (S279-D) HIGH-2: **Pattern Inconsistency: banners vs. 3-domain split**.

## Decision

**caller-side connection() (Pattern B) 통일.** 모든 server fetch helper 는 helper 안 connection() 호출하지 않고, caller (SSR 페이지 server component) 가 명시적 `await connection()` 호출 책임.

### 1. banners 통합 (S280-B)

`bannersServer.ts` 의 `getActiveBanner` / `getComingBanner` 의 `await connection()` 제거. 2 caller 의 connection() 호출 유지:
- `CafeMenuSection.tsx` (line 54) — `await connection()` 호출 후 `getActiveBanner('cafe_event')` / `getComingBanner('cafe_event')`
- `SignatureChapter.tsx` (line 29) — `await connection()` 호출 후 `getActiveBanner('signature')`

### 2. site-settings 예외 (DEC-S279-D-2 · S281-A 보강)

`fetchSiteSettings` 는 root `layout.tsx` 에서 호출 → caller 측 connection() 추가 시 모든 페이지 PPR shell 폐기 + BUG-006 D-007 회귀 + 모바일 LCP 악화. **별 정책 유지** (`'use cache'` + `revalidateTag('site-settings', 'max')`).

**Trade-off 정량 분석** (S281-A):

| 항목 | banners 답습 시 | 현재 유지 (carry) |
|------|---|---|
| **모바일 3G/4G LCP** | 악화 (TTFB 증가) | 유지 (CDN edge cache hit) |
| **모든 페이지 CDN cache hit ratio** | 0% (dynamic header) | 80~95% |
| **server origin 부담** | 매 요청 처리 + DB hit | 캐시 hit |
| **운영자 변경 즉시 반영** | ✅ 매 요청 fresh | ❌ stale-while-revalidate (1회 stale 가능) |
| **BUG-006 D-007 정합** | ❌ X 수용 회귀 | ✅ PPR shell prerender 유지 |

**carry 일감 트리거 조건** (S281-A 명문화):

다음 중 하나 발생 시 site-settings 정책 재검토 (별 sprint):
1. **production 환경 운영자 변경 stale 1회 이상 보고** — 운영자가 "변경했는데 한참 뒤에 반영" 시각 보고
2. **변경 빈도 증가** — site-settings 변경이 주 1회 이상 → stale 1회 누적 영향 증가
3. **layout 분리 가능 시점** — Suspense boundary 안 fetchSiteSettings 격리 가능한 React 19+ 패턴 등장

**재검토 시 옵션** (carry 일감 메뉴):
- (a) `revalidateTag` → `updateTag` 마이그 — server action 내 read-your-own-writes (단 S278 학습 = dev 환경 inconsistent · production 신뢰 불확실)
- (b) root layout 외부 fetch 분리 — Suspense + per-page fetch (큰 리팩터)
- (c) `'force-cache'` profile 변경 — revalidateTag('site-settings', 'default') 시도 (Next.js 16 동작 검증 필요)

### 4. menu-likes 부분 답습 (S281-B)

`fetchMenuLikesCountsSnapshot` 은 `'use cache'` 유지 + cachedClient singleton 폐기 + `cache: 'no-store'` fetch override 만 적용.

**유지 이유**:
- 사용자 좋아요 count = stale 1회 수용 가능 (다른 사용자의 좋아요 직후 본인 화면 즉시 반영 요구 낮음)
- 본인 좋아요 = client `menuLikesStore` optimistic update 로 즉시 반영 (caller 측 별 메커니즘)
- `/api/menu-likes/[menuId]` POST/DELETE 시 `revalidateTag('menu-likes', 'max')` 호출 → 다음 요청 fresh

**부분 답습 정합 (S281-B)**:
- 'use cache' = caller `/menu` 가 dynamic 인 환경에서 fetchMenuLikesCountsSnapshot 정적 캐시 (DB 부담 감소)
- cachedClient singleton 폐기 + fetch override = dev HMR closure / Supabase REST default cache 회귀 차단 (S278 학습 #4/#5 답습)

### 3. lightweight variant 분리 (S279-D 답습)

build-time caller (generateStaticParams / generateMetadata) 가 server fetch helper 필요 시 connection() 없는 lightweight variant 분리:
- `fetchAllProductSlugs()` (S279-D) — `/shop/[slug]/generateStaticParams` 용

### 4. caller chain 검증 의무

신규 SSR 페이지 server component 추가 시:
- helper 호출 전 `await connection()` 명시
- intermediate wrapper (예: searchServer) 는 connection() 호출 X (wrapper caller 가 책임)
- generateStaticParams / generateMetadata 는 connection() 미호출 (build-time 안전)

## Consequences

### 정합 효과

1. **일관성**: 4 도메인 (banners + products + cafe-menu + gooddays) helper 패턴 통일
2. **build-time 안전**: 새 SSG path 추가 시 helper 호출 가능 (build error 회피)
3. **caller 명시성**: SSR 페이지의 dynamic 의도가 코드에 명시 (PPR boundary 가시)
4. **future-proof**: 새 build-time caller 추가 시 패턴 분기 회피

### Trade-off

1. **안전망 손실**: helper 안 connection() 자동 호출 없음. caller 누락 시 PPR stale 회귀 가능
   - **완화책**: code-reviewer agent + 신규 SSR 페이지 caller chain 검증 의무 + audit memory (`audit_s279d_cache_sweep`) reference
2. **DEC-S278-1 (`new Date()` prerender) 적용 범위 = caller 책임**:
   - bannersServer 의 `selectActiveBanner` 가 `new Date()` 사용 → caller 의 connection() 가 dynamic 강제 책임
   - caller 누락 시 fixed time cache → 영원히 stale 회귀 가능 (S278 incident 재현)

### 검증 절차 (신규 caller 추가 시)

1. `await connection()` 명시 (helper 호출 전)
2. `next build` PASS · PPR `◐` symbol 확인 (root layout 정적 shell 유지)
3. 개발 환경 운영자 변경 시각 즉시 반영 검증

## 변경 파일 (S280-B)

- `next/src/lib/bannersServer.ts` — `import connection` 제거 + getActiveBanner/getComingBanner 의 `await connection()` 제거 + 헤더 주석 갱신 (ADR-008 → ADR-010 reference)
- `next/src/components/home/CafeMenuSection.tsx` — 변경 없음 (이미 caller 측 connection() 호출)
- `next/src/components/home/SignatureChapter.tsx` — 변경 없음 (이미 caller 측 connection() 호출)
- `docs/adr/ADR-010-caller-side-connection-responsibility.md` — 본 ADR 신규 작성

## 미해결 carry (S281+)

### S281-A — site-settings 운영 검증
- DEC-S279-D-2 예외 유지의 production 정합 (운영자 시각 stale 모니터링)
- 1회 이상 stale 보고 시 → updateTag 마이그 또는 layout 외부 fetch 검토

### S281-B — fetchMenuLikesCountsSnapshot 정책 검토
- `/menu/page.tsx` 에서 fetchCafeMenu 와 Promise.all 호출
- 현재 `'use cache'` 유지 — 운영자 즉시 반영 요구 발생 시 답습 fix 검토

### S281-C — admin variant helper (lib/admin/*Server.ts) — ✅ 완료 (audit 결과 안전)

**audit 일시**: 2026-05-25 (S281-C)
**대상**: `lib/admin/*Server.ts` 10 파일 (analyticsServer / auditServer / bannersServer / cafeMenuServer / dashboardServer / newsletterServer / ordersServer / productsServer / subscriptionsServer / usersServer)

**검토 결과**:
| 검토 항목 | 결과 |
|----------|------|
| `'use cache'` 사용 | ❌ 0건 |
| `cachedClient` singleton 패턴 | ❌ 0건 |
| `new Date()` 의존 helper | ❌ 0건 |
| `connection()` 호출 | ❌ 0건 (불필요) |
| dynamic 강제 패턴 | ✅ `createRouteHandlerClient` (lib/supabaseServer.ts) → `await cookies()` 자동 강제 |

→ 답습 위험 0건. **코드 변경 0**. admin context 가 `createRouteHandlerClient` → `cookies()` 호출로 자동 dynamic 강제 = ADR-010 의 caller-side 책임 패턴 정합 (admin route 의 server component / actions 가 모두 cookies() 의존).

## 관련 메모리

- `memory/audit_s279d_cache_sweep.md` — DEC-S279-D-1/D-2 박음 + S280+ carry 일감
- `memory/project_session278_complete.md` — S278 banners cache fix baseline (Pattern A 도입 컨텍스트)
- `memory/project_session279_complete.md` — S279-D 답습 + Pattern B 도입
- `memory/project_bug006_decisions_log.md` — D-007 X 수용 (PPR shell 정합 baseline)
