/* ══════════════════════════════════════════
   MyPageSkeleton — V2 §3 신구조 (S197 PR-2 · S253 정밀화)
   /mypage Suspense fallback. requireAuth + hydration 동안 노출.

   설계 원칙 (S253):
   - 실제 컴포넌트 layout 1:1 답습 → swap 시 layout shift 최소화
   - HeroGreeting: h1 2 줄 + meta row (실제 안녕하세요. / {name} 님)
   - Hero card (mp-next-card): info(name/meta/cta) + image 1:1
   - OrderHistory: mp-order-card × 3 stack (hairline border + meta/content row)
   - mp-side-nav: 4 항목

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
const H_BODY_S = 20;
const H_CHIP = 23;

type BoxProps = {
  height: number | string;
  width?: number | string;
};

function SkelBox({ height, width = '100%' }: BoxProps) {
  return <div className="skel" style={{ height, width }} />;
}

/* OrderHistory mp-order-card 1개 답습.
   .mp-order-card padding: 20 0 + hairline border-bottom.
   내부: meta(date + number + status) + content(summary/detail + chevron). */
function OrderCardSkeleton({ isLast = false }: { isLast?: boolean }) {
  return (
    <div
      style={{
        padding: '20px 0',
        boxShadow: isLast ? 'none' : 'inset 0 -1px 0 0 var(--color-border-hairline)',
      }}
    >
      {/* meta row: date+number 좌 · status 우 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
          <SkelBox height={H_BODY_S} width={90} />
          <SkelBox height={H_BODY_M} width={140} />
        </div>
        <SkelBox height={H_CHIP} width={60} />
      </div>
      {/* content row: summary/detail 좌 · chevron 우 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <SkelBox height={H_BODY_M} width="70%" />
          <SkelBox height={H_BODY_UI} width="50%" />
        </div>
        <SkelBox height={24} width={24} />
      </div>
    </div>
  );
}

export default function MyPageSkeleton() {
  return (
    <div className="mp-body is-loaded">
      {/* HeroGreeting placeholder — h1 한 줄 ("안녕하세요. {name} 님" inline) + meta row */}
      <header className="page-title-area mp-hero">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <SkelBox height={H_PAGE_TITLE} width={140} />
          <SkelBox height={H_PAGE_TITLE} width={180} />
        </div>
        <div className="mp-hero-meta-row">
          <SkelBox height={H_BODY_L} width={200} />
          <SkelBox height={H_BODY_L} width={64} />
        </div>
      </header>

      {/* Hero card placeholder — mp-next-card · info(gap 12) + image 1:1 */}
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
        {/* Side nav placeholder — 실제 MyPageSideNav 답습.
           ITEMS = [주문내역, 정기배송, 프로필, 계정관리] · orders/subscription 만 count.
           CSS 가 viewport 자동 분기 (데스크탑 column / 모바일 horizontal tab bar 정합). */}
        <nav className="mp-side-nav" aria-hidden="true">
          <ul className="mp-side-nav-list">
            {[
              { labelW: 64, hasCount: true },   // 주문내역 (4글자)
              { labelW: 64, hasCount: true },   // 정기배송 (4글자)
              { labelW: 48, hasCount: false },  // 프로필 (3글자)
              { labelW: 64, hasCount: false },  // 계정관리 (4글자)
            ].map((it, i) => (
              <li key={i}>
                <div className="mp-side-nav-item" style={{ pointerEvents: 'none' }}>
                  <SkelBox height={H_BODY_L} width={it.labelW} />
                  {it.hasCount && <SkelBox height={H_BODY_S} width={16} />}
                </div>
              </li>
            ))}
          </ul>
        </nav>

        {/* Panel placeholder — sub-title h2 + OrderHistory mp-order-card × 3 stack */}
        <div className="mp-panel">
          <div style={{ marginBottom: 24 }}>
            <SkelBox height={28} width={120} />
          </div>
          <div className="mp-section-body">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <OrderCardSkeleton />
              <OrderCardSkeleton />
              <OrderCardSkeleton isLast />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
