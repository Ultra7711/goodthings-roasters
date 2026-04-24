/* ══════════════════════════════════════════
   NavigationScrollReset
   BUG-006 H7 (S-footer-only) 구조적 해결 — S69

   문제: prev page scrollY > next page maxScroll 인 경우 브라우저가 scrollY 를
         next page 의 maxScroll 로 clamp → Next.js 16 scroll-to-top 이 577ms
         지연 실행되는 동안 viewport 가 footer 영역만 표시. docH 역전 조건이
         성립하는 어느 라우트 전환에서도 발생 가능.

   해결: pathname 변화 시 목적지 컨텍스트의 useLayoutEffect 로 scroll=0 을
         paint 전 동기 실행 → clamp 결과가 viewport 에 드러날 frame 자체 제거.

   back/forward 보존: popstate 이벤트로 traverse 플래그를 세팅하고, 해당
   경우엔 scrollTo 생략하여 브라우저의 native scroll restoration 을 보존.

   SR reveal 무관: 이 훅은 prev page 컨텍스트가 아닌 목적지 page mount
   타이밍에 실행 → D-018 A1-a 의 prev-page scrollTo 부작용과 구조적으로
   분리됨. SRInitializer 의 isInViewport 판정도 scroll=0 기준으로 올바르게
   계산됨 (useLayoutEffect 가 useEffect 보다 먼저 실행).

   ── DEBUG (S70 · 임시) ──────────────────────
   H7 QA 실패 원인 (a/b/c) 확정용 임시 console.log 삽입.
   측정 완료 후 일괄 제거 예정. 모든 로그에 [H7-dbg] 프리픽스.
     (a) useLayoutEffect 가 paint 후 실행 → rAF scrollY 가 effect scrollY 와 다름
     (b) Next.js 내부 scroll 복구와 race → 지연 샘플에서 scrollY 가 !=0 구간 관찰
     (c) iOS Safari 'instant' 미동작 → scrollTo 직후 scrollY !== 0
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export default function NavigationScrollReset() {
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);
  const isTraversingRef = useRef(false);

  useEffect(() => {
    const onPopstate = () => {
      isTraversingRef.current = true;
      // DEBUG
      console.log('[H7-dbg] popstate', {
        traversing: true,
        scrollY: window.scrollY,
        ts: Math.round(performance.now()),
      });
    };
    window.addEventListener('popstate', onPopstate);
    return () => window.removeEventListener('popstate', onPopstate);
  }, []);

  useLayoutEffect(() => {
    // DEBUG: 진입 시점 스냅샷
    const entrySnap = {
      phase: 'LE-entry',
      prev: prevPathRef.current,
      next: pathname,
      scrollY: window.scrollY,
      docH: document.documentElement.scrollHeight,
      vpH: window.innerHeight,
      traversing: isTraversingRef.current,
      ts: Math.round(performance.now()),
    };
    console.log('[H7-dbg] LE-entry', entrySnap);

    // 초기 mount: full page load. 브라우저 default scroll 동작에 맡김.
    if (prevPathRef.current === null) {
      prevPathRef.current = pathname;
      console.log('[H7-dbg] LE-skip-initial');
      return;
    }

    // 동일 pathname (filter searchParam 만 변경 등) 은 skip.
    if (prevPathRef.current === pathname) {
      console.log('[H7-dbg] LE-skip-samepath');
      return;
    }

    if (isTraversingRef.current) {
      // back/forward: 브라우저 native scroll restoration 보존.
      isTraversingRef.current = false;
      console.log('[H7-dbg] LE-skip-traverse');
    } else {
      // push/replace: H7 clamp 프레임 제거.
      console.log('[H7-dbg] scrollTo-before', {
        scrollY: window.scrollY,
        ts: Math.round(performance.now()),
      });
      window.scrollTo({ top: 0, behavior: 'instant' });
      console.log('[H7-dbg] scrollTo-after', {
        scrollY: window.scrollY,
        ts: Math.round(performance.now()),
      });

      // rAF: paint 직전 실제 scrollY (concurrent commit 검증)
      requestAnimationFrame(() => {
        console.log('[H7-dbg] rAF-1', {
          scrollY: window.scrollY,
          ts: Math.round(performance.now()),
        });
        requestAnimationFrame(() => {
          console.log('[H7-dbg] rAF-2', {
            scrollY: window.scrollY,
            ts: Math.round(performance.now()),
          });
        });
      });

      // 지연 샘플: Next.js 내부 scroll-to-top 이 뒤늦게 실행되는지 확인
      [50, 150, 300, 600, 1000].forEach((ms) => {
        setTimeout(() => {
          console.log(`[H7-dbg] t+${ms}`, {
            scrollY: window.scrollY,
            ts: Math.round(performance.now()),
          });
        }, ms);
      });
    }
    prevPathRef.current = pathname;
  }, [pathname]);

  return null;
}
