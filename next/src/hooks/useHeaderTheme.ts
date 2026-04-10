/* ══════════════════════════════════════════
   useHeaderTheme
   스크롤 위치 기반 헤더 라이트/다크 테마 판별
   프로토타입 goodthings_v1.0.html 헤더 테마 로직 이식
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef, useState } from 'react';
import type { HeaderTheme } from '@/types/navigation';

/** dataset 값이 유효한 HeaderTheme인지 런타임 검증 */
function isValidTheme(value: string | undefined): value is HeaderTheme {
  return value === 'light' || value === 'dark';
}

/**
 * 페이지 섹션의 `data-header-theme` 속성을 읽어
 * 헤더 중심선(midY)에 걸리는 섹션의 테마를 반환한다.
 *
 * @param headerRef - 헤더 DOM 요소 ref (높이 계산용)
 * @param initialTheme - SSR/hydration 시점의 초기 테마
 *                      (페이지별 설정은 `@/lib/headerThemeConfig` 참조)
 * @returns isDark: boolean — 다크 테마 여부
 */
export function useHeaderTheme(
  headerRef: React.RefObject<HTMLElement | null>,
  initialTheme: HeaderTheme = 'dark',
) {
  /* SSR/hydration 초기값은 페이지별 설정을 따른다.
     틀린 값으로 시작하면 페이지 로드 직후 light ↔ dark 플래시가 발생함.
     useEffect 실행 후 실제 DOM 섹션 기반으로 자동 보정된다. */
  const [isDark, setIsDark] = useState(initialTheme === 'dark');
  const rafPending = useRef(false);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    function update() {
      if (rafPending.current) return;
      rafPending.current = true;

      requestAnimationFrame(() => {
        rafPending.current = false;
        if (!header) return;

        const midY = header.getBoundingClientRect().top + header.offsetHeight / 2;
        const sections = document.querySelectorAll<HTMLElement>('[data-header-theme]');

        let theme: HeaderTheme | null = null;
        let bestTop = -Infinity;

        /* 1) midY를 포함하는 섹션 중 가장 위에 있는 것 선택 */
        sections.forEach((el) => {
          const rect = el.getBoundingClientRect();
          const raw = el.dataset.headerTheme;
          if (rect.top <= midY && rect.bottom > midY && rect.top > bestTop && isValidTheme(raw)) {
            bestTop = rect.top;
            theme = raw;
          }
        });

        /* 2) 갭 구간: midY 아래 가장 가까운 섹션 테마 사용 */
        if (!theme) {
          let nearest = Infinity;
          sections.forEach((el) => {
            const t = el.getBoundingClientRect().top;
            const raw = el.dataset.headerTheme;
            if (t > midY && t < nearest && isValidTheme(raw)) {
              nearest = t;
              theme = raw;
            }
          });
          if (!theme) theme = 'dark';
        }

        setIsDark(theme === 'dark');
      });
    }

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update(); // 초기 실행

    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [headerRef]);

  return { isDark };
}
