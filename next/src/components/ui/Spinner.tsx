/* ══════════════════════════════════════════
   Spinner — 공통 호(arc) 스피너
   히어로 스크롤 스피너(S332 · HomePage.css) 디자인을 그대로 재사용.
   컬러는 currentColor 상속 → 부모의 color(또는 --spinner-color)로 제어.
   ══════════════════════════════════════════ */

import './Spinner.css';

type SpinnerProps = {
  /** px 크기 (정사각). 기본 40. */
  size?: number;
  className?: string;
};

export function Spinner({ size = 40, className }: SpinnerProps) {
  return (
    <svg
      className={`gtr-spinner${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="status"
      aria-label="로딩 중"
    >
      <circle className="gtr-spinner-arc" cx="12" cy="12" r="8" fill="none" />
    </svg>
  );
}
