/* ══════════════════════════════════════════════════════════════════════════
   MenuLikeSheetButton — CafeNutritionSheet 콘텐츠 영역 좋아요 (S245-P20 재설계)

   위치 (사용자 spec):
   - 시트 콘텐츠 영역의 메뉴명 h2 와 같은 row 우측 (flex justify-between)

   디자인:
   - 기존 MenuLikeButton 시각 답습 (흰 반투명 + 흰 ♥)
   - liked = red solid bg + 흰 ♥
   - count > 0 = 가로 알약 확장 (baseline + countScrollWidth)
   - stone-light bg 위 시각 — 사용자 검증 후 컬러 조정 가능
   ══════════════════════════════════════════════════════════════════════════ */

'use client';

import { useLayoutEffect, useRef } from 'react';
import {
  useMenuLiked,
  useMenuLikesCount,
  toggleMenuLike,
} from '@/lib/menuLikesStore';
import { showToast } from '@/lib/toastStore';
import { getSessionSnapshot } from '@/hooks/useSupabaseSession';

type Props = {
  menuId: string;
  menuName: string;
};

function formatCount(n: number): string {
  if (n >= 1000) return `${+(n / 1000).toFixed(1)}K`;
  return String(n);
}

export default function MenuLikeSheetButton({ menuId, menuName }: Props) {
  const isLiked = useMenuLiked(menuId);
  const count = useMenuLikesCount(menuId);
  const btnRef = useRef<HTMLButtonElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);

  /* count 있을 때 baseline + countScrollWidth 로 확장 (MenuLikeCount 답습) */
  useLayoutEffect(() => {
    const btn = btnRef.current;
    const countEl = countRef.current;
    if (!btn) return;

    function getBaseline(el: HTMLElement): number {
      const raw = getComputedStyle(el)
        .getPropertyValue('--like-baseline')
        .trim();
      return parseInt(raw, 10) || 52;
    }

    if (count > 0 && countEl) {
      btn.style.width = `${Math.ceil(getBaseline(btn) + countEl.scrollWidth)}px`;
    } else {
      btn.style.width = '';
    }
  }, [count, isLiked]);

  const handleClick = () => {
    if (!isLiked && getSessionSnapshot().isLoggedIn) {
      showToast(`${menuName}에 좋아요를 눌렀어요❤`);
    }
    void toggleMenuLike(menuId);
  };

  return (
    <button
      ref={btnRef}
      id="cns-like"
      type="button"
      onClick={handleClick}
      className={
        (count > 0 ? 'cns-like--has-count ' : '') +
        (isLiked ? 'cns-like--liked' : '')
      }
      aria-label={isLiked ? '좋아요 취소' : '좋아요'}
      aria-pressed={isLiked}
    >
      <svg
        className="cns-like-icon"
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
        <span ref={countRef} className="cns-like-count">
          {formatCount(count)}
        </span>
      )}
    </button>
  );
}
