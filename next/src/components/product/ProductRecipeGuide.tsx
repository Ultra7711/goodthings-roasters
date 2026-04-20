/* ══════════════════════════════════════════
   ProductRecipeGuide — RP-4d / 옵션 B (2026-04-12)
   ──────────────────────────────────────────
   - Coffee Bean: product.recipe[] 로 에어로프레스/에스프레소/모카포트/브루잉 카드
                  (카드 헤더 = 196×196 컬러 일러스트, 본문 = 메서드명 + 추출 데이터 표)
   - Drip Bag   : DRIP_BAG_RECIPE 3단계 (각 step 카드 헤더 = 196×196 컬러 일러스트)
   - 라인아트 RECIPE_ICONS / DripIcon* 는 더 이상 사용하지 않음
     (recipeIcons.tsx 자체는 보존 — 추후 결정)
   ══════════════════════════════════════════ */

import { DRIP_BAG_RECIPE, type Product } from '@/lib/products';

type Props = {
  product: Product;
};

const ILLUST_SIZE = 196;

/** Coffee Bean 메서드 → 일러스트 파일 슬러그 */
const COFFEE_METHOD_SLUG: Record<string, string> = {
  '에어로프레스': 'aeropress',
  '에스프레소': 'espresso',
  '모카포트': 'mokapot',
  '브루잉': 'brewing',
};

export default function ProductRecipeGuide({ product }: Props) {
  const isDripBag = product.category === 'Drip Bag';

  if (isDripBag) {
    const dr = DRIP_BAG_RECIPE;
    const steps: { num: '01' | '02' | '03'; title: string; text: string; src: string }[] = [
      { num: '01', title: '드립백 열기', text: dr.step1, src: '/images/icons/recipe_dripbag_01.svg' },
      { num: '02', title: '향 즐기기', text: dr.step2, src: '/images/icons/recipe_dripbag_02.svg' },
      { num: '03', title: '커피 내리기', text: dr.step3, src: '/images/icons/recipe_dripbag_03.svg' },
    ];
    return (
      <div id="pd-recipe-section" className="pd-info-section">
        <h3 className="pd-section-title">Recipe Guide</h3>
        <p className="pd-section-intro">이 드립백을 더 맛있게 즐기는 방법입니다.</p>
        <div id="pd-recipe-cards" className="is-drip">
          {steps.map((s) => (
            <div key={s.num} className="pd-recipe-card">
              <div className="pd-recipe-illust">
                {/* SVG 일러스트 — 정적 width/height + lazy 로딩, next/image 의 추가 최적화 불필요 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.src}
                  alt={`드립백 STEP ${s.num} 일러스트`}
                  width={ILLUST_SIZE}
                  height={ILLUST_SIZE}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="pd-recipe-method">{s.title}</div>
              <p className="pd-drip-step-body">{s.text}</p>
            </div>
          ))}
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
      <p className="pd-section-intro">이 원두를 더 맛있게 즐기는 방법입니다.</p>
      <div id="pd-recipe-cards">
        {product.recipe.map((r) => {
          const slug = COFFEE_METHOD_SLUG[r.method];
          return (
            <div key={r.method} className="pd-recipe-card pd-recipe-card--split">
              <div className="pd-recipe-method">{r.method}</div>
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
          );
        })}
      </div>
    </div>
  );
}
