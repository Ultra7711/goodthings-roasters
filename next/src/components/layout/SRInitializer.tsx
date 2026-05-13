/* ══════════════════════════════════════════
   SRInitializer
   레이아웃 레벨 Scroll Reveal 초기화 (P9 단일화 · S220)

   spec:
   - 마커 단일화: [data-sr] (메인 콘텐츠) + [data-sr-eyebrow] (마스크 슬라이드)
   - 동작: 1회 재생 (one-shot · 발화 후 unobserve)
   - 발화점 통일: threshold 0.15 / rootMargin '0px 0px -20px 0px'
   - 첫 마운트: 모바일 hydration 대비 150ms 대기 후 IO 부착
   - 재진입: Router Cache 가 복원한 sr--visible / sr--ew 유지
   - hit-test: getBoundingClientRect 로 동기 판정
   - MutationObserver: streaming SSR 로 늦게 도착하는 섹션 즉시 등록
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export default function SRInitializer() {
  const pathname = usePathname();
  const isFirstRunRef = useRef(true);

  /* 스크롤바 거터 폭을 CSS 변수로 설정 — 마운트 + resize 마다 재측정.
     html { scrollbar-gutter: stable } 이 항상 거터 공간을 예약하므로
     overflow 유무와 무관하게 innerWidth - clientWidth = 거터 폭.
     #search-drop / #search-dim · drawer panel.right 오프셋에 활용해
     패널이 스크롤바 영역으로 삐져 나가지 않도록 한다. */
  useEffect(() => {
    const measure = () => {
      const sw = window.innerWidth - document.documentElement.clientWidth;
      document.documentElement.style.setProperty(
        '--scrollbar-w',
        `${sw > 0 ? sw : 0}px`,
      );
    };
    measure();
    window.addEventListener('resize', measure, { passive: true });
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    let ioMain: IntersectionObserver | null = null;
    let ioEyebrow: IntersectionObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    const isFirstRun = isFirstRunRef.current;

    const mainSel = '[data-sr]';
    const eyebrowSel = '[data-sr-eyebrow]';

    /* 통일 발화점 (P9 · S220):
       - threshold 0.15 — 요소 15% 가 뷰포트 안으로 들어오면 발화
       - rootMargin '0px 0px -20px 0px' — 뷰포트 하단 20px 안쪽 진입 시 시작 */
    const IO_OPTIONS: IntersectionObserverInit = {
      threshold: 0.15,
      rootMargin: '0px 0px -20px 0px',
    };

    const init = () => {
      /* 첫 마운트에만 sr--visible / sr--ew 리셋. 재진입 시에는 Router Cache 가 복원한
         상태를 유지해 페이지 전환 시 "깜빡임 + 동시 등장" 방지. */
      if (isFirstRun) {
        document.querySelectorAll<HTMLElement>(mainSel).forEach((el) => {
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

      /* Main one-shot: sr--visible 1회 부여 후 unobserve. */
      ioMain = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('sr--visible');
            ioMain?.unobserve(e.target);
          }
        });
      }, IO_OPTIONS);

      /* Eyebrow one-shot: sr--ew 1회 부여 후 unobserve.
         부여 클래스가 다르므로 IO 분리. CSS rule 은 그대로 (마스크 슬라이드 분리). */
      ioEyebrow = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('sr--ew');
            ioEyebrow?.unobserve(e.target);
          }
        });
      }, IO_OPTIONS);

      /* Main: 이미 visible 이면 skip, 뷰포트 내면 즉시 표시, 밖이면 observe. */
      const registerMain = (el: HTMLElement) => {
        if (el.classList.contains('sr--visible')) return;
        if (isInViewport(el)) el.classList.add('sr--visible');
        else ioMain!.observe(el);
      };

      /* Eyebrow: 이미 ew 이면 skip, 뷰포트 내면 즉시 부여, 밖이면 observe. */
      const registerEyebrow = (el: HTMLElement) => {
        if (el.classList.contains('sr--ew')) return;
        if (isInViewport(el)) el.classList.add('sr--ew');
        else ioEyebrow!.observe(el);
      };

      /* 초기 등록 (현재 DOM 에 이미 있는 요소). */
      document.querySelectorAll<HTMLElement>(mainSel).forEach(registerMain);
      document.querySelectorAll<HTMLElement>(eyebrowSel).forEach(registerEyebrow);

      /* streaming SSR 로 늦게 도착하는 섹션 DOM 대응. childList 만 감시해
         비용 최소화. 동일 요소가 다시 추가돼도 visible/ew 체크·IO 중복
         observe 안전으로 no-op. */
      mutationObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (!(node instanceof HTMLElement)) continue;
            if (node.matches(mainSel)) registerMain(node);
            if (node.matches(eyebrowSel)) registerEyebrow(node);
            node.querySelectorAll<HTMLElement>(mainSel).forEach(registerMain);
            node.querySelectorAll<HTMLElement>(eyebrowSel).forEach(registerEyebrow);
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
      ioMain?.disconnect();
      ioEyebrow?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [pathname]);

  return null;
}
