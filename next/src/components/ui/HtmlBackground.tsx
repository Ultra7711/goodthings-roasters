'use client';

import { useEffect } from 'react';

interface HtmlBackgroundProps {
  color: string;
}

export default function HtmlBackground({ color }: HtmlBackgroundProps) {
  useEffect(() => {
    const el = document.documentElement;
    const prev = el.style.getPropertyValue('background-color');

    // CSS 변수 참조는 getComputedStyle로 해석 후 실제 hex 값으로 적용
    const resolved = color.startsWith('var(')
      ? getComputedStyle(el).getPropertyValue(
          color.slice(4, -1).trim()
        ).trim()
      : color;

    el.style.setProperty('background-color', resolved || color);

    return () => {
      if (prev) {
        el.style.setProperty('background-color', prev);
      } else {
        el.style.removeProperty('background-color');
      }
    };
  }, [color]);

  return null;
}
