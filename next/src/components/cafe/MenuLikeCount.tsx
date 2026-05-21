/* ══════════════════════════════════════════════════════════════════════════
   MenuLikeCount — 카페 메뉴 카드 우상단 read-only 좋아요 인디케이터 (S245-P20)

   배경:
   기존 MenuLikeButton 가 카드에서 직접 토글 + 파티클 burst.
   사용자 의도 = 카드는 read-only · 토글은 시트 내 (MenuLikeSheetButton).
   카드 click = 시트 진입 유일 — e.stopPropagation 불필요.

   표시 정책:
   - count > 0: ♥/♡ + count
   - count = 0 + isLiked = true: ♥ only (count 없음)
   - count = 0 + isLiked = false: 표시 없음 (hidden)

   상태 구분:
   - isLiked → ♥ filled (red) + red count
   - !isLiked → ♡ outline (gray) + muted count
   ══════════════════════════════════════════════════════════════════════════ */

'use client';

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

  /* count 0 + 안 누른 메뉴 = 인디케이터 hidden (시각 노이즈 최소화) */
  if (count === 0 && !isLiked) return null;

  return (
    <span
      className={
        'cm-like-count' +
        (isLiked ? ' cm-like-count--liked' : ' cm-like-count--not-liked')
      }
      aria-hidden="true"
    >
      <svg
        className="cm-like-count-icon"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill={isLiked ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={isLiked ? '0' : '2'}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      {count > 0 && (
        <span className="cm-like-count-num">{formatCount(count)}</span>
      )}
    </span>
  );
}
