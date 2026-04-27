/* ══════════════════════════════════════════
   CafeMenuSkeleton — /menu Suspense fallback (S94)

   ShopSkeleton 패턴 동일 적용.
   CSS 클래스 최대 재활용 → 레이아웃·반응형 자동 적용:
   - 구조: #cm-body, #cm-head, #cm-grid
   - 카드: .cm-card-thumb(aspect-ratio 1:1), .cm-card-info(padding 12px 4px 20px)
   - 박스: .sp-skel-filter/.sp-skel-tab (shop 과 치수 동일)
           .sp-skel-card/.sp-skel-thumb/.sp-skel-name/.sp-skel-price 재사용
   ══════════════════════════════════════════ */

/* 탭 텍스트 너비(px): 모든메뉴·시그니처·브루잉/커피·티·논커피·디저트 */
const CM_FILTER_TAB_WIDTHS = [52, 44, 60, 12, 42, 42];
const CARD_COUNT = 9; /* 3열 × 3행 */

function CafeMenuSkeletonCard() {
  return (
    <div className="sp-skel-card">
      <div className="cm-card-thumb">
        <div className="skel sp-skel-thumb" />
      </div>
      <div className="cm-card-info">
        <div className="skel sp-skel-name" />
        <div className="skel sp-skel-price" />
      </div>
    </div>
  );
}

export default function CafeMenuSkeleton() {
  return (
    <div id="cm-body">
      <div id="cm-head">
        <div className="page-title-area">
          <div className="skel" style={{ height: 36, width: 180 }} />
          <div className="skel" style={{ height: 22, width: 300, marginTop: 16 }} />
        </div>
        <div className="sp-skel-filter" role="presentation">
          {CM_FILTER_TAB_WIDTHS.map((w, i) => (
            <div key={i} className="sp-skel-tab">
              <div className="skel" style={{ height: 16, width: w }} />
            </div>
          ))}
        </div>
      </div>
      <div id="cm-grid" role="presentation">
        {Array.from({ length: CARD_COUNT }).map((_, i) => (
          <CafeMenuSkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
