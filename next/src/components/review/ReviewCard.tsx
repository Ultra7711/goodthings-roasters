/* ══════════════════════════════════════════
   ReviewCard — 리뷰 카드 (Phase 1 Step 3)
   별점·닉네임·날짜·본문·도움돼요·본인 수정/삭제. PDP/시트 공용.
   ══════════════════════════════════════════ */

'use client';

import type { Review } from '@/types/review';
import RatingStars from './RatingStars';

const ThumbIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M7 10v10H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3zm3 0l3.5-7a2 2 0 0 1 2.6-1 2 2 0 0 1 1.2 2.3L16.5 9H20a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 18.8 20H10V10z"
      fill="currentColor"
    />
  </svg>
);

function formatDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, '.');
}

type Props = {
  review: Review;
  isMine: boolean;
  isHelpful: boolean;
  onToggleHelpful: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export default function ReviewCard({
  review,
  isMine,
  isHelpful,
  onToggleHelpful,
  onEdit,
  onDelete,
}: Props) {
  return (
    <article className="review-card">
      <div className="review-card-head">
        <RatingStars value={review.rating} size={14} />
        <span className="review-card-author">{review.authorNickname}</span>
        <span className="review-card-date">{formatDate(review.createdAt)}</span>
      </div>

      <p className="review-card-body">{review.body}</p>

      <div className="review-card-foot">
        <button
          type="button"
          className={`review-helpful-btn${isHelpful ? ' is-active' : ''}`}
          aria-pressed={isHelpful}
          onClick={onToggleHelpful}
          data-gtr-tap
        >
          <ThumbIcon />
          <span>도움돼요{review.helpfulCount > 0 ? ` ${review.helpfulCount}` : ''}</span>
        </button>

        {isMine && (
          <div className="review-card-mine">
            <button type="button" className="review-card-mine-btn" onClick={onEdit} data-gtr-tap>
              수정
            </button>
            <button type="button" className="review-card-mine-btn" onClick={onDelete} data-gtr-tap>
              삭제
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
