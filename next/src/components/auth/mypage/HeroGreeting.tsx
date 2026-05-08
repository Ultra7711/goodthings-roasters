/* ══════════════════════════════════════════
   HeroGreeting — 마이페이지 상단 인사 (V2 §3.2)
   eyebrow `MY PAGE` (.blk-label 통일) + "안녕하세요, [name] 님." H1
   + 메타 1줄 (최근 주문 · 진행 중 정기배송 · 가입 N개월) + 로그아웃 우측 baseline 정렬
   S197 PR-1.3 fix-up.
   ══════════════════════════════════════════ */

'use client';

import './HeroGreeting.css';

type Props = {
  name: string;
  ordersCount: number;
  activeSubscriptionsCount: number;
  membershipMonths: number | null;
  onLogout: () => void;
};

export default function HeroGreeting({
  name,
  ordersCount,
  activeSubscriptionsCount,
  membershipMonths,
  onLogout,
}: Props) {
  const metaParts: string[] = [];
  metaParts.push(`최근 주문 ${ordersCount}`);
  metaParts.push(`진행 중 정기배송 ${activeSubscriptionsCount}`);
  if (typeof membershipMonths === 'number') {
    metaParts.push(`가입 ${membershipMonths}개월`);
  }

  return (
    <header className="mp-hero">
      <span className="mp-hero-eyebrow">MY PAGE</span>
      <h1 className="mp-hero-greeting">안녕하세요, {name} 님.</h1>
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
