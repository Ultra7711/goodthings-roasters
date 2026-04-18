# 코드 리뷰 Deferred 항목

> RP-3 Shop 페이지 작업 이후 코드 리뷰(typescript-reviewer, code-reviewer, security-reviewer 3명 교차)에서
> 도출된 항목 중, **애니메이션 동작 의도와 충돌하거나 현 시점에서 수정이 부적절한 항목**을 기록합니다.
>
> 추후 해당 컴포넌트 리팩터링 또는 반응형 작업 시 재검토하십시오.

---

# RP-4 Deferred (2026-04-12)

> 3총사 교차검증(typescript-reviewer + architect + silent-failure-hunter)에서 HIGH 5건은 커밋 `a7b19102` 로 반영.
> 아래는 pixel-port 원칙에 어긋나거나 RP-5 이후 컨텍스트에서 처리하는 것이 자연스러운 항목.

## RP4-D1 — `useProductPurchase.ts` 데드 코드

**파일:** `next/src/hooks/useProductPurchase.ts`

**현황:** 현재 `PurchaseRow` 는 자체적으로 qty/volIdx/orderType/cycle 상태를 관리하고 장바구니 추가 로직도 자체 `handleCart` (스텁) 에 직접 구현하도록 설계돼 있다. `useProductPurchase` 훅은 어느 컴포넌트에서도 호출되지 않는 dead code.

**Defer 이유:** RP-5 에서 장바구니 실제 연결 작업 시 **(A)** `PurchaseRow` 내부 상태를 이 훅으로 lift 해서 활용하든, **(B)** 훅 자체를 삭제하든 결정해야 한다. 지금 삭제하면 RP-5 때 재작성할 가능성이 있으므로 보류.

**RP-5 진입 시 결정 포인트:**
- `PurchaseRow` 가 `volIdx` 를 상위에서 lift-up 받고 있는 현재 구조를 유지할지
- 장바구니 추가 로직을 훅으로 분리할지 (orderType=subscription 분기가 있어서 훅 분리의 명분은 있음)

---

## RP4-D2 — `PurchaseRow.handleCart` 빈 스텁

**파일:** `next/src/components/product/PurchaseRow.tsx:114-117`

**현재 코드:**
```tsx
function handleCart() {
  if (disabled) return;
  /* RP-5 에서 실제 장바구니 추가 로직 연결 */
}
```

**Defer 이유:** silent-failure-hunter 가 H2 로 지적했으나, 이는 **의도된 RP-5 작업 경계**. 프로토타입에서는 `addToCart()` 호출 + CartDrawer 오픈이 이 지점에서 일어난다. RP-5 에서 `useCartStore().addItem` + `openDrawer()` 연결 예정.

**RP-5 작업 내용 (예상):**
- `selectedVolume` 에서 `price`/`label` 추출
- `orderType === 'subscription'` 일 때 `type: 'subscription'`, `period: '{cycle}주마다'` 추가
- `addItem` 호출 직후 `openDrawer()` (프로토타입 parity)
- `isSubscription && product.subscription` 이중 가드 유지

---

## RP4-D3 — `div[role=button]` → `<button>` 전환

**파일:** `next/src/components/product/PurchaseRow.tsx:316-330` (`#pd-cart-btn`)

**현황:** CTA 가 `div[role=button] tabIndex=0 onKeyDown` 패턴으로 구성돼 있음. 프로토타입 동일 마크업 유지 원칙으로 이식.

**Defer 이유:** 접근성 개선(semantic `<button>` 으로 변경)은 RP-11 반응형/프로덕션 Phase 에서 `ShopCard.sp-qa-bar` 등 유사 패턴과 **일괄 처리**. 지금 단독으로 바꾸면 스타일 리셋이 필요해서 범위가 커진다.

---

## RP4-D4 — ESLint `react-hooks/set-state-in-effect` 5건

**파일:**
- `next/src/components/product/ProductAccordions.tsx:39`
- `next/src/components/product/ProductDetailPage.tsx:62`
- `next/src/components/product/ProductGallery.tsx:39`
- `next/src/components/product/PurchaseRow.tsx:50`
- `next/src/components/shop/ShopPage.tsx:92` (`react-hooks/refs` — 렌더 중 ref 접근)

**현황:** 모두 slug/product/images 등 **prop 변경 시 내부 상태를 초기화**하는 패턴. React 19 의 `react-hooks` 플러그인이 effect 내 `setState` 를 경고로 잡지만, prototype 의식적인 리셋 로직이다.

**Defer 이유:**
- **pixel-port 원칙 준수:** 프로토타입은 동일 타이밍에 초기화를 수행하므로, `useMemo`/derived state 로 전환하면 타이밍이 달라질 수 있음
- **권장 대안:** React 공식 문서의 "Resetting state with a key" 패턴 (상위에서 `<Child key={slug} />`) 으로 전환 — RP-5 카페 메뉴 페이지 작업 시 전체 패턴을 점검하면서 결정
- ShopPage 의 `isInitRef.current` 렌더 중 변경은 이미 `code-review-deferred.md:M-3` 에 기록돼 있음

