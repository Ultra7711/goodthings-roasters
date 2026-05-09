/* ══════════════════════════════════════════
   SearchSkeleton — /search Suspense fallback (S199 V2 §6.9 grid 정합)

   sp-card 디자인 spec 답습 — 카테고리 그룹 2개 × 카드 3개 placeholder.
   - .sr-rows / .sr-row / .sr-row-header / .sr-grid (SearchPage layout 정합)
   - .sp-card / .sp-card-thumb / .sp-card-info (ShopPage 정합)
   - sp-visible 항상 부여 (Shop IO 의존 X)
   ══════════════════════════════════════════ */

import './SearchPage.css';
import '@/components/shop/ShopPage.css';

const SKELETON_GROUPS = 2;
const CARDS_PER_GROUP = 3;

function SkeletonCard() {
  return (
    <div className="sp-card sp-visible" style={{ pointerEvents: 'none' }}>
      <div className="sp-card-thumb">
        <div className="skel" style={{ position: 'absolute', inset: 0, borderRadius: 0 }} />
      </div>
      <div className="sp-card-info">
        <div className="skel" style={{ height: 22, width: '60%', margin: '0 auto 6px' }} />
        <div className="skel" style={{ height: 16, width: '40%', margin: '0 auto' }} />
      </div>
    </div>
  );
}

export default function SearchSkeleton() {
  return (
    <div className="search-page-wrap">
      <div className="search-page-inner">
        <div className="sr-rows">
          {Array.from({ length: SKELETON_GROUPS }).map((_, i) => (
            <section className="sr-row" key={i}>
              <header className="sr-row-header">
                <div className="skel" style={{ height: 14, width: 100 }} />
              </header>
              <div className="sr-grid">
                {Array.from({ length: CARDS_PER_GROUP }).map((_, j) => (
                  <SkeletonCard key={j} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
