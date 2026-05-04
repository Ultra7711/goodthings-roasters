/* ══════════════════════════════════════════
   MenuTab — 카페 메뉴 split 좌측 사진 안 세로 탭
   (S150 V2 §2.5 PR-1c 사용자 커스텀)

   동작:
   - 매장 사진 안에 position: absolute 로 오버레이
   - 스크롤 진행도(0~1)에 따라 좌상단 → 좌하단 수직 이동 (X 고정)
   - 사진 영역 안에서만 한정 (overflow: hidden)
   - 클릭 → /menu 이동
   ══════════════════════════════════════════ */

'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

export default function MenuTab() {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const tab = ref.current;
    if (!tab) return;

    const container = tab.parentElement;
    if (!container) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let rafId: number | null = null;

    const update = () => {
      rafId = null;
      const rect = container.getBoundingClientRect();
      const vh = window.innerHeight;

      // progress: 0 = 사진 top 이 viewport bottom 에 닿는 시점 (entering)
      //           1 = 사진 bottom 이 viewport top 에 닿는 시점 (exited)
      const totalDist = vh + rect.height;
      const traveled = vh - rect.top;
      const progress = Math.max(0, Math.min(1, traveled / totalDist));

      const maxY = rect.height - tab.offsetHeight;
      tab.style.transform = `translateY(${maxY * progress}px)`;
    };

    const schedule = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <Link
      ref={ref}
      href="/menu"
      className="menu-tab"
      aria-label="전체 메뉴 보기"
    >
      <span>M</span>
      <span>E</span>
      <span>N</span>
      <span>U</span>
    </Link>
  );
}
