/* ══════════════════════════════════════════
   NavigationScrollReset
   BUG-006 H7 (S-footer-only) 구조적 해결 — S69/S70

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

   S70 측정 확인: /menu → /shop 데스크탑 에뮬 + iPhone 실기기 양쪽에서 footer
   프레임 완전 제거 (M-003). prev-page 2-frame 잔상 (H8, ~34.7ms) 은 별개
   Next.js 16 구조적 특성이며 본 훅과 무관.
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
    };
    window.addEventListener('popstate', onPopstate);
    return () => window.removeEventListener('popstate', onPopstate);
  }, []);

  useLayoutEffect(() => {
    // 초기 mount: full page load. 브라우저 default scroll 동작에 맡김.
    if (prevPathRef.current === null) {
      prevPathRef.current = pathname;
      return;
    }

    // 동일 pathname (filter searchParam 만 변경 등) 은 skip.
    if (prevPathRef.current === pathname) return;

    if (isTraversingRef.current) {
      // back/forward: 브라우저 native scroll restoration 보존.
      isTraversingRef.current = false;
    } else {
      // push/replace: H7 clamp 프레임 제거.
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    prevPathRef.current = pathname;
  }, [pathname]);

  return null;
}
