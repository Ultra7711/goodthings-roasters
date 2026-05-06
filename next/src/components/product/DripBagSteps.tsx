/* ══════════════════════════════════════════
   DripBagSteps — V2 §6.12 (S136 신규)
   ──────────────────────────────────────────
   - 드립백 PDP 전용 3-step 시각 안내 (RecipeGuide 와 분리)
   - 가로 3 카드 + connector dot line + 일러스트 + 단계 번호 + 한 줄 설명
   - 하단 TIP — 11px gold caption (자문 §6.12)
   - CSS 셀렉터는 globals.css 의 `#pd-recipe-cards.is-drip` · `.pd-drip-*` 그대로 재사용
     (컴포넌트만 분리, 스타일은 공통 인프라 활용)
   ══════════════════════════════════════════ */

import { DRIP_BAG_RECIPE } from '@/lib/products';

const ILLUST_SIZE = 196;

type Step = {
  num: '01' | '02' | '03';
  title: string;
  text: string;
  src: string;
};

const STEPS: Step[] = [
  { num: '01', title: '드립백 열기', text: DRIP_BAG_RECIPE.step1, src: '/images/icons/recipe_dripbag_01.svg' },
  { num: '02', title: '향 즐기기', text: DRIP_BAG_RECIPE.step2, src: '/images/icons/recipe_dripbag_02.svg' },
  { num: '03', title: '커피 내리기', text: DRIP_BAG_RECIPE.step3, src: '/images/icons/recipe_dripbag_03.svg' },
];

export default function DripBagSteps() {
  return (
    <div id="pd-recipe-section">
      <div id="pd-recipe-cards" className="is-drip">
        {STEPS.map((s) => (
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
        {DRIP_BAG_RECIPE.tip && (
          <div className="pd-drip-tip">
            <span className="pd-drip-tip-label">TIP</span>
            <span className="pd-drip-tip-text">{DRIP_BAG_RECIPE.tip}</span>
          </div>
        )}
      </div>
    </div>
  );
}
