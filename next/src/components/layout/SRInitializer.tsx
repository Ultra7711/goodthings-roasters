/* ══════════════════════════════════════════
   SRInitializer
   레이아웃 레벨 Scroll Reveal 초기화
   — 첫 마운트: 모바일 hydration 대비 150ms 대기 후 IO 부착
   — 재진입: Router Cache 가 복원한 sr--visible 을 유지
   — hit-test: IO 초기 콜백 의존 제거, getBoundingClientRect 로 동기 판정
   — MutationObserver: streaming SSR 로 layout useEffect fire 이후 도착하는
     섹션 DOM 도 즉시 감지해 등록. 폴링 없음.
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
    let mutationObserver: MutationObserver | null = null;
    const isFirstRun = isFirstRunRef.current;

    const oneShotSel = '[data-sr]:not([data-sr-toggle]):not([data-sr-story])';
    const toggleSel = '[data-sr-toggle]:not([data-sr-story])';

    const init = () => {
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

      /* 뷰포트 가시성 동기 판정. IO rootMargin 과 동일한 -20px 임계값. */
      const isInViewport = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight || document.documentElement.clientHeight;
        return r.top < vh - 20 && r.bottom > 0;
      };

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

      ioToggle = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) e.target.classList.add('sr--visible');
            else e.target.classList.remove('sr--visible');
          });
        },
        { threshold: 0.15, rootMargin: '0px 0px -20px 0px' },
      );

      /* One-shot: 이미 visible 이면 skip, 뷰포트 내면 즉시 표시, 밖이면 observe. */
      const registerOneShot = (el: HTMLElement) => {
        if (el.classList.contains('sr--visible')) return;
        if (isInViewport(el)) el.classList.add('sr--visible');
        else ioOneShot!.observe(el);
      };

      /* Toggle: 뷰포트 내면 즉시 visible 부여, 항상 observe (enter/exit 반복).
         IO.observe 는 동일 element 재호출 시 no-op 이므로 중복 안전. */
      const registerToggle = (el: HTMLElement) => {
        if (isInViewport(el)) el.classList.add('sr--visible');
        ioToggle!.observe(el);
      };

      /* 초기 등록 (현재 DOM 에 이미 있는 요소). */
      document.querySelectorAll<HTMLElement>(oneShotSel).forEach(registerOneShot);
      document.querySelectorAll<HTMLElement>(toggleSel).forEach(registerToggle);

      /* streaming SSR 로 늦게 도착하는 섹션 DOM 대응. childList 만 감시해
         비용 최소화. 동일 요소가 다시 추가돼도 sr--visible 체크·IO 중복
         observe 안전으로 no-op. */
      mutationObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (!(node instanceof HTMLElement)) continue;
            if (node.matches(oneShotSel)) registerOneShot(node);
            else if (node.matches(toggleSel)) registerToggle(node);
            node
              .querySelectorAll<HTMLElement>(oneShotSel)
              .forEach(registerOneShot);
            node
              .querySelectorAll<HTMLElement>(toggleSel)
              .forEach(registerToggle);
          }
        }
      });
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
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
      mutationObserver?.disconnect();
    };
  }, [pathname]);

  return null;
}
