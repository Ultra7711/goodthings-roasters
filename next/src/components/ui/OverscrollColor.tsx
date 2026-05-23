'use client';

import { useEffect } from 'react';
import { getTopColor, getBottomColor } from './overscrollState';

/* S263 B-1 v2 — 회귀 원인:
   - OverscrollTop 의 setBottomColor 가 글로벌 변수에 저장. 4 페이지가 bottom="#FBF8F3"
     (warm white) 설정 → unmount cleanup race / SPA navigation 타이밍으로 stale 잔존
     가능. mypage 의 OverscrollTop 은 bottom 미지정 → 이전 페이지의 warm white 가
     bottomColor 변수에 남아 footer 진입 후 사용자가 본 "웜화이트 물결".
   - BOTTOM_THRESHOLD=50 scroll 트리거 외 IntersectionObserver 로 footer 진입 감지.
   - footer 의 실제 computed background-color 를 read 해서 우선 사용 → 전역 변수
     race 차단. footer 가 없는 페이지 (예: order-complete) 는 기존 getBottomColor()
     variable 동작 유지 (페이지가 명시한 색). */
const BOTTOM_THRESHOLD = 50;

export default function OverscrollColor() {
  useEffect(() => {
    const el = document.documentElement;
    let footerInView = false;
    let footerBg: string | null = null;

    const update = () => {
      const atBottom =
        window.scrollY + window.innerHeight >= el.scrollHeight - BOTTOM_THRESHOLD;
      if (footerInView && footerBg) {
        el.style.backgroundColor = footerBg;
      } else if (atBottom) {
        el.style.backgroundColor = getBottomColor();
      } else {
        el.style.backgroundColor = getTopColor();
      }
    };

    update();
    window.addEventListener('scroll', update, { passive: true });

    const setupFooterObserver = (footer: HTMLElement): IntersectionObserver => {
      footerBg = window.getComputedStyle(footer).backgroundColor;
      const obs = new IntersectionObserver(
        ([entry]) => {
          footerInView = entry.isIntersecting;
          update();
        },
        { rootMargin: '0px' },
      );
      obs.observe(footer);
      return obs;
    };

    let observer: IntersectionObserver | null = null;
    const footer = document.querySelector<HTMLElement>('footer');
    if (footer) {
      observer = setupFooterObserver(footer);
    }

    /* MainLayout 의 FooterRoute 분기로 페이지 navigation 시 footer DOM 이
       remount 될 수 있음 (예: /order-complete 등). MutationObserver 로 새 footer
       감지하여 observer 재설정. */
    const mutationObs = new MutationObserver(() => {
      const currentFooter = document.querySelector<HTMLElement>('footer');
      if (currentFooter && !footer?.isConnected) {
        observer?.disconnect();
        observer = setupFooterObserver(currentFooter);
      } else if (!currentFooter && footer) {
        observer?.disconnect();
        observer = null;
        footerInView = false;
        footerBg = null;
        update();
      }
    });
    mutationObs.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener('scroll', update);
      observer?.disconnect();
      mutationObs.disconnect();
    };
  }, []);

  return null;
}
