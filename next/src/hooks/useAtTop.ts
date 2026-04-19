/* ══════════════════════════════════════════
   useAtTop
   window.scrollY <= 0 여부를 반환.
   미니 헤더(.chp-hdr-wrap) atTop 토글에 사용 —
   scrollY=0 시 solid bg, 스크롤 시 glass 복원.
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useState } from 'react';

export function useAtTop() {
  const [atTop, setAtTop] = useState(true);
  useEffect(() => {
    function onScroll() { setAtTop(window.scrollY <= 0); }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return atTop;
}
