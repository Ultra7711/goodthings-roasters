'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * 모바일 스크롤(드래그) 중 :hover 가 발동하는 문제 방지.
 * touchstart 동안 html.is-touching 을 유지해 CSS에서 hover transition 차단.
 * touchend 후 300ms 뒤 제거 — tap 직후 click hover flash 방지.
 *
 * BUG-143: [data-gtr-tap] 요소 탭 피드백.
 * 모바일 탭 → .is-tapping 클래스 추가 → CSS 연출 재생 → 350ms 후 액션 실행.
 * 새 요소 등록: JSX에 data-gtr-tap 속성 추가 + CSS ::after gold 셋업.
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

  // BUG-143: 모바일 전용 탭 피드백 핸들러.
  // [data-gtr-tap] 요소 클릭을 캡처 단계에서 가로채고 → .is-tapping → TAP_MS 후 재발화.
  // WeakSet bypass: 재발화된 click은 재가로채기 없이 통과.
  // TAP_MS 조정: globals.css --duration-tap 값 하나만 변경하면 JS·CSS 동시 반영.
  useEffect(() => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--duration-tap').trim();
    const TAP_MS = raw
      ? raw.endsWith('ms') ? parseInt(raw, 10) : Math.round(parseFloat(raw) * 1000)
      : 350;
    const bypassed = new WeakSet<Element>();

    function onTapClick(e: MouseEvent) {
      const target = (e.target as Element).closest('[data-gtr-tap]') as HTMLElement | null;
      if (!target) return;
      if (bypassed.has(target)) { bypassed.delete(target); return; }
      if (!window.matchMedia('(hover: none)').matches) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (target.classList.contains('is-tapping')) return;
      if (target instanceof HTMLButtonElement && target.disabled) return;
      if (target.classList.contains('disabled')) return;

      e.preventDefault();
      // stopImmediatePropagation: 동일 document 에 등록된 다른 capture 핸들러
      // (NavigationVisibilityGate 의 [data-transitioning] gate) 가 탭 딜레이 도중
      // <main> 을 visibility:hidden 처리해 골드 라인을 가리는 문제 차단.
      // 재발화된 click(bypassed)은 early return 으로 통과시켜 정상 navigation 트리거.
      e.stopImmediatePropagation();

      target.classList.add('is-tapping');
      setTimeout(() => {
        target.classList.remove('is-tapping');
        bypassed.add(target);
        target.click();
      }, TAP_MS);
    }

    document.addEventListener('click', onTapClick, true);
    return () => document.removeEventListener('click', onTapClick, true);
  }, []);

  return null;
}