---

## RP4-D5 — Turbopack CSS HMR 캐시 이슈 (인프라)

**현황:** pixel-port 작업 중 `next dev --turbo` 에서 CSS 파일을 저장해도 서빙되는 chunk 가 갱신 안 되는 케이스가 간헐적으로 발생. `touch` 로는 불충분하고, 실제 편집이 들어가야 캐시 무효화됨.

**Defer 이유:** Next.js 16 Turbopack 의 알려진 이슈 가능성. RP-5 이후 재현 빈도 높아지면 `next dev` → `next dev --no-turbo` 전환 검토.

**참고:** `memory/feedback_turbopack_css_stale.md` 에 상세 기록 있음.

---

## M-1 — onKeyDown 타입 캐스팅

**파일:** `next/src/components/shop/ShopCard.tsx`

**현재 코드:**
```tsx
onKeyDown={(e) => {
  if (e.key === 'Enter' || e.key === ' ')
    handleBarClick(e as unknown as React.MouseEvent);
}}
```

**리뷰어 지적:** `KeyboardEvent`를 `MouseEvent`로 강제 캐스팅하는 것은 타입 안전성을 훼손한다.
이상적으로는 `handleBarClick`에 공통 이벤트 타입(예: `React.SyntheticEvent`)을 받도록 리팩터링하거나,
키보드 전용 핸들러를 분리해야 한다.

**Defer 이유:**
`handleBarClick` 내부에서 `e.stopPropagation()`이 필요하며, `KeyboardEvent`에도 `stopPropagation`이 존재하므로
런타임 동작은 정상이다. 리팩터링 시 `handleBarClick`의 시그니처 변경이 필요하고, 현재는 그 범위가 크므로 연기.

---

## M-2 — isMounted 패턴과 React Strict Mode

**파일:** `next/src/app/(main)/shop/page.tsx` (또는 ShopFilterTabs 관련 컴포넌트)

**현재 코드:**
```tsx
const isMounted = useRef(false);
useEffect(() => {
  if (!isMounted.current) { isMounted.current = true; return; }
  // 탭 인디케이터 transition 적용
}, [filter]);
```

**리뷰어 지적:** React Strict Mode에서는 effect가 두 번 실행되므로, `isMounted.current`가
첫 마운트에서 이미 `true`로 설정될 수 있다. 또한 `isMounted` 패턴 자체가 때때로 예상과 다르게 동작한다.

**Defer 이유:**
`isMounted` 패턴은 초기 마운트 시 인디케이터 슬라이드 없이 즉시 배치하고,
이후 필터 전환 시에만 transition을 활성화하기 위한 **의도적인 구현**이다.
Strict Mode 이중 실행이 문제가 되더라도, 시각적으로는 첫 렌더링에 약간의 슬라이드가 발생할 뿐이며
기능 오류는 없다. 반응형 작업 시 전체 ShopFilterTabs 리팩터링 때 재검토.

---

## M-3 — isInitRef 렌더 단계 접근

**파일:** `next/src/app/(main)/shop/page.tsx` (또는 ShopPage 컴포넌트)

**현재 코드:**
```tsx
const isInitRef = useRef(true);
// ...
const delay = isInitRef.current ? BASE_DELAY : 0;
isInitRef.current = false;  // 렌더 단계에서 ref 변경
```

**리뷰어 지적:** ref를 렌더 함수 본문 내에서 변경하는 것은 React의 Pure render 원칙에 위배된다.
`useEffect` 또는 이벤트 핸들러 내에서만 ref를 변경해야 한다.

**Defer 이유:**
`isInitRef`는 초기 페이지 진입 시 카드에 `baseDelay`를 주고, 이후 필터 전환 시에는 딜레이 없이
즉시 전환하기 위한 **의도적인 one-shot 플래그**이다.
렌더 단계 변경이 React 권고에 어긋나지만, ref는 React의 렌더링 추적 대상이 아니므로
실제 side effect(무한 리렌더 등)는 발생하지 않는다. 추후 `useEffect`로 이관 시
타이밍 문제를 별도 검증해야 한다.

---

## 참고 — 현 시점 적용된 수정 항목

| ID | 내용 | 상태 |
|----|------|------|
| H-1 | `closeQa` useCallback 처리 | ✅ 완료 |
| H-2 | `handleMouseEnter/Leave` getBar() 사용 | ✅ 완료 |
| H-3 | 드립백 `price` 필드 값 수정 | ✅ 완료 |
| M-4 | `badge-pop-2/3` 색상 토큰 검토 | ✅ 완료 |
| M-5 | `backdropFilter` inline style 주석 추가 | ✅ 완료 |
| M-1 | `onKeyDown` 타입 캐스팅 | ⏸ Defer (위 참고) |
| M-2 | `isMounted` Strict Mode 이슈 | ⏸ Defer (위 참고) |
| M-3 | `isInitRef` 렌더 단계 접근 | ⏸ Defer (위 참고) |
| H-4 | `globals.css` Shop CSS 분리 | ⏸ Defer (파일 크기·범위) |
