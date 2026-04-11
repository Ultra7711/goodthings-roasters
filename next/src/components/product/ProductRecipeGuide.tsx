/* ══════════════════════════════════════════
   ProductRecipeGuide — RP-4d
   ──────────────────────────────────────────
   - Coffee Bean: product.recipe[] 로 에어로프레스/에스프레소/모카포트/브루잉 카드
   - Drip Bag   : DRIP_BAG_RECIPE (공통 3단계 + tip)
   ══════════════════════════════════════════ */

import { DRIP_BAG_RECIPE, type Product } from '@/lib/products';
import { RECIPE_ICONS, DripIcon1, DripIcon2, DripIcon3 } from './recipeIcons';

type Props = {
  product: Product;
};

const COFFEE_INTRO =
  '굳띵즈 커피를 더욱 맛있게 즐길 수 있는 레시피입니다.\n굳띵즈의 커피를 맛있게 즐겨보세요.';

export default function ProductRecipeGuide({ product }: Props) {
  const isDripBag = product.category === 'Drip Bag';

  if (isDripBag) {
    const dr = DRIP_BAG_RECIPE;
    return (
      <div id="pd-recipe-section" className="pd-info-section">
        <h3 className="pd-section-title">Recipe Guide</h3>
        <p id="pd-recipe-intro">드립백을 가장 맛있게 즐길 수 있는 방법입니다.</p>
        <div id="pd-recipe-cards">
          <div className="pd-drip-icons">
            <div className="pd-drip-icon-item"><DripIcon1 /></div>
            <span className="pd-drip-sep">|</span>
            <div className="pd-drip-icon-item"><DripIcon2 /></div>
            <span className="pd-drip-sep">|</span>
            <div className="pd-drip-icon-item"><DripIcon3 /></div>
          </div>
          <div className="pd-drip-step">
            <span className="pd-drip-step-num">STEP 01</span>
            <span className="pd-drip-step-text">{dr.step1}</span>
          </div>
          <div className="pd-drip-step">
            <span className="pd-drip-step-num">STEP 02</span>
            <span className="pd-drip-step-text">{dr.step2}</span>
          </div>
          <div className="pd-drip-step">
            <span className="pd-drip-step-num">STEP 03</span>
            <span className="pd-drip-step-text">{dr.step3}</span>
          </div>
          {dr.tip && (
            <div className="pd-drip-tip">
              <span className="pd-drip-tip-label">TIP</span>
              <span className="pd-drip-tip-text">{dr.tip}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!product.recipe || product.recipe.length === 0) return null;

  return (
    <div id="pd-recipe-section" className="pd-info-section">
      <h3 className="pd-section-title">Recipe Guide</h3>
      <p id="pd-recipe-intro">{COFFEE_INTRO}</p>
      <div id="pd-recipe-cards">
        {product.recipe.map((r) => {
          const Icon = RECIPE_ICONS[r.method];
          return (
            <div key={r.method} className="pd-recipe-card">
              <div className="pd-recipe-icon">{Icon && <Icon />}</div>
              <div className="pd-recipe-body">
                <div className="pd-recipe-method">{r.method}</div>
                <div className="pd-recipe-table">
                  <span className="pd-recipe-dt"><span>원두량</span></span>
                  <span className="pd-recipe-dd">{r.dose}</span>
                  <span className="pd-recipe-dt"><span>온도</span></span>
                  <span className="pd-recipe-dd">{r.temp}</span>
                  <span className="pd-recipe-dt"><span>추출시간</span></span>
                  <span className="pd-recipe-dd">{r.time}</span>
                  <span className="pd-recipe-dt"><span>물량</span></span>
                  <span className="pd-recipe-dd">{r.water}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
