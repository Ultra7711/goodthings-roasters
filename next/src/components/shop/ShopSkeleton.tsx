/* ══════════════════════════════════════════
   ShopSkeleton — /shop Suspense fallback (BUG-159 · S94)

   V2 §4.1 row 분리 그리드 정합:
   - #sp-body: max-width 1440px · padding 100px 60px 120px
   - 페이지 제목 36px + 부제 22px
   - 필터 탭 3개 (전체·원두·드립백) + SKU 카운트
   - 원두 row: 5:4 2-col / 드립백 row: 1:1 4-col
   ══════════════════════════════════════════ */

const FILTER_TAB_WIDTHS = [32, 32, 48]; /* 전체·원두·드립백 텍스트 너비(px) */
const BEAN_COUNT = 2;
const DRIP_COUNT = 4;

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

          {/* 필터 탭 — 3 탭 + SKU 카운트 */}
          <div className="sp-skel-filter" role="presentation">
            {FILTER_TAB_WIDTHS.map((w, i) => (
              <div key={i} className="sp-skel-tab">
                <div className="skel" style={{ height: 16, width: w }} />
              </div>
            ))}
          </div>
        </div>

        {/* 카테고리 분리 row */}
        <div id="sp-rows" role="presentation">
          <section className="sp-row" data-kind="bean">
            <header className="sp-row-header sp-row-header--enter">
              <div className="skel" style={{ height: 14, width: 90 }} />
            </header>
            <div className="sp-grid sp-grid--bean">
              {Array.from({ length: BEAN_COUNT }).map((_, i) => (
                <div key={i} className="sp-skel-card">
                  <div className="sp-card-thumb" style={{ aspectRatio: '5 / 4' }}>
                    <div className="skel sp-skel-thumb" />
                  </div>
                  <div className="sp-card-info">
                    <div className="skel sp-skel-name" />
                    <div className="skel sp-skel-price" />
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="sp-row" data-kind="drip">
            <header className="sp-row-header sp-row-header--enter">
              <div className="skel" style={{ height: 14, width: 70 }} />
            </header>
            <div className="sp-grid sp-grid--drip">
              {Array.from({ length: DRIP_COUNT }).map((_, i) => (
                <div key={i} className="sp-skel-card">
                  <div className="sp-card-thumb">
                    <div className="skel sp-skel-thumb" />
                  </div>
                  <div className="sp-card-info">
                    <div className="skel sp-skel-name" />
                    <div className="skel sp-skel-price" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
