/* ══════════════════════════════════════════
   ProductRoastStage — V2 §5.3 PR-2b (S157)
   ──────────────────────────────────────────
   6단 그라데이션 bar (라이트 → 이탈리안). 활성 단계 segment 자체에
   2px ink outline + offset 2px. 차트 위 "로스팅 단계 — {활성라벨}" 단일 강조,
   차트 아래 6단 라벨 row space-between.

   진입 애니메이션: IntersectionObserver 로 6 segment 280ms 간격 stagger fill.
   첫 진입 850ms 딜레이 (PDP 페이드인 후), 재진입 즉시.
   마커 도트/호버 인터랙션 시스템은 폐기 (자문 §5.3 dot → outline 명시).
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef } from 'react';
import type { Product } from '@/lib/products';

const STAGES = ['light', 'medium-light', 'medium', 'medium-dark', 'dark', 'italian'] as const;
const STAGE_LABELS = ['라이트', '미디엄 라이트', '미디엄', '미디엄 다크', '다크', '이탈리안'];
/* 활성 단계 한글 설명 (S157 후속 옵션 C) — 6단 라벨 row 아래 1줄 표시 */
const STAGE_DESCRIPTIONS = [
  '산미가 두드러지는 가장 옅은 로스팅',
  '산미와 단맛이 균형을 이루는 단계',
  '단맛이 도드라지는 표준 로스팅',
  '고소함과 단맛이 균형을 이루는 강배전 직전',
  '바디감과 쓴맛이 진해지는 강배전',
  '묵직한 바디감의 가장 깊은 로스팅',
];
/* 자문 §5.3 와이어프레임 6색 (project_design_audit_v2_raw.html:1302–1307) */
const SEG_COLORS = ['#E8D9BE', '#C9A77A', '#9F6F44', '#7A4A28', '#5A3318', '#3A1E0E'];

type Props = {
  roastStage: Product['roastStage'];
};

export default function ProductRoastStage({ roastStage }: Props) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const segsWrapRef = useRef<HTMLDivElement>(null);
  const firstPlayRef = useRef(false);

  const idx = STAGES.indexOf(roastStage);

  /* 페이지 전환(상품 변경) 시 첫 재생 플래그 리셋 */
  useEffect(() => {
    firstPlayRef.current = false;
  }, [roastStage]);

  /* IntersectionObserver — 뷰 진입/이탈 시 stagger fill 재생/리셋 */
  useEffect(() => {
    const sec = sectionRef.current;
    const segWrap = segsWrapRef.current;
    if (!sec || !segWrap) return;

    const resetState = () => {
      segWrap.querySelectorAll<HTMLElement>('.pd-roast-seg').forEach((s) => {
        s.classList.remove('filled');
        s.classList.remove('active');
      });
    };
    resetState();

    const timers: ReturnType<typeof setTimeout>[] = [];

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const entryDelay = firstPlayRef.current ? 0 : 850;
            firstPlayRef.current = true;

            segWrap.querySelectorAll<HTMLElement>('.pd-roast-seg').forEach((s, i) => {
              const t = setTimeout(() => {
                s.classList.add('filled');
                /* 활성 segment 는 fill stagger 마지막에 outline 노출 */
                if (i === idx) s.classList.add('active');
              }, entryDelay + i * 280);
              timers.push(t);
            });
          } else {
            timers.forEach(clearTimeout);
            timers.length = 0;
            resetState();
          }
        });
      },
      { threshold: 0.3 },
    );
    io.observe(sec);

    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
    };
  }, [idx]);

  return (
    <div id="pd-roast-section" className="pd-info-section" ref={sectionRef}>
      <h3 className="pd-section-title">Roasting Stage</h3>
      <p className="pd-section-intro">원두의 로스팅 단계를 6단계로 표시합니다.</p>
      <div id="pd-roast-bar">
        <div id="pd-roast-segments" ref={segsWrapRef}>
          {SEG_COLORS.map((c, i) => (
            <div key={i} className="pd-roast-seg" style={{ background: c }} data-idx={i} />
          ))}
        </div>
      </div>
      <div id="pd-roast-labels">
        {STAGE_LABELS.map((l, i) => (
          <span key={i} className={i === idx ? 'active' : undefined}>
            {l}
          </span>
        ))}
      </div>
      <div className="pd-roast-current">
        로스팅 단계 — <strong>{STAGE_LABELS[idx] ?? STAGE_LABELS[0]}</strong>
      </div>
      <p className="pd-roast-description">{STAGE_DESCRIPTIONS[idx] ?? STAGE_DESCRIPTIONS[0]}</p>
    </div>
  );
}
