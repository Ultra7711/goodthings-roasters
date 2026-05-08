/* ══════════════════════════════════════════
   HeroGreeting — 마이페이지 상단 인사 (V2 §3.2 · S197 PR-2)
   PR-2 §2.10: eyebrow "MY PAGE" 라벨 제거 + page-title 클래스 채택
   (Shop/Menu/GoodDays 와 통일 — (main) 라우트 이동 후 격리 정책 무효).
   page-title 은 SSR 초기 상태 opacity:0/translateY(20) → hydration 후 is-loaded 활성.
   진입 연출 staggered transition 은 PR-2 §2.11 (C3) 에서 추가.
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useState } from 'react';
import '@/components/ui/PageTitle.css';
import './HeroGreeting.css';

type Props = {
  name: string;
  ordersCount: number;
  activeSubscriptionsCount: number;
  membershipText: string | null;
  onLogout: () => void;
};

export default function HeroGreeting({
  name,
  ordersCount,
  activeSubscriptionsCount,
  membershipText,
  onLogout,
}: Props) {
  const [isLoaded, setIsLoaded] = useState(false);
  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const metaParts: string[] = [];
  metaParts.push(`최근 주문 ${ordersCount}`);
  metaParts.push(`정기배송 ${activeSubscriptionsCount}`);
  if (membershipText) metaParts.push(membershipText);

  return (
    <header className={`page-title-area mp-hero${isLoaded ? ' is-loaded' : ''}`}>
      <h1 className="page-title">안녕하세요, {name} 님.</h1>
      <div className="mp-hero-meta-row">
        <p className="mp-hero-meta">{metaParts.join(' · ')}</p>
        <button
          type="button"
          className="mp-hero-logout"
          onClick={onLogout}
          data-gtr-tap
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}
