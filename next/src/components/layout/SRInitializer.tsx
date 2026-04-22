/* ══════════════════════════════════════════
   SRInitializer
   레이아웃 레벨 Scroll Reveal 초기화
   — 첫 마운트: 모바일 hydration 대비 150ms 대기 후 IO 부착
   — 재진입: Router Cache 가 복원한 sr--visible 을 유지
   — hit-test: IO 초기 콜백 의존 제거, getBoundingClientRect 로 가시성 선결정
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export default function SRInitializer() {
  const pathname = usePathname();
  const isFirstRunRef = useRef(true);

  useEffect(() => {
    let ioOneShot: IntersectionObserver | null = null;
    let ioToggle: IntersectionObserver | null = null;
    const isFirstRun = isFirstRunRef.current;

    const init = () => {
      const oneShotSel = '[data-sr]:not([data-sr-toggle]):not([data-sr-story])';
      const toggleSel = '[data-sr-toggle]:not([data-sr-story])';

      /* 첫 마운트에만 sr--visible 리셋. 재진입 시에는 Router Cache 가 복원한
         상태를 유지해 페이지 전환 시 "깜빡임 + 동시 등장" 방지. */
      if (isFirstRun) {
        document.querySelectorAll<HTMLElement>(oneShotSel).forEach((el) => {
          el.classList.remove('sr--visible');
        });
        document.querySelectorAll<HTMLElement>(toggleSel).forEach((el) => {
          el.classList.remove('sr--visible');
        });
      }

      /* 뷰포트 가시성 동기 판정 (IO 초기 콜백 의존 제거).
         rootMargin '0px 0px -20px 0px' 와 동일한 임계값 적용. */
      const isInViewport = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight || document.documentElement.clientHeight;
        return r.top < vh - 20 && r.bottom > 0;
      };

      /* One-shot IO: 이미 sr--visible 이거나 뷰포트 안에 있으면 즉시 표시하고
         observe 하지 않는다. 밖에 있는 것만 observe. */
      ioOneShot = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('sr--visible');
              ioOneShot?.unobserve(e.target);
            }
          });
        },
        { threshold: 0.15, rootMargin: '0px 0px -20px 0px' },
      );
      document.querySelectorAll<HTMLElement>(oneShotSel).forEach((el) => {
        if (el.classList.contains('sr--visible')) return;
        if (isInViewport(el)) {
          el.classList.add('sr--visible');
        } else {
          ioOneShot!.observe(el);
        }
      });

      /* Toggle IO: 뷰포트 진입·이탈마다 sr--visible 토글 (반복 재생).
         IO 초기 콜백이 간헐적으로 누락되는 경우를 대비해 hit-test 로
         현재 뷰포트 내부 요소는 선제 표시한 뒤 observe 등록. */
      ioToggle = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) e.target.classList.add('sr--visible');
            else e.target.classList.remove('sr--visible');
          });
        },
        { threshold: 0.15, rootMargin: '0px 0px -20px 0px' },
      );
      document.querySelectorAll<HTMLElement>(toggleSel).forEach((el) => {
        if (isInViewport(el)) el.classList.add('sr--visible');
        ioToggle!.observe(el);
      });
    };

    /* 첫 마운트: 느린 모바일 hydration 대비 150ms 대기.
       재진입: hydration 이미 완료 상태 → 즉시 실행으로 지연 제거. */
    const delay = isFirstRun ? 150 : 0;
    const timerId = setTimeout(() => {
      init();
      isFirstRunRef.current = false;
    }, delay);

    return () => {
      clearTimeout(timerId);
      ioOneShot?.disconnect();
      ioToggle?.disconnect();
    };
  }, [pathname]);

  return null;
}
