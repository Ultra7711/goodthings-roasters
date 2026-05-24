/* ══════════════════════════════════════════
   HeroGreeting — 마이페이지 상단 인사 (V2 §3.2 · S197 PR-2)
   PR-2 §2.10: eyebrow 라벨 제거 + page-title 클래스 채택.
   PR-2 §2.13: 메타 라인 동적 우선순위 + 항목별 nav 진입 (사용자 결정).
   ══════════════════════════════════════════ */

'use client';

import '@/components/ui/PageTitle.css';
import './HeroGreeting.css';
import type { MyPageNavId } from './MyPageSideNav';

type Props = {
  name: string;
  ordersCount: number;
  activeSubscriptionsCount: number;
  membershipText: string | null;
  onLogout: () => void;
  /** 메타 항목 클릭 시 사이드바 view 전환 (S197 PR-2 §2.13 사용자 결정) */
  onNavigate: (id: MyPageNavId) => void;
};

type MetaPart = {
  key: string;
  label: string;
  navId: MyPageNavId;
};

export default function HeroGreeting({
  name,
  ordersCount,
  activeSubscriptionsCount,
  membershipText,
  onLogout,
  onNavigate,
}: Props) {
  /* 메타 항목 순서 = 사이드바 nav 순서 (orders → subscription → profile) 고정.
     카운트 0 인 항목은 숨김. 가입 N 은 membershipText 있을 때 항상 표시 (마지막).
     S264 H-1: 사이드바 라벨 통일 ("주문내역" 붙여쓰기 — 사이드바 다른 항목 정합). */
  const metaParts: MetaPart[] = [];
  if (ordersCount > 0) {
    metaParts.push({
      key: 'orders',
      label: `주문내역 ${ordersCount}`,
      navId: 'orders',
    });
  }
  if (activeSubscriptionsCount > 0) {
    metaParts.push({
      key: 'subscription',
      label: `정기배송 ${activeSubscriptionsCount}`,
      navId: 'subscription',
    });
  }
  if (membershipText) {
    metaParts.push({
      key: 'membership',
      label: membershipText,
      navId: 'profile',
    });
  }

  return (
    <header className="page-title-area mp-hero">
      <h1 className="page-title">
        <span className="mp-hero-greeting-line">안녕하세요,</span>{' '}
        <span className="mp-hero-greeting-line">{name}님.</span>
      </h1>
      <div className="mp-hero-meta-row">
        <p className="mp-hero-meta">
          {metaParts.map((part, idx) => (
            <span key={part.key}>
              {idx > 0 && <span className="mp-hero-meta-sep"> · </span>}
              <button
                type="button"
                className="mp-hero-meta-link"
                onClick={() => onNavigate(part.navId)}
                data-gtr-tap
              >
                {part.label}
              </button>
            </span>
          ))}
        </p>
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
