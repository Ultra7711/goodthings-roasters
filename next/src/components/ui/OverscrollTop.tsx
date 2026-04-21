'use client';

import { useEffect } from 'react';
import { setTopColor, resetTopColor, TOP_DEFAULT } from './overscrollState';

interface OverscrollTopProps {
  color: string;
}

export default function OverscrollTop({ color }: OverscrollTopProps) {
  useEffect(() => {
    setTopColor(color);
    document.documentElement.style.backgroundColor = color;
    return () => {
      resetTopColor();
      document.documentElement.style.backgroundColor = TOP_DEFAULT;
    };
  }, [color]);

  return null;
}
