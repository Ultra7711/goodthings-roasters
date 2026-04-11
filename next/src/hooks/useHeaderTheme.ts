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
 *          skipTransition: boolean — 라우트 변경 직후 한 프레임 동안만 true.
 *                          이 값이 true 인 동안 헤더에 `hdr-instant` 클래스를
 *                          걸어 CSS transition 을 일시 비활성화하면 네비게이션
 *                          애니메이션과 겹치는 테마 페이드가 사라진다.
 */
export function useHeaderTheme(
  headerRef: React.RefObject<HTMLElement | null>,
  initialTheme: HeaderTheme = 'dark',
) {
  /* SSR/hydration 초기값은 페이지별 설정을 따른다.
     틀린 값으로 시작하면 페이지 로드 직후 light ↔ dark 플래시가 발생함.
     useEffect 실행 후 실제 DOM 섹션 기반으로 자동 보정된다. */
  const [isDark, setIsDark] = useState(initialTheme === 'dark');
  /* 라우트 변경 직후 한 프레임 동안만 true — CSS transition 을 즉시 끄는 플래그 */
  const [skipTransition, setSkipTransition] = useState(false);
  const rafPending = useRef(false);

  /* 페이지 이동마다 initialTheme이 바뀌므로 ref로 최신값을 update() 클로저에 전달.
     동시에 isDark 상태도 새 페이지의 초기 테마로 리셋한다 — 그렇지 않으면:
     - 홈(dark)에서 /shop(light)으로 이동할 때 이전 페이지의 isDark=true 가 유지됨
     - 메인 effect 의 deps 는 [headerRef] 뿐이라 라우트 변경 시 재실행되지 않음
     - 사용자가 스크롤을 하지 않으면 update() 가 트리거되지 않아 stale 값 고착
     → headerThemeConfig 의 페이지별 초기 테마를 라우트 변경 직후 즉시 반영한다.
       이후 스크롤 시 update() 가 실제 [data-header-theme] 섹션 기반으로 재보정.

     추가: 테마 전환과 동시에 skipTransition=true 를 세팅해 CSS transition 을
     한 프레임 동안 끈다. 그렇지 않으면 route 네비게이션 애니메이션과 겹쳐
     헤더 배경이 slow fade 로 보이는 이슈가 발생. 더블 rAF 로 새 className 이
     실제 paint 된 다음 프레임에 플래그를 해제 → 그 이후의 스크롤 기반 전환은
     원래 transition duration 으로 복원된다. */
  const fallbackThemeRef = useRef<HeaderTheme>(initialTheme);
  useEffect(() => {
    fallbackThemeRef.current = initialTheme;
    setIsDark(initialTheme === 'dark');
    setSkipTransition(true);
    let id2 = 0;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setSkipTransition(false));
    });
    return () => {
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2);
    };
  }, [initialTheme]);

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
          /* 3) [data-header-theme] 섹션이 없는 페이지(Shop 등)는
                headerThemeConfig의 페이지별 초기 테마를 그대로 유지 */
          if (!theme) theme = fallbackThemeRef.current;
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

  return { isDark, skipTransition };
}
