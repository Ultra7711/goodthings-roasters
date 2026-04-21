'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * 모바일 스크롤(드래그) 중 :hover 가 발동하는 문제 방지.
 * touchstart 동안 html.is-touching 을 유지해 CSS에서 hover transition 차단.
 * touchend 후 300ms 뒤 제거 — tap 직후 click hover flash 방지.
 */
export default function TouchHoverGuard() {
  const pathname = usePathname();

  // 페이지 이동 후 브라우저가 이전 hover 상태를 유지하는 버그 방지.
  // pointer-events를 한 프레임 끊었다 복원하면 hover 재계산이 강제된다.
  useEffect(() => {
    document.body.style.pointerEvents = 'none';
    const id = requestAnimationFrame(() => {
      document.body.style.pointerEvents = '';
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

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
