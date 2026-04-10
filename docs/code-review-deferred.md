# 코드 리뷰 Deferred 항목

> RP-3 Shop 페이지 작업 이후 코드 리뷰(typescript-reviewer, code-reviewer, security-reviewer 3명 교차)에서
> 도출된 항목 중, **애니메이션 동작 의도와 충돌하거나 현 시점에서 수정이 부적절한 항목**을 기록합니다.
>
> 추후 해당 컴포넌트 리팩터링 또는 반응형 작업 시 재검토하십시오.

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
