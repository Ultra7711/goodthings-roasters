/* ══════════════════════════════════════════
   ReviewSummaryHeader — 평균 별점 + 분포 막대 (Phase 1 Step 4)
   variant: page=분포 항상 노출 / sheet=접기(탭)로 노출.
   ══════════════════════════════════════════ */

'use client';

import { useState } from 'react';
import type { ReviewSummary } from '@/types/review';
import RatingStars from './RatingStars';

const DIST_ROWS = [5, 4, 3, 2, 1] as const;

type Props = {
  summary: ReviewSummary;
  variant: 'page' | 'sheet';
};

export default function ReviewSummaryHeader({ summary, variant }: Props) {
  const [distOpen, setDistOpen] = useState(false);
  const showDist = variant === 'page' || distOpen;
  const hasReviews = summary.total > 0;

  return (
    <div className="review-summary">
      <div className="review-summary-avg">
        <span className="review-summary-avg-num">{summary.average.toFixed(1)}</span>
        <RatingStars value={summary.average} size={variant === 'sheet' ? 16 : 18} />
        <span className="review-summary-count">리뷰 {summary.total}개</span>
      </div>

      {variant === 'sheet' && hasReviews && (
        <button
          type="button"
          className="review-dist-toggle"
          aria-expanded={distOpen}
          onClick={() => setDistOpen((o) => !o)}
        >
          {distOpen ? '분포 접기' : '별점 분포 보기'}
        </button>
      )}

      {showDist && hasReviews && (
        <div className="review-summary-dist">
          {DIST_ROWS.map((s) => {
            const cnt = summary.distribution[String(s) as keyof ReviewSummary['distribution']];
            const pct = summary.total > 0 ? (cnt / summary.total) * 100 : 0;
            return (
              <div className="review-dist-row" key={s}>
                <span className="review-dist-label">{s}점</span>
                <span className="review-dist-bar">
                  <span className="review-dist-fill" style={{ width: `${pct}%` }} />
                </span>
                <span className="review-dist-cnt">{cnt}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
