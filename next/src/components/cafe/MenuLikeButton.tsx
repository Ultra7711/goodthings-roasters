/* ══════════════════════════════════════════
   MenuLikeButton — 카페 메뉴 카드 좋아요 버튼
   - 카드 우측 상단에 하트 아이콘 + 카운트
   - like 시: pop 애니메이션 + 파티클 버스트 (8개 원형 dot)
   - e.stopPropagation() 으로 영양 시트 오픈 방지
   ══════════════════════════════════════════ */

'use client';

import { useRef, useState } from 'react';

type Props = {
  menuId: string;
  count: number;
  isLiked: boolean;
  onToggle: (menuId: string) => void;
};

const PARTICLE_COLORS = ['#E84E4E', '#FF7070', '#F0B849', '#FF8C69', '#E84E4E', '#F0B849', '#FF7070', '#FF8C69'];
const PARTICLE_COUNT = 8;

function spawnParticles(btn: HTMLButtonElement) {
  const rect = btn.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const baseAngle = (360 / PARTICLE_COUNT) * i;
    const angle = baseAngle + (Math.random() * 24 - 12);
    const distance = 28 + Math.random() * 22;
    const rad = (angle * Math.PI) / 180;
    const dx = Math.cos(rad) * distance;
    const dy = Math.sin(rad) * distance;
    const size = 4 + Math.random() * 4; // 4~8px

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

export default function MenuLikeButton({ menuId, count, isLiked, onToggle }: Props) {
  const [popping, setPopping] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (!isLiked) {
      setPopping(true);
      if (btnRef.current) spawnParticles(btnRef.current);
    }
    onToggle(menuId);
  };

  return (
    <button
      ref={btnRef}
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
