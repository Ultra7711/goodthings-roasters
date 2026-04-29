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

  /* 스크롤바 거터 폭을 CSS 변수로 설정 — 마운트 1회.
     html { scrollbar-gutter: stable } 이 항상 거터 공간을 예약하므로
     overflow 유무와 무관하게 innerWidth - clientWidth = 거터 폭.
     #search-drop / #search-dim 의 right 오프셋에 활용해
     패널이 스크롤바 영역으로 삐져 나가지 않도록 한다. */
  useEffect(() => {
    const sw = window.innerWidth - document.documentElement.clientWidth;
    if (sw > 0) {
      document.documentElement.style.setProperty('--scrollbar-w', `${sw}px`);
    }
  }, []);

  useEffect(() => {
    let ioOneShot: IntersectionObserver | null = null;
    let ioToggle: IntersectionObserver | null = null;
    let ioEyebrow: IntersectionObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    const isFirstRun = isFirstRunRef.current;

    const oneShotSel = '[data-sr]:not([data-sr-toggle]):not([data-sr-story])';
    const toggleSel = '[data-sr-toggle]:not([data-sr-story])';
    const eyebrowSel = '[data-sr-eyebrow]';

    const init = () => {
      /* 첫 마운트에만 sr--visible / sr--ew 리셋. 재진입 시에는 Router Cache 가 복원한
         상태를 유지해 페이지 전환 시 "깜빡임 + 동시 등장" 방지. */
      if (isFirstRun) {
        document.querySelectorAll<HTMLElement>(oneShotSel).forEach((el) => {
          el.classList.remove('sr--visible');
        });
        document.querySelectorAll<HTMLElement>(toggleSel).forEach((el) => {
          el.classList.remove('sr--visible');
        });
        document.querySelectorAll<HTMLElement>(eyebrowSel).forEach((el) => {
          el.classList.remove('sr--ew');
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

      /* Eyebrow 전용 IO: 뷰포트 하단 15% 위 도달 시 발화 (사용자가 반드시 보이는 위치).
         sr--ew 클래스를 토글 — 부모 sr--visible 경로와 독립. */
      ioEyebrow = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) e.target.classList.add('sr--ew');
            else e.target.classList.remove('sr--ew');
          });
        },
        { threshold: 0, rootMargin: '0px 0px -10% 0px' },
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

      /* Eyebrow: 뷰포트 내면 즉시 sr--ew 부여, 항상 observe. */
      const registerEyebrow = (el: HTMLElement) => {
        if (isInViewport(el)) el.classList.add('sr--ew');
        ioEyebrow!.observe(el);
      };

      /* 초기 등록 (현재 DOM 에 이미 있는 요소). */
      document.querySelectorAll<HTMLElement>(oneShotSel).forEach(registerOneShot);
      document.querySelectorAll<HTMLElement>(toggleSel).forEach(registerToggle);
      document.querySelectorAll<HTMLElement>(eyebrowSel).forEach(registerEyebrow);

      /* streaming SSR 로 늦게 도착하는 섹션 DOM 대응. childList 만 감시해
         비용 최소화. 동일 요소가 다시 추가돼도 sr--visible 체크·IO 중복
         observe 안전으로 no-op. */
      mutationObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (!(node instanceof HTMLElement)) continue;
            if (node.matches(oneShotSel)) registerOneShot(node);
            else if (node.matches(toggleSel)) registerToggle(node);
            else if (node.matches(eyebrowSel)) registerEyebrow(node);
            node
              .querySelectorAll<HTMLElement>(oneShotSel)
              .forEach(registerOneShot);
            node
              .querySelectorAll<HTMLElement>(toggleSel)
              .forEach(registerToggle);
            node
              .querySelectorAll<HTMLElement>(eyebrowSel)
              .forEach(registerEyebrow);
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
      ioEyebrow?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [pathname]);

  return null;
}
