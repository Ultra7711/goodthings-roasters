/* ══════════════════════════════════════════
   RatingInput — 인터랙티브 별점 입력 (유저 리뷰 Phase 1 Step 2)

   - SVG 별 5개 · hover 미리보기 · 클릭 선택
   - a11y: role="radiogroup" + radio · 화살표/숫자(1~5) 키보드
   - 표시(읽기) 별점은 Step 3 RatingStars 별도.
   ══════════════════════════════════════════ */

'use client';

import { useCallback, useState } from 'react';

/* 표준 5각별 path (24×24 viewBox) — RatingStars(표시용)와 공유 */
export const STAR_PATH =
  'M12 2l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545L12 17.011l-5.878 3.09 1.123-6.545L2.489 8.91l6.572-.955z';

const STARS = [1, 2, 3, 4, 5] as const;

type Props = {
  /** 현재 별점 (0 = 미선택) */
  value: number;
  onChange: (value: number) => void;
  /** 별 크기 px (기본 32) */
  size?: number;
  disabled?: boolean;
};

export default function RatingInput({ value, onChange, size = 32, disabled }: Props) {
  const [hover, setHover] = useState(0);
  const display = hover || value;

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        onChange(Math.min(5, (value || 0) + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        onChange(Math.max(1, (value || 1) - 1));
      } else if (/^[1-5]$/.test(e.key)) {
        e.preventDefault();
        onChange(Number(e.key));
      }
    },
    [value, onChange, disabled],
  );

  return (
    <div
      className="review-rating-input"
      role="radiogroup"
      aria-label="별점 선택"
      onKeyDown={onKeyDown}
      onMouseLeave={() => setHover(0)}
    >
      {STARS.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n}점`}
          className="review-star-btn"
          disabled={disabled}
          /* roving tabindex — 선택값(또는 미선택 시 1번)만 tab 진입 */
          tabIndex={value === n || (value === 0 && n === 1) ? 0 : -1}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
        >
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={n <= display ? 'review-star is-filled' : 'review-star'}
          >
            <path d={STAR_PATH} />
          </svg>
        </button>
      ))}
    </div>
  );
}
