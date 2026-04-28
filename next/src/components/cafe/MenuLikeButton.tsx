/* ══════════════════════════════════════════
   MenuLikeButton — 카페 메뉴 카드 좋아요 버튼
   - 카드 우측 상단에 하트 아이콘 + 카운트
   - 탭 시 인스타그램 스타일 pop 애니메이션 (like 할 때만)
   - e.stopPropagation() 으로 영양 시트 오픈 방지
   ══════════════════════════════════════════ */

'use client';

import { useState } from 'react';

type Props = {
  menuId: string;
  count: number;
  isLiked: boolean;
  onToggle: (menuId: string) => void;
};

export default function MenuLikeButton({ menuId, count, isLiked, onToggle }: Props) {
  const [popping, setPopping] = useState(false);

  const handleClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (!isLiked) {
      setPopping(true);
    }
    onToggle(menuId);
  };

  return (
    <button
      className={
        'cm-like-btn' +
        (isLiked ? ' cm-like-btn--liked' : '') +
        (popping ? ' cm-like-btn--popping' : '')
      }
      onClick={handleClick}
      onAnimationEnd={() => setPopping(false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(e);
        }
      }}
      aria-label={isLiked ? '좋아요 취소' : '좋아요'}
      aria-pressed={isLiked}
      type="button"
    >
      <svg
        className="cm-like-icon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill={isLiked ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      {count > 0 && <span className="cm-like-count">{count}</span>}
    </button>
  );
}
