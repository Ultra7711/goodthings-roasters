/* ══════════════════════════════════════════
   WelcomeCard — 신규 사용자 (주문·정기 모두 X) sand 패널 (V2 §3.2 · S197 PR-2 §2.3 상태 D)
   환영 카피 + "원두 둘러보기 →" CTA. sand 패널 layout 은 NextDeliveryCard.css 와 공유.
   ══════════════════════════════════════════ */

'use client';

import Link from 'next/link';
import './NextDeliveryCard.css';
import './WelcomeCard.css';

type Props = {
  /** 사용자 표시명 (인사 카피 활용) */
  userName: string;
};

export default function WelcomeCard({ userName }: Props) {
  return (
    <section className="mp-next-card mp-next-card--welcome" aria-label="환영합니다">
      <div className="mp-next-info">
        <h2 className="mp-next-name">
          {userName} 님, 어서오세요.
        </h2>
        <p className="mp-next-meta">원두를 둘러보면서 좋아하는 맛을 찾아보세요.</p>
        <Link href="/shop" className="mp-hero-cta" data-gtr-tap>
          원두 둘러보기 →
        </Link>
      </div>
    </section>
  );
}
