/* ══════════════════════════════════════════
   MyPageSkeleton — V2 §3 신구조 (S197 PR-2)
   /mypage Suspense fallback. requireAuth + hydration 동안 노출.
   PR-2 §2.1: (main) layout 답습 → SiteHeader/Footer 자동, 자체 mini-shell 제거.
   PR-2 §2.10: eyebrow 라벨 placeholder 제거 (page-title 만).
   PR-2 §2.7: sub-nav placeholder 6 → 4 항목 동기화.
   - Hero greeting placeholder (eyebrow 제거)
   - NextDeliveryCard placeholder (sand 패널)
   - 2단 grid: side-nav 220 + 패널 1 카드 placeholder
   ══════════════════════════════════════════ */

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
    <div className="mp-body">
      {/* Hero greeting placeholder */}
      <div className="page-title-area mp-hero">
        <SkelBox height={40} width={300} />
        <div className="mp-hero-meta-row">
          <SkelBox height={H_BODY_M} width={200} />
          <SkelBox height={H_BODY_M} width={64} />
        </div>
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
              <SkelBox height={H_BODY_M} width="60%" />
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
