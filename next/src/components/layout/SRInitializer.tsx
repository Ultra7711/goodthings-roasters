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
    /* ── One-shot IO ──
       [data-sr] 요소는 한 번 보이면 유지 (unobserve).
       [data-sr-toggle] / [data-sr-story] 는 제외 — 각각 별도 IO 가 처리. */
    const oneShotSel = '[data-sr]:not([data-sr-toggle]):not([data-sr-story])';
    document.querySelectorAll<HTMLElement>(oneShotSel).forEach((el) => {
      el.classList.remove('sr--visible');
    });

    const ioOneShot = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('sr--visible');
            ioOneShot.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -20px 0px' },
    );
    document.querySelectorAll<HTMLElement>(oneShotSel).forEach((el) => ioOneShot.observe(el));

    /* ── Toggle IO ──
       [data-sr-toggle] 요소는 뷰포트 진입/이탈에 따라 sr--visible 토글.
       스크롤 업/다운 시 반복 재생. Story 페이지 전용 [data-sr-story] 는 제외. */
    const toggleSel = '[data-sr-toggle]:not([data-sr-story])';
    document.querySelectorAll<HTMLElement>(toggleSel).forEach((el) => {
      el.classList.remove('sr--visible');
    });

    const ioToggle = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('sr--visible');
          else e.target.classList.remove('sr--visible');
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -20px 0px' },
    );
    document.querySelectorAll<HTMLElement>(toggleSel).forEach((el) => ioToggle.observe(el));

    return () => {
      ioOneShot.disconnect();
      ioToggle.disconnect();
    };
  }, [pathname]);

  return null;
}
