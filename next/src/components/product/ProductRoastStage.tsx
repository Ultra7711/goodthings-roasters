/* ══════════════════════════════════════════
   ProductRoastStage — Advisory C §2.2 (S163 PR-2)
   ──────────────────────────────────────────
   그라디언트 핀 게이지.
   8px track (베이지→다크) + 14px cream/ink 핀.
   5-tick 라벨 · KO/EN 라벨 row · 단계 설명.
   ══════════════════════════════════════════ */

import type { Product } from '@/lib/products';

const STAGES = ['light', 'medium-light', 'medium', 'medium-dark', 'dark', 'italian'] as const;
const STAGE_KO = ['라이트', '미디엄 라이트', '미디엄', '미디엄 다크', '다크', '이탈리안'];
const STAGE_EN = ['Light', 'Medium Light', 'Medium', 'Medium Dark', 'Dark', 'Italian'];
/* 5-tick 게이지: italian 은 dark 와 동일 위치(100%) */
const STAGE_PIN_PCT = [0, 25, 50, 75, 100, 100] as const;
const STAGE_DESCRIPTIONS = [
  '산미가 두드러지는 가장 옅은 로스팅',
  '산미와 단맛이 균형을 이루는 단계',
  '단맛이 도드라지는 표준 로스팅',
  '고소함과 단맛이 균형을 이루는 강배전 직전',
  '바디감과 쓴맛이 진해지는 강배전',
  '묵직한 바디감의 가장 깊은 로스팅',
];

type Props = { roastStage: Product['roastStage'] };

export default function ProductRoastStage({ roastStage }: Props) {
  const idx = Math.max(0, STAGES.indexOf(roastStage));
  const pinPct = STAGE_PIN_PCT[idx];

  return (
    <div id="pd-roast-section">
      <p className="pd-roast-section-label">Roasting</p>
      <div className="pd-roast-track-wrap">
        <div className="pd-roast-track">
          <span className="pd-roast-pin" style={{ left: `${pinPct}%` }} />
        </div>
        <div className="pd-roast-ticks">
          <span>Light</span>
          <span>M.L</span>
          <span>Med</span>
          <span>M.D</span>
          <span>Dark</span>
        </div>
      </div>
      <div className="pd-roast-ko-en">
        <span className="pd-roast-ko">{STAGE_KO[idx]}</span>
        <span className="pd-roast-en">{STAGE_EN[idx]}</span>
      </div>
      <p className="pd-roast-desc">{STAGE_DESCRIPTIONS[idx]}</p>
    </div>
  );
}
