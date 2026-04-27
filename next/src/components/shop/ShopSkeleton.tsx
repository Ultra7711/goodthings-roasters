/* ══════════════════════════════════════════
   ShopSkeleton — /shop Suspense fallback (BUG-159 · S94)

   실제 ShopPage 레이아웃 치수 기준:
   - #sp-body: max-width 1440px · padding 100px 60px 120px
   - 페이지 제목: --type-h1-size (≈36px) · line-height 1.2 → 36px
   - 부제: --type-body-l-size (≈17px) · margin-top 16px → 22px
   - 필터 탭: padding 20px 30px 16px · min-width 72px → 각 탭 높이 55px
   - 카드 thumb: aspect-ratio 1/1 · 100% width
   - 카드 info: padding 16px 4px 28px · name 26px (17px × lh1.55) + 6px gap + price 22px
   ══════════════════════════════════════════ */

const FILTER_TAB_WIDTHS = [32, 32, 48, 64]; /* 전체·원두·드립백·정기배송 텍스트 너비(px) */
const CARD_COUNT = 6; /* 3열 × 2행 */

export default function ShopSkeleton() {
  return (
    <div className="sp-page-bg">
      <div id="sp-body">
        <div id="sp-head">
          {/* 타이틀 영역 */}
          <div className="page-title-area">
            <div className="skel" style={{ height: 36, width: 220 }} />
            <div className="skel" style={{ height: 22, width: 340, marginTop: 16 }} />
          </div>

          {/* 필터 탭 */}
          <div className="sp-skel-filter" role="presentation">
            {FILTER_TAB_WIDTHS.map((w, i) => (
              <div key={i} className="sp-skel-tab">
                <div className="skel" style={{ height: 16, width: w }} />
              </div>
            ))}
          </div>
        </div>

        {/* 상품 그리드 */}
        <div id="sp-grid" role="presentation">
          {Array.from({ length: CARD_COUNT }).map((_, i) => (
            <div key={i} className="sp-skel-card">
              {/* 이미지 — aspect-ratio 1:1, position:relative는 .sp-card-thumb CSS에서 처리 */}
              <div className="sp-card-thumb">
                <div className="skel sp-skel-thumb" />
              </div>
              {/* 상품 정보 — padding 16px 4px 28px, text-align: center */}
              <div className="sp-card-info">
                <div className="skel sp-skel-name" />
                <div className="skel sp-skel-price" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
