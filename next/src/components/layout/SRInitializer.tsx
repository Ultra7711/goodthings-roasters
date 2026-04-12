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
       다음 페이지 애니메이션이 스킵되는 현상 방지.
       선택자는 [data-sr]:not([data-sr-toggle]) — 토글 동작이 필요한 요소
       (예: Story 페이지)는 [data-sr-toggle] 로 마킹하여 본 IO 가 잡지 않게 한다.
       Story IO 와 동일 요소를 두 IO 가 동시에 보면 one-shot 의 add 가 토글의
       remove 를 이기는 충돌이 발생하므로 양쪽을 분리한다. */
    const sel = '[data-sr]:not([data-sr-toggle])';
    document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
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

    document.querySelectorAll<HTMLElement>(sel).forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);

  return null;
}
