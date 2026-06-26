/* ══════════════════════════════════════════
   useItemArrivalGuard (S334)
   ?item= 진입 시 타겟 카드 "도착" 전까지 스크롤을 상단에 묶어
   "푸터 먼저 노출 + 빈페이지" race 를 차단한다.

   원인: home(scrollY 큼) → /menu·/shop ?item= 진입 시 콘텐츠/page 가
   확정되기 전 main 이 짧은 프레임을 거치며 window scrollY 가 짧은 docHeight 에
   clamp → 푸터(main 형제)가 viewport 로 올라옴. 모바일은 perPage 불일치
   (page=matchMedia 즉시 / slice=useMediaQuery 지연)로 docHeight 가 한 번 더
   출렁여 기존 scrollTo(0) 보정이 어긋남.

   해결: 진입 시 html.item-arriving { overflow:hidden } + scrollTo(0) 을 paint
   전(useLayoutEffect)에 걸어 docHeight 가 몇 번 변동하든 viewport 를 상단에
   고정(타이틀/필터 노출 = 빈페이지 아님, 푸터 화면 밖). 타겟 카드
   (GenericCard isHighlight)가 scrollIntoView 직전 unlockItemArrival() 로 해제.
   타겟 미발견/지연 시 GUARD_MAX_MS 타임아웃으로 강제 해제.
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';

const ARRIVAL_CLASS = 'item-arriving';
const GUARD_MAX_MS = 1200;

function lockToTop() {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.add(ARRIVAL_CLASS);
  window.scrollTo({ top: 0, behavior: 'instant' });
}

/** 타겟 카드 도착 시 GenericCard 가 호출 — 진입 가드 해제. lock 아니어도 무해. */
export function unlockItemArrival() {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.remove(ARRIVAL_CLASS);
}

function hasItemParam() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('item') !== null;
}

/**
 * @param routePath 이 가드가 담당하는 라우트 (재진입 gtr:route-change 필터용)
 */
export function useItemArrivalGuard(routePath: string) {
  const timerRef = useRef<number | null>(null);

  const arm = () => {
    lockToTop();
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      unlockItemArrival();
      timerRef.current = null;
    }, GUARD_MAX_MS);
  };

  // 최초 진입 — paint 전 lock (push/replace 로 ?item= 직접 진입)
  useLayoutEffect(() => {
    if (hasItemParam()) arm();
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      unlockItemArrival();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 재진입 — Activity preserve 로 unmount 안 되는 페이지의 route-change 보정.
  // NavigationVisibilityGate 가 gtr:route-change 발송.
  useEffect(() => {
    const onRouteChange = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== routePath) return;
      if (hasItemParam()) arm();
    };
    window.addEventListener('gtr:route-change', onRouteChange);
    return () => window.removeEventListener('gtr:route-change', onRouteChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routePath]);
}
