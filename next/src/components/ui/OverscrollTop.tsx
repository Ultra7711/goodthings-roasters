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
    /* S289 (S-PND-1+2 후속) H-d: html bg 만 직접 setting 시 OverscrollColor 의
       후속 useEffect (body bg 동기) 까지 mount-level race 가능. iOS Safari 26 의
       rubber-band 색 = body bg 우선 (zulip #37367 · nasedk.in · ben frain) →
       body bg 가 race 사이 transparent/white 잔존 시 PDP/cart 양쪽 rubber-band
       에 white 가 보이는 가설. body bg 도 동일 시점에 직접 setting. */
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
