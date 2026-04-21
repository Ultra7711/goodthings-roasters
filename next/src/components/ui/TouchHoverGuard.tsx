'use client';

import { useEffect } from 'react';

/**
 * 모바일 스크롤(드래그) 중 :hover 가 발동하는 문제 방지.
 * touchstart 동안 html.is-touching 을 유지해 CSS에서 hover transition 차단.
 * touchend 후 300ms 뒤 제거 — tap 직후 click hover flash 방지.
 */
export default function TouchHoverGuard() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const html = document.documentElement;

    function onTouchStart() {
      if (timer) clearTimeout(timer);
      html.classList.add('is-touching');
    }

    function onTouchEnd() {
      timer = setTimeout(() => html.classList.remove('is-touching'), 300);
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  return null;
}
