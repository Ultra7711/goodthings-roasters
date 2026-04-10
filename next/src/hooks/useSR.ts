/* ══════════════════════════════════════════
   useSR (Scroll Reveal)
   프로토타입 8978-8991 Scroll Reveal 로직 이식
   ──────────────────────────────────────────
   threshold:0.3, rootMargin:'0px 0px -40px 0px'
   → [data-sr] 요소에 sr--visible 클래스 토글
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef } from 'react';

/**
 * 컨테이너(또는 document) 내 [data-sr] 요소에
 * IntersectionObserver로 `.sr--visible` 클래스를 토글한다.
 *
 * @param containerRef - 관찰 범위를 제한할 컨테이너 ref.
 *                       null이면 document 전체를 대상으로 한다.
 */
export function useSR(containerRef?: React.RefObject<HTMLElement | null>) {
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const root = containerRef?.current ?? null;
    const scope = root ?? document;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('sr--visible');
          } else {
            e.target.classList.remove('sr--visible');
          }
        });
      },
      { threshold: 0.3, rootMargin: '0px 0px -40px 0px' },
    );

    observerRef.current = io;

    const els = scope.querySelectorAll<HTMLElement>('[data-sr]');
    els.forEach((el) => io.observe(el));

    return () => io.disconnect();
  }, [containerRef]);
}
