/* ══════════════════════════════════════════
   SRInitializer
   레이아웃 레벨 Scroll Reveal 초기화
   — 페이지 이동마다 [data-sr] 요소 재관찰
   ══════════════════════════════════════════ */

'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function SRInitializer() {
  const pathname = usePathname();

  useEffect(() => {
    let ioOneShot: IntersectionObserver | null = null;
    let ioToggle: IntersectionObserver | null = null;

    const init = () => {
      /* ── One-shot IO ──
         [data-sr] 요소는 한 번 보이면 유지 (unobserve).
         [data-sr-toggle] / [data-sr-story] 는 제외 — 각각 별도 IO 가 처리. */
      const oneShotSel = '[data-sr]:not([data-sr-toggle]):not([data-sr-story])';
      document.querySelectorAll<HTMLElement>(oneShotSel).forEach((el) => {
        el.classList.remove('sr--visible');
      });

      ioOneShot = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('sr--visible');
              ioOneShot?.unobserve(e.target);
            }
          });
        },
        { threshold: 0.15, rootMargin: '0px 0px -20px 0px' },
      );
      document.querySelectorAll<HTMLElement>(oneShotSel).forEach((el) => ioOneShot!.observe(el));

      /* ── Toggle IO ──
         [data-sr-toggle] 요소는 뷰포트 진입/이탈에 따라 sr--visible 토글.
         스크롤 업/다운 시 반복 재생. Story 페이지 전용 [data-sr-story] 는 제외. */
      const toggleSel = '[data-sr-toggle]:not([data-sr-story])';
      document.querySelectorAll<HTMLElement>(toggleSel).forEach((el) => {
        el.classList.remove('sr--visible');
      });

      ioToggle = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) e.target.classList.add('sr--visible');
            else e.target.classList.remove('sr--visible');
          });
        },
        { threshold: 0.15, rootMargin: '0px 0px -20px 0px' },
      );
      document.querySelectorAll<HTMLElement>(toggleSel).forEach((el) => ioToggle!.observe(el));
    };

    /* setTimeout 150ms:
       느린 모바일에서 React 클라이언트 컴포넌트 hydration 완료 후
       querySelectorAll 이 모든 [data-sr] 요소를 찾을 수 있도록 대기.
       rAF → queueMicrotask 는 hydration 완료 전에 실행될 수 있어 불충분. */
    const timerId = setTimeout(init, 150);

    return () => {
      clearTimeout(timerId);
      ioOneShot?.disconnect();
      ioToggle?.disconnect();
    };
  }, [pathname]);

  return null;
}
