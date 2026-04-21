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

    return () => {
      resetColors();
      document.documentElement.style.backgroundColor = TOP_DEFAULT;
    };
  }, [top, bottom]);

  return null;
}
