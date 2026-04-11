/* ══════════════════════════════════════════
   ProductFlavorNote — RP-4d
   ──────────────────────────────────────────
   오각 레이더 차트 + 좌측 태그 리스트.

   프로토타입 animateRadar() 를 React useEffect 로 이식.
   - IntersectionObserver 로 뷰 진입 시 애니메이션 재생
   - 진입: 5개 꼭짓점을 200ms 간격 stagger, 각 600ms 동안 easeBack 으로 확장
   - 호버: 링 도트 → 채움 도트 (14px) 전환, 점수 텍스트 페이드 인
   - 뷰 이탈 시 clearRect → 재진입 시 재생 가능
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef } from 'react';
import type { FlavorNote } from '@/lib/products';

const LABELS = ['단맛', '무게감', '여운', '향', '산미'];
const KEYS: (keyof FlavorNote)[] = ['sweet', 'body', 'aftertaste', 'aroma', 'acidity'];
const MAX_VAL = 5;
const N = 5;

function hexToRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

type Props = {
  note: FlavorNote;
  noteTags: string;
  noteColor: string;
};

export default function ProductFlavorNote({ note, noteTags, noteColor }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const color = noteColor || '#d2aa78';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2 - 4;
    const R = W * 0.34;
    const angleOff = -Math.PI / 2;
    const vals = KEYS.map((k) => note[k] || 0);

    const stagger = 200;
    const vertexDur = 600;
    const DOT_R_SMALL = 5;
    const DOT_R_BIG = 14;
    const hoverDur = 250;

    let rafId = 0;
    let hoverRaf = 0;
    let animDone = false;
    let finalProgs: number[] = [];
    let hoverT = 0;
    let isHovered = false;

    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const easeBack = (t: number) => {
      const c1 = 1.4;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    };

    const vtx = (i: number, prog: number) => {
      const a = angleOff + (2 * Math.PI * i) / N;
      const v = (vals[i] / MAX_VAL) * R * prog;
      return { x: cx + v * Math.cos(a), y: cy + v * Math.sin(a) };
    };

    const drawBase = () => {
      const axisExt = R * 1.15;
      /* 축 라인 */
      for (let i = 0; i < N; i++) {
        const a = angleOff + (2 * Math.PI * i) / N;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + axisExt * Math.cos(a), cy + axisExt * Math.sin(a));
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(0,0,0,.08)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
      /* 점선 그리드 오각형 */
      for (let lv = 1; lv <= 5; lv++) {
        const r = R * (lv / MAX_VAL);
        ctx.beginPath();
        for (let i = 0; i < N; i++) {
          const a = angleOff + (2 * Math.PI * i) / N;
          const x = cx + r * Math.cos(a);
          const y = cy + r * Math.sin(a);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        if (lv === 5) {
          ctx.setLineDash([]);
          ctx.strokeStyle = 'rgba(0,0,0,.18)';
          ctx.lineWidth = 0.8;
        } else {
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = 'rgba(0,0,0,.12)';
          ctx.lineWidth = 0.5;
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
      /* 라벨 */
      for (let i = 0; i < N; i++) {
        const a = angleOff + (2 * Math.PI * i) / N;
        const lr = R + 32;
        const lx = cx + lr * Math.cos(a);
        const ly = cy + lr * Math.sin(a);
        ctx.font = '500 13px "Pretendard Variable","Pretendard",sans-serif';
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(LABELS[i], lx, ly);
      }
    };

    const drawData = (progs: number[], ht: number) => {
      /* 데이터 폴리곤 */
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const p = vtx(i, progs[i]);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      grad.addColorStop(0, hexToRgba(color, 0.35));
      grad.addColorStop(0.5, hexToRgba(color, 0.6));
      grad.addColorStop(1, hexToRgba(color, 0.8));
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = hexToRgba(color, 1);
      ctx.lineWidth = 2.5;
      ctx.stroke();
      /* 도트 */
      const dotR = DOT_R_SMALL + (DOT_R_BIG - DOT_R_SMALL) * ht;
      for (let i = 0; i < N; i++) {
        if (progs[i] <= 0) continue;
        const p = vtx(i, progs[i]);
        const scale = Math.min(progs[i] * 2, 1);
        const r = dotR * scale;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, 2 * Math.PI);
        if (ht > 0) {
          ctx.fillStyle = hexToRgba(color, 0.3 + ht * 0.7);
          ctx.fill();
          ctx.strokeStyle = hexToRgba(color, 1);
          ctx.lineWidth = 2.5;
          ctx.stroke();
        } else {
          ctx.fillStyle = '#FAFAF8';
          ctx.fill();
          ctx.strokeStyle = hexToRgba(color, 1);
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
        /* 호버 시 점수 텍스트 */
        if (ht > 0.3 && scale >= 1) {
          const textAlpha = Math.min((ht - 0.3) / 0.4, 1);
          ctx.font = '700 11px "Inter",sans-serif';
          ctx.fillStyle = `rgba(255,255,255,${textAlpha})`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(Math.round((vals[i] / MAX_VAL) * 10)), p.x, p.y + 0.5);
        }
      }
    };

    const drawStatic = (ht: number) => {
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      drawBase();
      drawData(finalProgs, ht);
      ctx.restore();
    };

    const runHoverAnim = () => {
      if (hoverRaf) cancelAnimationFrame(hoverRaf);
      const fromT = hoverT;
      const toT = isHovered ? 1 : 0;
      const hStart = performance.now();
      const step = (now: number) => {
        const raw = Math.min((now - hStart) / hoverDur, 1);
        const eased = easeOut(raw);
        hoverT = fromT + (toT - fromT) * eased;
        drawStatic(hoverT);
        if (raw < 1) hoverRaf = requestAnimationFrame(step);
        else hoverRaf = 0;
      };
      hoverRaf = requestAnimationFrame(step);
    };

    const onEnter = () => {
      if (!animDone) return;
      isHovered = true;
      runHoverAnim();
    };
    const onLeave = () => {
      if (!animDone) return;
      isHovered = false;
      runHoverAnim();
    };

    const animFrame = (now: number) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      drawBase();
      const progs: number[] = [];
      for (let i = 0; i < N; i++) {
        const vStart = i * stagger;
        const raw = Math.max(0, Math.min((elapsed - vStart) / vertexDur, 1));
        progs.push(vals[i] === MAX_VAL ? easeOut(raw) : easeBack(raw));
      }
      drawData(progs, 0);
      ctx.restore();
      const lastEnd = (N - 1) * stagger + vertexDur;
      if (elapsed < lastEnd) {
        rafId = requestAnimationFrame(animFrame);
      } else {
        rafId = 0;
        animDone = true;
        finalProgs = progs;
        drawStatic(0);
        /* 애니메이션 완료 시 이미 마우스가 위에 있으면 즉시 호버 */
        if (canvas.matches(':hover')) {
          isHovered = true;
          runHoverAnim();
        }
      }
    };

    let start = 0;

    const startAnim = () => {
      if (rafId) cancelAnimationFrame(rafId);
      animDone = false;
      finalProgs = [];
      hoverT = 0;
      start = performance.now();
      rafId = requestAnimationFrame(animFrame);
    };

    /* IntersectionObserver — 재진입 시 재생 */
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            startAnim();
          } else {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = 0;
            animDone = false;
            ctx.clearRect(0, 0, W, H);
          }
        });
      },
      { threshold: 0.2 },
    );
    io.observe(canvas);

    canvas.addEventListener('mouseenter', onEnter);
    canvas.addEventListener('mouseleave', onLeave);

    return () => {
      io.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
      if (hoverRaf) cancelAnimationFrame(hoverRaf);
      canvas.removeEventListener('mouseenter', onEnter);
      canvas.removeEventListener('mouseleave', onLeave);
    };
  }, [note, color]);

  const tags = noteTags.split(/\s*\|\s*/).filter(Boolean);

  return (
    <div id="pd-note-section" className="pd-info-section">
      <h3 className="pd-section-title">Flavor Note</h3>
      <div id="pd-note-layout">
        <div id="pd-radar-wrap">
          <canvas id="pd-radar-canvas" width={500} height={500} ref={canvasRef} />
        </div>
        <div id="pd-note-tags">
          {tags.map((t, i) => (
            <span
              key={i}
              className="pd-note-tag"
              style={{ borderColor: color }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
