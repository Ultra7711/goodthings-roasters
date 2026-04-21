'use client';

import { useEffect } from 'react';

interface HtmlBackgroundProps {
  color: string;
}

export default function HtmlBackground({ color }: HtmlBackgroundProps) {
  useEffect(() => {
    const prev = document.documentElement.style.backgroundColor;
    document.documentElement.style.backgroundColor = color;
    return () => {
      document.documentElement.style.backgroundColor = prev;
    };
  }, [color]);

  return null;
}
