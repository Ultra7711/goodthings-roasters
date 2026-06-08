/* ══════════════════════════════════════════
   RatingStars — 표시용 별점 (읽기 전용 · 소수 부분 채움)

   카드 = 정수 별점 / 헤더 평균 = 소수(예: 4.3) 부분 채움.
   ══════════════════════════════════════════ */

import { STAR_PATH } from './RatingInput';

const STARS = [1, 2, 3, 4, 5] as const;

type Props = {
  /** 0~5 (소수 허용 — 평균 표시) */
  value: number;
  /** 별 크기 px (기본 16) */
  size?: number;
};

export default function RatingStars({ value, size = 16 }: Props) {
  return (
    <span className="review-stars" role="img" aria-label={`5점 만점에 ${value}점`}>
      {STARS.map((i) => {
        const ratio = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span
            key={i}
            className="review-star-display"
            style={{ width: size, height: size }}
          >
            <svg width={size} height={size} viewBox="0 0 24 24" className="review-star-bg" aria-hidden="true">
              <path d={STAR_PATH} />
            </svg>
            {ratio > 0 && (
              <span className="review-star-fg-clip" style={{ width: `${ratio * 100}%` }}>
                <svg width={size} height={size} viewBox="0 0 24 24" className="review-star-fg" aria-hidden="true">
                  <path d={STAR_PATH} />
                </svg>
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
