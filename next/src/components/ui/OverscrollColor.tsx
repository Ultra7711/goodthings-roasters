'use client';

import { useEffect } from 'react';
import { getTopColor, BOTTOM_COLOR } from './overscrollState';

const BOTTOM_THRESHOLD = 50;

export default function OverscrollColor() {
  useEffect(() => {
    const el = document.documentElement;

    const update = () => {
      const atBottom =
        window.scrollY + window.innerHeight >= el.scrollHeight - BOTTOM_THRESHOLD;
      el.style.backgroundColor = atBottom ? BOTTOM_COLOR : getTopColor();
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  return null;
}
