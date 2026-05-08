/* ══════════════════════════════════════════
   MyPageSkeleton — V2 §3 신구조 (S197 PR-1.3)
   /mypage Suspense fallback. requireAuth + hydration 동안 노출.
   - Hero greeting placeholder
   - NextDeliveryCard placeholder (sand 패널)
   - 2단 grid: side-nav 220 + 패널 1 카드 placeholder
   ══════════════════════════════════════════ */

import SiteHeader from '@/components/layout/SiteHeader';

const H_BODY_M = 22;
const H_BODY_UI = 16;

type BoxProps = {
  height: number;
  width?: number | string;
};

function SkelBox({ height, width = '100%' }: BoxProps) {
  return <div className="skel" style={{ height, width }} />;
}

export default function MyPageSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100svh' }}>
      <SiteHeader />

      <div className="mp-body">
        {/* Hero greeting placeholder */}
        <div className="mp-hero">
          <div className="mp-hero-text">
            <SkelBox height={11} width={80} />
            <SkelBox height={40} width={300} />
            <SkelBox height={H_BODY_M} width={200} />
          </div>
          <SkelBox height={H_BODY_M} width={64} />
        </div>

        {/* NextDeliveryCard placeholder */}
        <section className="mp-next-card" aria-hidden="true">
          <div className="mp-next-info">
            <SkelBox height={11} width={100} />
            <SkelBox height={32} width="60%" />
            <SkelBox height={H_BODY_UI} width="40%" />
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <SkelBox height={44} width={120} />
              <SkelBox height={44} width={120} />
              <SkelBox height={H_BODY_M} width={48} />
            </div>
          </div>
          <div className="mp-next-image">
            <div className="mp-next-image-placeholder" />
          </div>
        </section>

        {/* mp-grid: side-nav + panel */}
        <div className="mp-grid">
          {/* Side nav placeholder (6 항목) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 8 }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ padding: '12px 16px' }}>
                <SkelBox height={H_BODY_M} width="60%" />
              </div>
            ))}
          </div>

          {/* Panel placeholder — 주문 1 카드 */}
          <div className="mp-panel">
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
    </div>
  );
}
