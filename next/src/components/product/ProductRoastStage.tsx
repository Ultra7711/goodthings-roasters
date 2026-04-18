/* ══════════════════════════════════════════
   ProductRoastStage — RP-4d
   ──────────────────────────────────────────
   5단계 세그먼트 바 + 단계별 색상 pill + 애니메이션 마커.

   동작:
   - 페이지 진입 / 스크롤 재진입 시 IntersectionObserver 로 애니메이션 재생
   - 최초 진입은 850ms 딜레이 (PDP 페이드인 완료 후)
   - 스크롤 재진입은 즉시
   - 세그먼트는 280ms 간격으로 하나씩 채워짐
   - 마커는 1.5s 큐빅 베지어로 대상 위치까지 이동, 지나가는 단계 색상을 실시간 반영
   - 섹션 호버 시 마커가 28x28 로 확장되면서 단계 번호 표시
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef } from 'react';
import type { Product } from '@/lib/products';

const STAGES = ['light', 'medium-light', 'medium', 'medium-dark', 'dark'] as const;
const STAGE_LABELS = ['라이트', '미디엄 라이트', '미디엄', '미디엄 다크', '다크'];
const SEG_COLORS = ['#c9a96e', '#a8834a', '#8b5e3c', '#5a3520', '#2a1a0a'];

type Props = {
  roastStage: Product['roastStage'];
};

export default function ProductRoastStage({ roastStage }: Props) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const segsWrapRef = useRef<HTMLDivElement>(null);
  const firstPlayRef = useRef(false);

  const idx = STAGES.indexOf(roastStage);
  const markerPct = ((idx + 0.5) / STAGES.length) * 100;
  const stageColor = SEG_COLORS[idx] ?? SEG_COLORS[0];

  /* 페이지 전환(상품 변경) 시 첫 재생 플래그 리셋 */
  useEffect(() => {
    firstPlayRef.current = false;
  }, [roastStage]);

  /* IntersectionObserver — 뷰 진입/이탈 시 애니메이션 재생/리셋 */
  useEffect(() => {
    const sec = sectionRef.current;
    const marker = markerRef.current;
    const segWrap = segsWrapRef.current;
    if (!sec || !marker || !segWrap) return;

    /* 초기 상태 강제 — 링 도트, 왼쪽 끝 */
    const resetState = () => {
      marker.classList.remove('hover');
      marker.style.color = SEG_COLORS[0];
      marker.style.background = '#FAFAF8';
      segWrap.querySelectorAll<HTMLElement>('.pd-roast-seg').forEach((s) => s.classList.remove('filled'));
      marker.style.transition = 'none';
      marker.style.left = '0%';
      // force reflow 로 transition:none 확정
      void marker.offsetWidth;
    };
    resetState();

    const timers: ReturnType<typeof setTimeout>[] = [];
    /* colorRaf 는 재진입/언마운트 시 취소되어야 하므로 closure 상위로 끌어올림.
       이전 구현은 setTimeout 콜백 내부 let 으로 선언되어 cleanup 에서 도달 불가 → leak. */
    let colorRaf = 0;
    const cancelColorRaf = () => {
      if (colorRaf) {
        cancelAnimationFrame(colorRaf);
        colorRaf = 0;
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const entryDelay = firstPlayRef.current ? 0 : 850;
            firstPlayRef.current = true;

            /* 세그먼트 순차 채우기 */
            segWrap.querySelectorAll<HTMLElement>('.pd-roast-seg').forEach((s, i) => {
              const t = setTimeout(() => {
                if (i <= idx) s.classList.add('filled');
              }, entryDelay + i * 280);
              timers.push(t);
            });

            /* 마커 이동 */
            marker.style.color = SEG_COLORS[0];
            const t = setTimeout(() => {
              marker.style.transition =
                'left 1.5s cubic-bezier(.4,1.3,.5,1),width .25s ease-out,height .25s ease-out,border-color .15s ease';
              marker.style.left = `${markerPct}%`;

              /* 지나가는 단계 색상 실시간 반영 */
              const trackColor = () => {
                const barEl = sec.querySelector<HTMLElement>('#pd-roast-bar');
                if (!barEl) { colorRaf = 0; return; }
                const barW = barEl.offsetWidth;
                const curLeft = parseFloat(getComputedStyle(marker).left);
                const segIdx = Math.min(
                  Math.floor((curLeft / barW) * STAGES.length),
                  STAGES.length - 1,
                );
                marker.style.color = SEG_COLORS[Math.max(0, segIdx)];
                if (segIdx < idx) colorRaf = requestAnimationFrame(trackColor);
                else colorRaf = 0;
              };
              cancelColorRaf();
              colorRaf = requestAnimationFrame(trackColor);
            }, entryDelay + 60);
            timers.push(t);
          } else {
            /* 뷰 이탈 시 리셋 — 재진입 시 애니메이션 재생 가능 */
            timers.forEach(clearTimeout);
            timers.length = 0;
            cancelColorRaf();
            resetState();
          }
        });
      },
      { threshold: 0.3 },
    );
    io.observe(sec);

    /* 호버 이벤트 */
    const onEnter = () => {
      marker.classList.add('hover');
      marker.style.background = stageColor;
    };
    const onLeave = () => {
      marker.classList.remove('hover');
      marker.style.background = '#FAFAF8';
    };
    sec.addEventListener('mouseenter', onEnter);
    sec.addEventListener('mouseleave', onLeave);

    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
      cancelColorRaf();
      sec.removeEventListener('mouseenter', onEnter);
      sec.removeEventListener('mouseleave', onLeave);
    };
  }, [idx, markerPct, stageColor]);

  return (
    <div id="pd-roast-section" className="pd-info-section" ref={sectionRef}>
      <h3 className="pd-section-title">Roasting Stage</h3>
      <p className="pd-section-intro">원두의 로스팅 단계를 5단계로 표시합니다.</p>
      <div id="pd-roast-bar">
        <div id="pd-roast-segments" ref={segsWrapRef}>
          {SEG_COLORS.map((c, i) => (
            <div key={i} className="pd-roast-seg" style={{ background: c }} data-idx={i} />
          ))}
        </div>
        <div id="pd-roast-marker" ref={markerRef}>
          <span className="pd-roast-marker-num">{idx + 1}</span>
        </div>
      </div>
      <div id="pd-roast-labels">
        {STAGE_LABELS.map((l, i) =>
          i === idx ? (
            <span key={i} className="active">
              <span className="pd-roast-pill" style={{ background: SEG_COLORS[idx] }}>
                {l}
              </span>
            </span>
          ) : (
            <span key={i}>{l}</span>
          ),
        )}
      </div>
    </div>
  );
}
