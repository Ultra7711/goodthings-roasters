'use client';

import { useEffect } from 'react';
import { getTopColor, getBottomColor } from './overscrollState';

/* S263 B-1 v3 — fix v2 (footer.bg read) 적용 후에도 iOS Safari + Chrome 에서
   "footer 끝~viewport 바닥" 영역에 warm white 잔존 보고 (mypage 만).

   원인 (cafe-nutri S246 fix 답습 패턴):
   - html bg 만 토글 시 iOS 의 body transparent 영역에서 noise 잔존 → body 도 토글
   - theme-color meta default → iOS Chrome/Safari 의 viewport extra area 가 white
   - URL 바 transition 시 visualViewport resize → scroll 이벤트 안 발화 → stale

   다층 방어:
   1. html + body 동시 토글 (cafe-nutri 패턴 답습)
   2. theme-color meta 동기화 (iOS Chrome bottom URL 바 + Safari status bar)
   3. visualViewport resize listener (URL 바 transition 대응) */
const BOTTOM_THRESHOLD = 50;

export default function OverscrollColor() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    let footerInView = false;
    let footerBg: string | null = null;

    let metaEl = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    let metaCreated = false;
    if (!metaEl) {
      metaEl = document.createElement('meta');
      metaEl.name = 'theme-color';
      document.head.appendChild(metaEl);
      metaCreated = true;
    }

    const apply = (color: string) => {
      html.style.backgroundColor = color;
      body.style.backgroundColor = color;
      if (metaEl) metaEl.content = color;
    };

    const update = () => {
      /* modal/sheet open 시 (body.overflow:hidden) skip — cafe-nutri 등 자체 색
         처리 컴포넌트와 충돌 차단. body.bg / theme-color meta 가 시트 자체 값 유지. */
      if (body.style.overflow === 'hidden') return;
      /* S298: 상단 rubber-band (scrollY < 0) → 콘텐츠 길이 무관 항상 top color.
         짧은 페이지(콘텐츠 < viewport)에서 atBottom 이 항상 true 가 되어 상단 당김도
         bottom 색이 적용되던 문제 차단 — 상단은 top(어나운스) 강제. */
      if (window.scrollY < 0) {
        apply(getTopColor());
        return;
      }
      const atBottom =
        window.scrollY + window.innerHeight >= html.scrollHeight - BOTTOM_THRESHOLD;
      if (footerInView && footerBg) {
        apply(footerBg);
      } else if (atBottom) {
        apply(getBottomColor());
      } else {
        apply(getTopColor());
      }
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    /* iOS Safari/Chrome URL 바 transition: window.resize 발화 안 됨. visualViewport
       resize 만 발화 → update 누락 차단. */
    window.visualViewport?.addEventListener('resize', update);

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
      window.visualViewport?.removeEventListener('resize', update);
      observer?.disconnect();
      mutationObs.disconnect();
      if (metaCreated && metaEl) metaEl.remove();
    };
  }, []);

  return null;
}
