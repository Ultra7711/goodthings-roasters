/* ══════════════════════════════════════════════════════════════════════════
   MenuLikeSheetButton — CafeNutritionSheet hero 우상단 인터랙티브 좋아요 (S245-P20)

   배경:
   사용자 의도 = 좋아요 토글은 시트 안에서만. 카드는 read-only.
   영양정보 확인 후 좋아요 결정 (impulse → considered click).

   디자인:
   - close 버튼 답습 (40x40 원형 · backdrop blur · dark transparent bg)
   - close 좌측 위치 (right: 60px = close 의 right 12 + 40 + gap 8)
   - 토글 상태:
     · !isLiked → ♡ outline (흰색)
     · isLiked → ♥ filled (빨강)
   - 클릭 시 즉시 토글 + 사용자가 비로그인이면 토스트 (toggleMenuLike 내부 처리)
   ══════════════════════════════════════════════════════════════════════════ */

'use client';

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

export default function MenuLikeSheetButton({ menuId, menuName }: Props) {
  const isLiked = useMenuLiked(menuId);
  const count = useMenuLikesCount(menuId);

  const handleClick = () => {
    if (!isLiked && getSessionSnapshot().isLoggedIn) {
      showToast(`${menuName}에 좋아요를 눌렀어요❤`);
    }
    void toggleMenuLike(menuId);
  };

  return (
    <button
      id="cns-like"
      type="button"
      onClick={handleClick}
      className={isLiked ? 'cns-like--liked' : ''}
      aria-label={isLiked ? '좋아요 취소' : '좋아요'}
      aria-pressed={isLiked}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill={isLiked ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={isLiked ? '0' : '2'}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      {count > 0 && <span className="cns-like-count">{count}</span>}
    </button>
  );
}
