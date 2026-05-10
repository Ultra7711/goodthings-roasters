/* ══════════════════════════════════════════
   MenuLikeButton — 카페 메뉴 카드 좋아요 버튼
   - 미클릭: 48px 원형, 글래스모피즘 배경, 흰색 솔리드 하트
   - 클릭됨: 붉은 솔리드 배경, 하트 좌측 + 카운트 슬라이드인
   - like 시: pop 애니메이션 + 파티클 버스트 (8개 원형 dot)
   - e.stopPropagation() 으로 영양 시트 오픈 방지
   ══════════════════════════════════════════ */

'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import {
  useMenuLikesCount,
  useMenuLiked,
  toggleMenuLike,
} from '@/lib/menuLikesStore';
import { showToast } from '@/lib/toastStore';
import { getSessionSnapshot } from '@/hooks/useSupabaseSession';

type Props = {
  menuId: string;
  /** 좋아요 토스트 메시지에 사용 (like 시 "{menuName}에 좋아요를 눌렀어요❤") */
  menuName: string;
};

function formatCount(n: number): string {
  if (n >= 1000) return `${+(n / 1000).toFixed(1)}K`;
  return String(n);
}

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
    const size = 6 + Math.random() * 6; // 6~12px

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

export default function MenuLikeButton({ menuId, menuName }: Props) {
  const count = useMenuLikesCount(menuId);
  const isLiked = useMenuLiked(menuId);
  const [popping, setPopping] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  /* 초기 데이터 로드 트랜지션 억제 — API 응답으로 count/isLiked 가 처음 바뀌는
     순간 전체 버튼이 동시에 애니메이션되는 버그 방지.
     useLayoutEffect: 브라우저 페인트 전에 실행 → transition:none 주입 후
     requestAnimationFrame 에서 복원 → 초기 상태는 즉시 표시, 이후 인터랙션은 정상 재생. */
  const initRef = useRef(false);
  useLayoutEffect(() => {
    const btn = btnRef.current;
    const countEl = countRef.current;
    if (!btn) return;

    /* baseline = CSS 변수 --like-baseline 으로 BP별 분기 (data: 56 / 모바일: 42).
       fallback 56 — 데스크탑 base. */
    function getBaseline(el: HTMLButtonElement): number {
      const raw = getComputedStyle(el).getPropertyValue('--like-baseline').trim();
      return parseInt(raw, 10) || 56;
    }

    if (!initRef.current && (count > 0 || isLiked)) {
      initRef.current = true;
      btn.style.transition = 'none';
      if (countEl) countEl.style.transition = 'none';
      if (count > 0 && countEl) {
        btn.style.width = `${Math.ceil(getBaseline(btn) + countEl.scrollWidth)}px`;
      }
      requestAnimationFrame(() => {
        btn.style.transition = '';
        if (countEl) countEl.style.transition = '';
      });
    } else if (count > 0 && countEl) {
      btn.style.width = `${Math.ceil(getBaseline(btn) + countEl.scrollWidth)}px`;
    } else {
      /* unlike: cm-like-count opacity transition(160ms) 완료 후 축소 */
      const timer = window.setTimeout(() => { btn.style.width = ''; }, 200);
      return () => window.clearTimeout(timer);
    }

    /* resize 대응 — BP 전환 시 baseline 변경(52↔42) 즉시 반영.
       transition 억제 후 적용 → 바운스 회피. */
    const onResize = () => {
      if (count > 0 && countEl) {
        const prev = btn.style.transition;
        btn.style.transition = 'none';
        btn.style.width = `${Math.ceil(getBaseline(btn) + countEl.scrollWidth)}px`;
        requestAnimationFrame(() => { btn.style.transition = prev; });
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [count, isLiked]);

  const handleClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (!isLiked) {
      setPopping(true);
      if (btnRef.current) spawnParticles(btnRef.current);
      /* 로그인 사용자만 like 토스트 — 비로그인 시는 toggleMenuLike 가 별도
         "로그인이 필요해요" 토스트를 띄우므로 중복 방지 */
      if (getSessionSnapshot().isLoggedIn) {
        showToast(`${menuName}에 좋아요를 눌렀어요❤`);
      }
    }
    void toggleMenuLike(menuId);
  };

  return (
    <button
      ref={btnRef}
      className={
        'cm-like-btn' +
        (count > 0 ? ' cm-like-btn--has-count' : '') +
        (isLiked ? ' cm-like-btn--liked' : '') +
        (popping ? ' cm-like-btn--popping' : '')
      }
      style={{
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
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
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="none"
        aria-hidden="true"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      <span className="cm-like-count" ref={countRef}>{count > 0 ? formatCount(count) : ''}</span>
    </button>
  );
}
