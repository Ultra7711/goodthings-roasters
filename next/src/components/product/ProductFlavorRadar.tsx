/* ══════════════════════════════════════════
   ProductFlavorRadar — Advisory C §3 (S164 PR-3 후속)
   ──────────────────────────────────────────
   동적 5축 레이더 차트 (sweet/body/aftertaste/aroma/acidity).
   - IntersectionObserver 1회 진입 시 5 vertex stagger 200ms · easeBack
   - 정적 (호버/점수 표시 폐기 — S164 후속)
   - 로스팅 미디엄 색 (#8C5A2E) 통일 / 외부 직경 14 · inner 10 매칭
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef } from 'react';
import type { FlavorNote } from '@/lib/products';
import { easeBack } from '@/lib/ease';

const LABELS = ['단맛', '무게감', '여운', '향', '산미'];
const KEYS: (keyof FlavorNote)[] = ['sweet', 'body', 'aftertaste', 'aroma', 'acidity'];
const MAX_VAL = 5;
const N = 5;
const STROKE_COLOR = '#8C5A2E';      /* --color-flavor-marker = --color-roast-medium */
const DOT_FILL_COLOR = '#FBF8F3';    /* --color-background-primary (cream) */

function hexToRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

type Props = {
  note: FlavorNote;
};

export default function ProductFlavorRadar({ note }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0;
    let H = 0;
    let cx = 0;
    let cy = 0;
    let R = 0;
    const setupCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      W = rect.width;
      H = rect.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = W / 2;
      cy = H / 2;
      R = W * 0.34;
    };
    setupCanvas();
    const angleOff = -Math.PI / 2;
    const vals = KEYS.map((k) => note[k] || 0);

    const stagger = 200;
    const vertexDur = 600;
    const DOT_R = 6;     /* 외부 직경 14 (반지름 6 + lineWidth 2) · 로스팅 핀과 통일 */

    let rafId = 0;
    let animDone = false;
    let finalProgs: number[] = [];

    const vtx = (i: number, prog: number) => {
      const a = angleOff + (2 * Math.PI * i) / N;
      const v = (vals[i] / MAX_VAL) * R * prog;
      return { x: cx + v * Math.cos(a), y: cy + v * Math.sin(a) };
    };

    const drawBase = () => {
      const axisExt = R * 1.15;
      for (let i = 0; i < N; i++) {
        const a = angleOff + (2 * Math.PI * i) / N;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + axisExt * Math.cos(a), cy + axisExt * Math.sin(a));
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(28,27,25,.18)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
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
          ctx.strokeStyle = 'rgba(28,27,25,.30)';
          ctx.lineWidth = 0.8;
        } else {
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = 'rgba(28,27,25,.20)';
          ctx.lineWidth = 0.5;
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
      const labelOffset = W < 480 ? 18 : 32;
      for (let i = 0; i < N; i++) {
        const a = angleOff + (2 * Math.PI * i) / N;
        const lr = R + labelOffset;
        const lx = cx + lr * Math.cos(a);
        const ly = cy + lr * Math.sin(a);
        ctx.font = '500 13px "Pretendard Variable","Pretendard",sans-serif';
        ctx.fillStyle = '#5A4F3E';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(LABELS[i], lx, ly);
      }
    };

    const drawData = (progs: number[]) => {
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const p = vtx(i, progs[i]);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      grad.addColorStop(0, hexToRgba(STROKE_COLOR, 0.06));
      grad.addColorStop(0.5, hexToRgba(STROKE_COLOR, 0.1));
      grad.addColorStop(1, hexToRgba(STROKE_COLOR, 0.14));
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = STROKE_COLOR;
      ctx.lineWidth = 2;
      ctx.stroke();
      /* dot 정적 — cream fill + stroke (호버 X) */
      for (let i = 0; i < N; i++) {
        if (progs[i] <= 0) continue;
        const p = vtx(i, progs[i]);
        const scale = Math.min(progs[i] * 2, 1);
        const r = DOT_R * scale;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = DOT_FILL_COLOR;
        ctx.fill();
        ctx.strokeStyle = STROKE_COLOR;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    };

    const drawStatic = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      drawBase();
      drawData(finalProgs);
      ctx.restore();
    };

    let start = 0;
    const animFrame = (now: number) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      drawBase();
      const progs: number[] = [];
      for (let i = 0; i < N; i++) {
        const vStart = i * stagger;
        const raw = Math.max(0, Math.min((elapsed - vStart) / vertexDur, 1));
        progs.push(easeBack(raw));
      }
      drawData(progs);
      ctx.restore();
      const lastEnd = (N - 1) * stagger + vertexDur;
      if (elapsed < lastEnd) {
        rafId = requestAnimationFrame(animFrame);
      } else {
        rafId = 0;
        animDone = true;
        finalProgs = progs;
        drawStatic();
      }
    };

    const startAnim = () => {
      if (rafId) cancelAnimationFrame(rafId);
      animDone = false;
      finalProgs = [];
      start = performance.now();
      rafId = requestAnimationFrame(animFrame);
    };

    const ro = new ResizeObserver(() => {
      setupCanvas();
      if (animDone) {
        drawStatic();
      }
    });
    ro.observe(canvas);

    /* IO 1회만 (S164 PR-3 후속) — 진입 시 startAnim + unobserve */
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            startAnim();
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.2 },
    );
    io.observe(canvas);

    return () => {
      io.disconnect();
      ro.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [note]);

  return (
    <div className="pd-radar-wrap">
      <canvas className="pd-radar-canvas" width={500} height={500} ref={canvasRef} />
    </div>
  );
}
