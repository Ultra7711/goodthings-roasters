/* ══════════════════════════════════════════
   ease.ts — 공통 이징 상수 / JS 평가기
   ──────────────────────────────────────────
   상품 상세 Roast 마커 / Flavor 레이더 꼭지점이
   동일 스프링 커브를 공유하도록 단일 상수로 통일.
   호버 연출은 CSS ease-out 에 맞춘 quadratic.
   ══════════════════════════════════════════ */

/** 진입 스프링 오버슈트 — Roast 마커 slide / Flavor 꼭지점 팝 공용 */
export const EASE_BACK = [0.4, 1.3, 0.5, 1] as const;

/** 진입용 cubic-bezier CSS 문자열 */
export const EASE_BACK_CSS = `cubic-bezier(${EASE_BACK.join(',')})`;

/**
 * 1D cubic-bezier 평가기. x(시간) → y(진행률) 반환.
 * Newton-Raphson 6회로 충분히 수렴.
 */
export function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (t: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    let t = x;
    for (let i = 0; i < 6; i++) {
      const dx = sampleX(t) - x;
      if (Math.abs(dx) < 1e-6) break;
      const d = sampleDx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= dx / d;
    }
    return sampleY(t);
  };
}

/** Roast 마커 + Flavor 꼭지점 진입 공용 — EASE_BACK 기반 오버슈트 */
export const easeBack = cubicBezier(...EASE_BACK);

/** 호버 확장/축소 공용 — CSS ease-out 을 JS 에서 근사 (quadratic) */
export const easeHoverOut = (t: number): number => 1 - (1 - t) * (1 - t);
