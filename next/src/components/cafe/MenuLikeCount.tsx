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

import { useRef } from 'react';
import { useMenuLikesCount, useMenuLiked } from '@/lib/menuLikesStore';
import { HeartIcon, formatLikeCount, useLikePillWidth } from './MenuLikeShared';

type Props = {
  menuId: string;
};

export default function MenuLikeCount({ menuId }: Props) {
  const count = useMenuLikesCount(menuId);
  const isLiked = useMenuLiked(menuId);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);

  /* count 있으면 baseline + countWidth 로 알약 확장 (--like-baseline BP 분기). */
  useLikePillWidth(wrapRef, countRef, count, isLiked);

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
      <HeartIcon className="cm-like-count-icon" />
      {count > 0 && (
        <span ref={countRef} className="cm-like-count-num">
          {formatLikeCount(count)}
        </span>
      )}
    </span>
  );
}
