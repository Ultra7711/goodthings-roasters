/* ══════════════════════════════════════════════════════════════════════════
   MenuLikeShared — 카페 메뉴 좋아요 공용 (MenuLikeCount / MenuLikeSheetButton)

   두 컴포넌트가 공유하던 하트 SVG · count 포맷 · 알약 width 계산을 단일 소스화.
   시각 클래스(cm-* / cns-*)는 각 컴포넌트가 유지 — 로직만 공용.
   ══════════════════════════════════════════════════════════════════════════ */

'use client';

import { useLayoutEffect, type RefObject } from 'react';

/** 좋아요 카운트 표기 — 1000 이상은 K 축약 */
export function formatLikeCount(n: number): string {
  if (n >= 1000) return `${+(n / 1000).toFixed(1)}K`;
  return String(n);
}

/** 공용 하트 아이콘 (filled · currentColor). className 으로 색/크기 제어. */
export function HeartIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

/**
 * count > 0 일 때 컨테이너를 baseline + countScrollWidth 로 확장(알약).
 * baseline = CSS 변수 --like-baseline (BP 분기). count 0 이면 inline width 해제.
 */
export function useLikePillWidth<C extends HTMLElement, N extends HTMLElement>(
  containerRef: RefObject<C | null>,
  countRef: RefObject<N | null>,
  count: number,
  isLiked: boolean,
): void {
  useLayoutEffect(() => {
    const el = containerRef.current;
    const countEl = countRef.current;
    if (!el) return;

    if (count > 0 && countEl) {
      const raw = getComputedStyle(el).getPropertyValue('--like-baseline').trim();
      const baseline = parseInt(raw, 10) || 52;
      el.style.width = `${Math.ceil(baseline + countEl.scrollWidth)}px`;
    } else {
      el.style.width = '';
    }
    // isLiked 도 width 재계산 트리거 (liked 전환 시 레이아웃 보정) — 원본 동작 유지
  }, [count, isLiked, containerRef, countRef]);
}
