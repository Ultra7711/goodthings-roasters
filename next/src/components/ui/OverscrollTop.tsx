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
    /* S-PND-1 후속 (PDP rubber-band white 회귀 fix · 리서치 + agent 결합 진단):
       iOS Safari/Chrome rubber-band 색 = body bg only (html bg 무시).
       이전: html.style 만 setting → body 는 OverscrollColor 의 stale 값 유지
       또는 OverscrollColor mount 전 globals.css default 비침.
       OverscrollColor 가 update() 호출 시 body 동기화하지만 PDP 진입 → mount
       race condition + visualViewport resize 시 stale 가능성.
       cafe-nutri S246 패턴 (html + body 동시 토글) 답습. */
    document.documentElement.style.backgroundColor = top;
    document.body.style.backgroundColor = top;

    return () => {
      resetColors();
      document.documentElement.style.backgroundColor = TOP_DEFAULT;
      document.body.style.backgroundColor = TOP_DEFAULT;
    };
  }, [top, bottom]);

  return null;
}
