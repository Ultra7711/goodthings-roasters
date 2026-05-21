/* ══════════════════════════════════════════════════════════════════════════
   MenuLikeCount — 카페 메뉴 카드 우하단 read-only 좋아요 인디케이터 (S245-P20)

   사용자 의도:
   기존 MenuLikeButton 의 시각 디자인 유지 + 인터랙션만 제거.
   - 흰 반투명 원형 (rgba 255,255,255,0.28) + backdrop blur
   - 흰 ♥ filled SVG (always filled · liked 무관)
   - liked = red solid bg + 흰 ♥
   - count > 0 = 가로 알약 확장 (count 흰색)
   - 클릭 = 카드 click handler (시트 진입) 동일. 토글/파티클 X.

   표시 정책:
   - count > 0 → 알약 확장
   - count = 0 + isLiked → 원형 (♥ 표시)
   - count = 0 + 안 누른 → hidden (null)
   ══════════════════════════════════════════════════════════════════════════ */

'use client';

import { useLayoutEffect, useRef } from 'react';
import { useMenuLikesCount, useMenuLiked } from '@/lib/menuLikesStore';

type Props = {
  menuId: string;
};

function formatCount(n: number): string {
  if (n >= 1000) return `${+(n / 1000).toFixed(1)}K`;
  return String(n);
}

export default function MenuLikeCount({ menuId }: Props) {
  const count = useMenuLikesCount(menuId);
  const isLiked = useMenuLiked(menuId);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);

  /* 기존 MenuLikeButton width 계산 답습 — count 있으면 baseline + countWidth 로 확장.
     baseline = 좌 padding + icon + gap + 우 padding (CSS 변수 --like-baseline 으로 BP 분기). */
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const countEl = countRef.current;
    if (!wrap) return;

    function getBaseline(el: HTMLElement): number {
      const raw = getComputedStyle(el)
        .getPropertyValue('--like-baseline')
        .trim();
      return parseInt(raw, 10) || 52;
    }

    if (count > 0 && countEl) {
      wrap.style.width = `${Math.ceil(getBaseline(wrap) + countEl.scrollWidth)}px`;
    } else {
      wrap.style.width = '';
    }
  }, [count, isLiked]);

  /* count 0 + 안 누른 메뉴 = 인디케이터 hidden (시각 노이즈 최소화) */
  if (count === 0 && !isLiked) return null;

  return (
    <span
      ref={wrapRef}
      className={
        'cm-like-count' +
        (count > 0 ? ' cm-like-count--has-count' : '') +
        (isLiked ? ' cm-like-count--liked' : '')
      }
      aria-hidden="true"
    >
      <svg
        className="cm-like-count-icon"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="none"
        aria-hidden="true"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      {count > 0 && (
        <span ref={countRef} className="cm-like-count-num">
          {formatCount(count)}
        </span>
      )}
    </span>
  );
}
