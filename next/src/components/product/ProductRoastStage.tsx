/* ══════════════════════════════════════════
   ProductRoastStage — Advisory C §2.2 (S163 PR-2)
   ──────────────────────────────────────────
   그라디언트 핀 게이지.
   8px track (베이지→다크) + 14px cream/ink 핀.
   5-tick 라벨 · 단계 설명. 진입 시 핀 슬라이드 애니 1회 (S164 후속).
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef, useState } from 'react';
import type { Product } from '@/lib/products';

const STAGES = ['light', 'medium-light', 'medium', 'medium-dark', 'dark', 'italian'] as const;
/* 5-tick 게이지: 10~90% 안쪽 영역 5등분 (간격 20%) — pin/label 항상 중앙 정렬
   italian 은 dark 와 동일 위치(90%) */
const STAGE_PIN_PCT = [10, 30, 50, 70, 90, 90] as const;
/* 핀 stroke 색 = 게이지 도달 지점 컬러 (S164 후속) — globals.css gradient 보간 색 토큰 */
const STAGE_PIN_COLOR = [
  'var(--color-roast-light)',
  'var(--color-roast-medium-light)',
  'var(--color-roast-medium)',
  'var(--color-roast-medium-dark)',
  'var(--color-roast-dark)',
  'var(--color-roast-dark)',
] as const;
/* tick 라벨 — 10/30/50/70/90% 위치에 정확히 5등분 */
const TICKS: { pct: number; label: string }[] = [
  { pct: 10, label: '라이트' },
  { pct: 30, label: '미디엄 라이트' },
  { pct: 50, label: '미디엄' },
  { pct: 70, label: '미디엄 다크' },
  { pct: 90, label: '다크' },
];
/* 단계별 설명 — SCA Agtron Gourmet Scale + specialty 추출 매핑 (S164 PR-3 후속)
   Sources: SCA Roast Color White Paper · Coffee Bros · Clive Coffee · 한국 specialty 매체 */
const STAGE_DESCRIPTIONS = [
  '산뜻한 산미와 화사한 향, 산지 고유 특성이 가장 잘 드러나는 단계. 푸어오버와 에어로프레스에 적합합니다.',
  '산미와 단맛이 부드럽게 어우러지며 산지 특성이 살아있는 단계. 핸드드립에 잘 어울립니다.',
  '캐러멜 단맛과 부드러운 바디가 균형을 이루는 단계. 다양한 추출 방식에 잘 어울립니다.',
  '고소한 토스티드 너트와 깊은 단맛이 어우러지는 단계. 에스프레소 추출에 적합합니다.',
  '묵직한 바디와 카카오의 진한 단맛이 살아나는 단계. 라떼와 카푸치노에 잘 어울립니다.',
  '농밀한 풍미와 스모키함이 절정에 이르는 가장 깊은 단계. 진한 에스프레소에 적합합니다.',
];

type Props = {
  roastStage: Product['roastStage'];
  /** 운영자 작성 설명 — 빈 문자열 또는 undefined 시 STAGE_DESCRIPTIONS fallback (S231-4). */
  roastDesc?: string;
};

export default function ProductRoastStage({ roastStage, roastDesc }: Props) {
  const idx = Math.max(0, STAGES.indexOf(roastStage));
  const pinPct = STAGE_PIN_PCT[idx];
  /* italian (idx 5) 은 dark (idx 4) tick 위치와 동일 → tick 활성 매핑도 4 로 fallback */
  const tickIdx = Math.min(idx, 4);
  /* 진입 애니: IO 1회 reveal → 핀이 0% → pinPct 까지 슬라이드 */
  const sectionRef = useRef<HTMLDivElement>(null);
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    // IntersectionObserver reset — el 변경 시 animation 재시작 (의도된 setState in effect)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnimated(false);
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            requestAnimationFrame(() => setAnimated(true));
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [roastStage]);

  return (
    <div id="pd-roast-section" ref={sectionRef}>
      <p className="pd-roast-section-label">Roasting</p>
      <div className="pd-roast-track-wrap">
        <div className="pd-roast-track">
          <span
            className="pd-roast-pin"
            style={{
              left: `${animated ? pinPct : 0}%`,
              borderColor: STAGE_PIN_COLOR[idx],
            }}
          />
        </div>
        <div className="pd-roast-ticks">
          {TICKS.map((t, i) => (
            <span
              key={t.pct}
              className={`pd-roast-tick${i === tickIdx ? ' pd-roast-tick--active' : ''}`}
              style={{ left: `${t.pct}%` }}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>
      <p className="pd-roast-desc">{roastDesc?.trim() || STAGE_DESCRIPTIONS[idx]}</p>
    </div>
  );
}
