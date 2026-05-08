/* ══════════════════════════════════════════
   MyPageSkeleton — V2 §3 신구조 (S197 PR-2)
   /mypage Suspense fallback. requireAuth + hydration 동안 노출.
   PR-2 §2.1: (main) layout 답습 → SiteHeader/Footer 자동, 자체 mini-shell 제거.
   PR-2 §2.10: eyebrow 라벨 placeholder 제거 (page-title 만).
   PR-2 §2.7: sub-nav placeholder 6 → 4 항목 동기화.

   CSS 명시 import — Skeleton 은 server component 라 client chunk 의 css 가
   fallback 시점에 일부 미로딩 가능 (sand 카드 width 단차 발생). 같은 css 를
   여기서 명시 import 하여 fallback chunk 에 포함 → 단차 차단.
   ══════════════════════════════════════════ */

import './MyPagePage.css';
import '@/components/ui/PageTitle.css';
import '@/components/auth/mypage/HeroGreeting.css';
import '@/components/auth/mypage/NextDeliveryCard.css';
import '@/components/auth/mypage/MyPageSideNav.css';
import '@/components/auth/mypage/MyPagePanel.css';

/* placeholder height — line-height 토큰 활용 (viewport 분기 자동 정합).
   - H1 (page-title) → var(--lh-h1) (mobile 40 / tablet 44 / desktop 52)
   - H3 (mp-next-name) → var(--lh-h3) (mobile 20 / tablet 20 / desktop 32 line-height)
   - body-* 는 line-height 토큰 없음 → 컴포넌트 CSS 의 line-height 명시 값과 정합 */
const H_PAGE_TITLE = 'var(--lh-h1)';
const H_H3 = 'var(--lh-h3)';
const H_BODY_L = 28;
const H_BODY_M = 24;
const H_BODY_UI = 21;

type BoxProps = {
  height: number | string;
  width?: number | string;
};

function SkelBox({ height, width = '100%' }: BoxProps) {
  return <div className="skel" style={{ height, width }} />;
}

export default function MyPageSkeleton() {
  return (
    <div className="mp-body">
      {/* Hero greeting placeholder — H1 line-height 48 · 메타 body-l 28 정합 */}
      <div className="page-title-area mp-hero">
        <SkelBox height={H_PAGE_TITLE} width={300} />
        <div className="mp-hero-meta-row">
          <SkelBox height={H_BODY_L} width={200} />
          <SkelBox height={H_BODY_L} width={64} />
        </div>
      </div>

      {/* NextDeliveryCard placeholder — PR-2: text-link cta (mp-hero-cta) · grid 1fr/240px */}
      <section className="mp-next-card" aria-hidden="true">
        <div className="mp-next-info">
          <SkelBox height={H_H3} width="60%" />
          <SkelBox height={H_BODY_UI} width="40%" />
          <div style={{ marginTop: 16 }}>
            <SkelBox height={H_BODY_M} width={120} />
          </div>
        </div>
        <div className="mp-next-image">
          <div className="mp-next-image-placeholder" />
        </div>
      </section>

      {/* mp-grid: side-nav + panel */}
      <div className="mp-grid">
        {/* Side nav placeholder (4 항목 · padding 14 20 · body-l) */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ padding: '14px 20px' }}>
              <SkelBox height={H_BODY_L} width="60%" />
            </div>
          ))}
        </div>

        {/* Panel placeholder — sub-title h2 + 주문 1 카드 */}
        <div className="mp-panel">
          <div style={{ marginBottom: 24 }}>
            <SkelBox height={28} width={120} />
          </div>
          <div className="mp-section-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '20px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <SkelBox height={H_BODY_UI} width={80} />
                <SkelBox height={H_BODY_UI} width={60} />
              </div>
              <SkelBox height={H_BODY_M} width="70%" />
              <SkelBox height={H_BODY_M} width={100} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
