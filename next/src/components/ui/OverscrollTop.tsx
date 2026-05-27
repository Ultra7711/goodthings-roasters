'use client';

import { useEffect } from 'react';
import { setTopColor, setBottomColor, resetColors, TOP_DEFAULT } from './overscrollState';

interface OverscrollTopProps {
  top: string;
  bottom?: string; // 미지정 시 BOTTOM_DEFAULT(#4A4845) 유지
}

export default function OverscrollTop({ top, bottom }: OverscrollTopProps) {
  useEffect(() => {
    setTopColor(top);
    if (bottom) setBottomColor(bottom);
    document.documentElement.style.backgroundColor = top;

    /* S289 H-l: CafeNutritionSheet (S247) 답습 — 메뉴 바텀 시트가 동일 환경에서
       오버스크롤 색 정상 적용된 검증된 패턴. OverscrollColor 의 SSR/hydration
       race 우회 위해 page-level mount 시점에 body bg + theme-color meta 도 명시
       setting. iOS 26 Safari first paint sample 시점에 의도 색 박힘. 모바일
       한정 (max-width:767px) — 데스크탑은 rubber-band 영향 적음. */
    const isMobile =
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 767px)').matches;

    let prevBody = '';
    let metaEl: HTMLMetaElement | null = null;
    let metaCreated = false;
    let prevMetaContent = '';

    if (isMobile) {
      prevBody = document.body.style.backgroundColor;
      document.body.style.backgroundColor = top;

      metaEl = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (metaEl) {
        prevMetaContent = metaEl.content;
        metaEl.content = top;
      } else {
        metaEl = document.createElement('meta');
        metaEl.name = 'theme-color';
        metaEl.content = top;
        document.head.appendChild(metaEl);
        metaCreated = true;
      }
    }

    return () => {
      resetColors();
      document.documentElement.style.backgroundColor = TOP_DEFAULT;
      if (isMobile) {
        document.body.style.backgroundColor = prevBody;
        if (metaCreated && metaEl) {
          metaEl.remove();
        } else if (metaEl) {
          metaEl.content = prevMetaContent;
        }
      }
    };
  }, [top, bottom]);

  return null;
}
