/* ══════════════════════════════════════════════════════════════════════════
   MenuLikeSheetButton — CafeNutritionSheet 콘텐츠 영역 좋아요 (S245-P20)

   위치: 시트 콘텐츠 영역 .cns-head-top 우측 (카테고리 행 + 메뉴명 세로 중앙)
   디자인: 기존 MenuLikeButton 시각 답습 (흰 반투명 · liked red solid · count 알약)
   연출: 파티클 burst (like 시점만) + pop 애니메이션 — 기존 답습 복원
   ══════════════════════════════════════════════════════════════════════════ */

'use client';

import { useRef, useState } from 'react';
import {
  useMenuLiked,
  useMenuLikesCount,
  toggleMenuLike,
} from '@/lib/menuLikesStore';
import { HeartIcon, formatLikeCount, useLikePillWidth } from './MenuLikeShared';
import { showToast } from '@/lib/toastStore';
import { getSessionSnapshot } from '@/hooks/useSupabaseSession';

type Props = {
  menuId: string;
  menuName: string;
};

/* 파티클 burst — 기존 MenuLikeButton 답습 */
const PARTICLE_COLORS = [
  '#E84E4E', '#FF7070', '#F0B849', '#FF8C69',
  '#E84E4E', '#F0B849', '#FF7070', '#FF8C69',
];
const PARTICLE_COUNT = 8;

function spawnParticles(btn: HTMLButtonElement) {
  const rect = btn.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const baseAngle = (360 / PARTICLE_COUNT) * i;
    const angle = baseAngle + (Math.random() * 24 - 12);
    /* S245-P20 fine tune: 범위 28~50 → 60~110 (가시성 ↑) */
    const distance = 60 + Math.random() * 50;
    const rad = (angle * Math.PI) / 180;
    const dx = Math.cos(rad) * distance;
    const dy = Math.sin(rad) * distance;
    /* 파티클 사이즈도 살짝 확대 (6~12 → 8~16) */
    const size = 8 + Math.random() * 8;

    const el = document.createElement('span');
    el.className = 'cm-like-particle';
    el.style.left = `${cx}px`;
    el.style.top = `${cy}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.background = PARTICLE_COLORS[i % PARTICLE_COLORS.length];
    el.style.setProperty('--dx', `${dx}px`);
    el.style.setProperty('--dy', `${dy}px`);

    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }
}

export default function MenuLikeSheetButton({ menuId, menuName }: Props) {
  const isLiked = useMenuLiked(menuId);
  const count = useMenuLikesCount(menuId);
  const btnRef = useRef<HTMLButtonElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const [popping, setPopping] = useState(false);

  /* count 있을 때 baseline + countScrollWidth 로 알약 확장 */
  useLikePillWidth(btnRef, countRef, count, isLiked);

  const handleClick = () => {
    /* like 시점만 — pop + particle burst (unlike 시 X) */
    if (!isLiked) {
      setPopping(true);
      if (btnRef.current) spawnParticles(btnRef.current);
      if (getSessionSnapshot().isLoggedIn) {
        showToast(`${menuName}에 좋아요를 눌렀어요❤`);
      }
    }
    void toggleMenuLike(menuId);
  };

  return (
    <button
      ref={btnRef}
      id="cns-like"
      type="button"
      onClick={handleClick}
      onAnimationEnd={() => setPopping(false)}
      className={
        (count > 0 ? 'cns-like--has-count ' : '') +
        (isLiked ? 'cns-like--liked ' : '') +
        (popping ? 'cns-like--popping' : '')
      }
      aria-label={isLiked ? '좋아요 취소' : '좋아요'}
      aria-pressed={isLiked}
    >
      <HeartIcon className="cns-like-icon" />
      {count > 0 && (
        <span ref={countRef} className="cns-like-count">
          {formatLikeCount(count)}
        </span>
      )}
    </button>
  );
}
