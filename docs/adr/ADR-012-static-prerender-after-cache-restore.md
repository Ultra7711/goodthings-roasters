# ADR-012 — use cache 복원 후 정적 가능 페이지의 connection() 제거

- **Status:** Accepted
- **Date:** 2026-06-23
- **Session:** S323
- **Related:** ADR-010 (caller-side connection 통일) / DEC-S278-1 (new Date prerender 룰) / S321 (use cache 복원·revalidateTag)
- **Supersedes (partial):** ADR-010 §Decision "caller-side connection() 통일" — 정적 가능 페이지 한정으로 connection() 생략 허용
- **Implementation:** S323 — `/shop`·`/menu`·`/shop/[slug]` 의 `await connection()` 제거. banners·cart·gooddays·api 는 유지.

## Context

ADR-010(S280-B)은 **caller-side connection() 통일**을 결정했다. 단 그 결정의 전제는 S279-D 시점 상태였다 — 당시 server fetch helper의 `'use cache'`가 **폐기**되어, caller의 `connection()`이 동적 강제로 admin 즉시 반영을 책임졌다.

**S321에서 전제가 바뀌었다:**
- 4도메인 helper(`productsServer`·`cafeMenuServer`·`gooddaysServer`·`bannersServer`)에 `'use cache'` + `cacheLife({revalidate:60})` **복원**.
- admin 변경 즉시 반영은 **`revalidateTag(<TAG>, 'max')`가 담당** — prod에서 정상 실증(S321: 배너·카페메뉴·상품 admin 토글 즉시 반영).

그 결과 정적 가능 페이지에서 `connection()`은 **admin 반영에 더는 필요 없는 잔재**가 되었고, cacheComponents(PPR) 환경에서 페이지를 `◐`(부분 prerender)로 묶어 **매 요청 서버 RSC 렌더 = Vercel Active CPU 소비**를 유발한다. caller 페이지 주석도 S279-D 그대로 stale로 남아 혼선을 유발(audit 중 분석 agent가 실제로 "use cache 폐기"로 오판).

## Decision

**S321 `'use cache'` 복원 + `revalidateTag` 반영 보장을 전제로, 정적 가능한 caller 페이지의 `connection()`을 제거하여 정적 prerender(`○`)로 전환한다.**

### 제거 (정적화)

| 페이지 | 근거 |
|--------|------|
| `/shop` | `fetchProducts` `'use cache'`·searchParams는 client(`useSearchParams`)·`revalidateTag(PRODUCTS_CACHE_TAG,'max')` |
| `/menu` | `fetchCafeMenu` `'use cache'`·searchParams client·`revalidateTag(CAFE_MENU_CACHE_TAG,'max')` |
| `/shop/[slug]` | `fetchProductBySlug` `'use cache'`·params 빌드타임(generateStaticParams) |

admin 즉시 반영 근거(전수): `productActions.ts`(toggle/update/create/delete/reorder 5곳)·`menu/actions.ts`(7곳)·`gooddays/actions.ts`(4곳)·`banners/actions.ts` 모두 `revalidateTag(tag, 'max')` 호출. cacheLife 60s는 무효화 실패 시 안전망.

### 유지 (connection/동적 — ADR-010 잔존)

| 대상 | 사유 |
|------|------|
| 홈 `CafeMenuSection`·`SignatureChapter` | `getActiveBanner`→`selectActiveBanner`가 `'use cache'` **밖**에서 `new Date()` today 계산(`bannersServer.ts:135-141`·DEC-S278-1) → 제거 시 빌드시각 고정 stale |
| `/cart` | `getClaims()`→`cookies()` 세션 의존 |
| `/gooddays` | `searchParams`(?img=) 서버 await + 라이트박스 첫 paint·back 버튼·메인 진입 연출(`gd-route-transition`) 얽힘 → 정적화 시 회귀 위험 (carry: 정적화 검토) |
| `api/reviews`·`api/menu-likes` | S295 `HANGING_PROMISE_REJECTION` 워크어라운드. route는 동적이라 Active CPU 효과 0 |

## Consequences

### 효과
- `/shop`·`/menu`·`/shop/[slug]` 셸 정적화 → 요청당 RSC 렌더 함수 0 → **Active CPU 소비 감소**(라이브 후 트래픽 성장 시 발현). 실 절감 폭은 트래픽 의존 → Vercel Observability로 측정.
- admin UX 무변화(revalidateTag 즉시 반영)·사용자 UX 무변화(정적 셸 + 동일 데이터).

### ADR-010 caller-chain 검증 의무 갱신
신규 SSR 페이지 추가 시 판단 기준:
1. 동적 의존(`new Date()`/`cookies()`/`headers()`/서버 `await searchParams`)이 **있으면** → `connection()` 또는 Suspense 경계로 동적 유지
2. 동적 의존이 **없고** helper가 `'use cache'`(+revalidateTag) 이면 → **`connection()` 생략, 정적 prerender** (본 ADR)

### 검증 절차
1. `next build` → 대상 3페이지가 `◐` → **`○`(Static)** 전환 확인
2. preview 배포 → admin 토글 → `/shop`·`/menu` 즉시 반영(revalidateTag) 확인
3. 홈·cart·gooddays 무영향 확인

## 변경 파일 (S323)
- `next/src/app/(main)/shop/page.tsx`·`menu/page.tsx`·`shop/[slug]/page.tsx` — `connection()` import + 호출 제거 + 주석 정정
- `next/src/app/(main)/gooddays/page.tsx` — connection 유지·stale 주석만 정정
- `docs/adr/ADR-010-*.md` — 부분 supersede 표기
- `docs/adr/ADR-012-*.md` — 본 ADR 신규

## 미해결 carry
- **gooddays 정적화** — searchParams를 client `useSearchParams`로 마이그(/shop·/menu 패턴 답습) 시 정적화 가능하나, 라이트박스 첫 paint 1프레임 지연·`useHistoryDismiss` back 버튼 회귀·메인 진입 연출 검증 필요. UX 충분 검증 후 별 sprint.
- **효과 측정** — 라이브 후 Active CPU·Pro credit 소진 추세 대조.
