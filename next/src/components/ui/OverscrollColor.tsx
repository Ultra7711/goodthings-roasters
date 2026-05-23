'use client';

import { useEffect } from 'react';
import { getTopColor, getBottomColor } from './overscrollState';

/* S263 B-1 — BOTTOM_THRESHOLD scroll 트리거 (50px) 외 IntersectionObserver 를
   푸터 진입 감지에 사용. 푸터 높이가 50px 보다 커서 BOTTOM_THRESHOLD 가
   푸터 진입 직후 시점을 못 잡는 케이스에서 html bg 가 WARM_BLACK 으로 남아
   푸터 영역 overscroll 시 색 부조화 발생하는 현상 차단. */
const BOTTOM_THRESHOLD = 50;

export default function OverscrollColor() {
  useEffect(() => {
    const el = document.documentElement;
    let footerInView = false;

    const update = () => {
      const atBottom =
        window.scrollY + window.innerHeight >= el.scrollHeight - BOTTOM_THRESHOLD;
      el.style.backgroundColor = atBottom || footerInView ? getBottomColor() : getTopColor();
    };

    update();
    window.addEventListener('scroll', update, { passive: true });

    /* footer 가 viewport 에 진입하는 순간 stone 으로 전환 — rubber-band overscroll
       시 html bg = stone 보장. 푸터 미존재 페이지 (없는 라우트) 에선 observer
       건너뜀 — scroll-based 트리거만 동작. */
    const footer = document.querySelector('footer');
    let observer: IntersectionObserver | null = null;
    if (footer) {
      observer = new IntersectionObserver(
        ([entry]) => {
          footerInView = entry.isIntersecting;
          update();
        },
        { rootMargin: '0px' },
      );
      observer.observe(footer);
    }

    return () => {
      window.removeEventListener('scroll', update);
      observer?.disconnect();
    };
  }, []);

  return null;
}
