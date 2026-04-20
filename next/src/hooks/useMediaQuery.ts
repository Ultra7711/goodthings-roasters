/* ══════════════════════════════════════════
   useMediaQuery
   CSS media query 매칭 여부를 반환 — matchMedia 기반.
   SSR 안전: 초기값은 false 로 반환하고 마운트 후 갱신.
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useState } from 'react';

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
