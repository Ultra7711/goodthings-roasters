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
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('sr--visible');
            io.unobserve(e.target); // one-shot: 한 번 보이면 유지
          }
        });
      },
      { threshold: 0.3, rootMargin: '0px 0px -40px 0px' },
    );

    document.querySelectorAll<HTMLElement>('[data-sr]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);

  return null;
}
