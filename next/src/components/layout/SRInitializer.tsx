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
    /* 페이지 이동 시 sr--visible 초기화 — 이전 페이지에서 남은 클래스로
       다음 페이지 애니메이션이 스킵되는 현상 방지 */
    document.querySelectorAll<HTMLElement>('[data-sr]').forEach((el) => {
      el.classList.remove('sr--visible');
    });

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('sr--visible');
            io.unobserve(e.target); // one-shot: 한 번 보이면 유지
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -20px 0px' },
    );

    document.querySelectorAll<HTMLElement>('[data-sr]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);

  return null;
}
