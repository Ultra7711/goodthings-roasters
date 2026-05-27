'use client';

import { useEffect } from 'react';

/* S289 진단 자산 — iOS Safari 26 PDP/cart rubber-band white 측정용.

   URL 쿼리 가드: ?eruda=1 가 있을 때만 Eruda DevTools 가 inject 됨.
   쿼리 없으면 0 작동 → production 일반 사용자 노출 없음.

   사용:
     모바일 실기기에서 https://<deploy-url>/<path>?eruda=1 접속
     → 화면 우하단 floating 아이콘 표시
     → 터치하여 Console / Elements 탭 사용 가능

   참조: lesson_pdp_overscroll_thrash.md L1 (실측 자산 의무)
*/
type ErudaWindow = Window & {
  eruda?: { init: () => void };
};

export default function ErudaInjector() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('eruda') !== '1') return;
    const w = window as ErudaWindow;
    if (w.eruda) {
      w.eruda.init();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/eruda';
    script.async = true;
    script.onload = () => {
      const ready = window as ErudaWindow;
      ready.eruda?.init();
    };
    document.head.appendChild(script);
  }, []);

  return null;
}
