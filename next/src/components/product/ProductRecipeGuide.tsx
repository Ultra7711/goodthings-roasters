/* ══════════════════════════════════════════
   ProductRecipeGuide — Coffee Bean 전용 (S136 분리)
   ──────────────────────────────────────────
   - product.recipe[] 로 에어로프레스/에스프레소/모카포트/드립 카드
   - 카드 헤더 = 196×196 컬러 일러스트, 본문 = 메서드명 + 추출 데이터 표
   - Drip Bag 3단계는 DripBagSteps.tsx 로 분리 (V2 §6.12 · S136)
   ══════════════════════════════════════════ */

import { type Product } from '@/lib/products';

type Props = {
  product: Product;
};

const ILLUST_SIZE = 196;

/** Coffee Bean 메서드 → 일러스트 파일 슬러그 (slug 'brewing' 은 SVG 파일명 호환 유지) */
const COFFEE_METHOD_SLUG: Record<string, string> = {
  '에어로프레스': 'aeropress',
  '에스프레소': 'espresso',
  '모카포트': 'mokapot',
  '드립': 'brewing',
};

export default function ProductRecipeGuide({ product }: Props) {
  if (!product.recipe || product.recipe.length === 0) return null;

  return (
    <div id="pd-recipe-section" className="pd-info-section">
      <h3 className="pd-section-title">Recipe Guide</h3>
      <p className="pd-section-intro">이 원두를 더 맛있게 즐기는 방법입니다.</p>
      <div id="pd-recipe-cards">
        {product.recipe.map((r) => {
          const slug = COFFEE_METHOD_SLUG[r.method];
          return (
            <div key={r.method} className="pd-recipe-card pd-recipe-card--split">
              <div className="pd-recipe-body">
                {slug && (
                  <div className="pd-recipe-illust">
                    {/* SVG 일러스트 — 정적 width/height + lazy 로딩, next/image 의 추가 최적화 불필요 */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/images/icons/recipe_${slug}_large.svg`}
                      alt={`${r.method} 추출 기구 일러스트`}
                      width={ILLUST_SIZE}
                      height={ILLUST_SIZE}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                )}
                <div className="pd-recipe-text">
                  <div className="pd-recipe-method">{r.method}</div>
                  <div className="pd-recipe-table">
                    <span className="pd-recipe-dt"><span>원두량</span></span>
                    <span className="pd-recipe-dd">{r.dose}</span>
                    <span className="pd-recipe-dt"><span>추출시간</span></span>
                    <span className="pd-recipe-dd">{r.time}</span>
                    <span className="pd-recipe-dt"><span>온도</span></span>
                    <span className="pd-recipe-dd">{r.temp}</span>
                    <span className="pd-recipe-dt"><span>물량</span></span>
                    <span className="pd-recipe-dd">{r.water}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
