/* ══════════════════════════════════════════
   ReviewSection — 리뷰 영역 컨테이너 (Phase 1 Step 4)
   요약 헤더 + 정렬 + 작성/수정 폼 + 카드 리스트 + 더 보기.
   variant: page(상품 PDP) / sheet(카페 바텀시트).
   ══════════════════════════════════════════ */

'use client';

import './review.css';
import { useState } from 'react';
import { useReviews, type ReviewTarget } from '@/hooks/useReviews';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { useToast } from '@/hooks/useToast';
import { deleteReview } from '@/lib/reviews';
import type { ReviewSort } from '@/types/review';
import ReviewSummaryHeader from './ReviewSummaryHeader';
import ReviewCard from './ReviewCard';
import ReviewForm from './ReviewForm';

const PAGE_SIZE: Record<'page' | 'sheet', number> = { page: 5, sheet: 3 };

const SORTS: { key: ReviewSort; label: string }[] = [
  { key: 'latest', label: '최신순' },
  { key: 'helpful', label: '도움순' },
  { key: 'rating', label: '별점순' },
];

type Props = {
  variant: 'page' | 'sheet';
  target: ReviewTarget;
};

export default function ReviewSection({ variant, target }: Props) {
  const r = useReviews(target, PAGE_SIZE[variant]);
  const canWrite = r.canWrite;
  const { user, isLoggedIn } = useSupabaseSession();
  const { show: toast } = useToast();
  const [writing, setWriting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const currentUserId = user?.id ?? null;
  const myReview = currentUserId ? r.reviews.find((rv) => rv.userId === currentUserId) : undefined;

  /* ReviewForm 의 target prop (productSlug XOR menuId 둘 다 키 보유) */
  const formTarget =
    'productSlug' in target
      ? { productSlug: target.productSlug, menuId: null }
      : { productSlug: null, menuId: target.menuId };

  const handleDelete = async (id: string) => {
    if (!window.confirm('리뷰를 삭제할까요?')) return;
    const res = await deleteReview(id);
    if (res.ok) {
      toast('리뷰가 삭제되었습니다.');
      r.refresh();
    } else {
      toast('삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  return (
    <div className={`review-section review-section--${variant}`}>
      <ReviewSummaryHeader summary={r.summary} variant={variant} />

      <div className="review-section-top">
        <div className="review-sort" role="tablist" aria-label="리뷰 정렬">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={r.sort === s.key}
              className={`review-sort-btn${r.sort === s.key ? ' is-active' : ''}`}
              onClick={() => r.changeSort(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {isLoggedIn && canWrite && !myReview && !writing && (
          <button
            type="button"
            className="cta-btn cta-btn-light-outline"
            onClick={() => setWriting(true)}
            data-gtr-tap
          >
            리뷰 작성
          </button>
        )}
      </div>

      {/* 작성 폼 */}
      {writing && !myReview && (
        <div className="review-section-write">
          <ReviewForm
            target={formTarget}
            onSuccess={() => {
              setWriting(false);
              toast('리뷰가 등록되었습니다.');
              r.refresh();
            }}
            onCancel={() => setWriting(false)}
          />
        </div>
      )}

      {/* 작성 권한 안내 */}
      {!isLoggedIn && (
        <p className="review-section-empty">로그인 후 리뷰를 작성할 수 있습니다.</p>
      )}
      {isLoggedIn && !canWrite && !myReview && (
        <p className="review-section-empty">구매하신 분만 리뷰를 작성할 수 있습니다.</p>
      )}

      {/* 목록 */}
      {r.isLoading ? (
        <p className="review-section-empty">불러오는 중…</p>
      ) : r.reviews.length === 0 ? (
        <p className="review-section-empty">아직 리뷰가 없습니다. 첫 리뷰를 남겨주세요.</p>
      ) : (
        <div className="review-section-list">
          {r.reviews.map((rv) =>
            editId === rv.id ? (
              <div key={rv.id} className="review-section-write">
                <ReviewForm
                  target={formTarget}
                  initial={{ id: rv.id, rating: rv.rating, body: rv.body }}
                  onSuccess={() => {
                    setEditId(null);
                    toast('리뷰가 수정되었습니다.');
                    r.refresh();
                  }}
                  onCancel={() => setEditId(null)}
                />
              </div>
            ) : (
              <ReviewCard
                key={rv.id}
                review={rv}
                isMine={rv.userId === currentUserId}
                isHelpful={r.myHelpfuls.has(rv.id)}
                onToggleHelpful={() =>
                  r.toggleHelpful(rv.id, () => toast('로그인이 필요합니다.'))
                }
                onEdit={() => setEditId(rv.id)}
                onDelete={() => handleDelete(rv.id)}
              />
            ),
          )}
        </div>
      )}

      {r.hasMore && !r.isLoading && (
        <button
          type="button"
          className="cta-btn cta-btn-light-outline review-section-more"
          onClick={r.loadMore}
          disabled={r.isLoadingMore}
          data-gtr-tap
        >
          {r.isLoadingMore ? '불러오는 중…' : '더 보기'}
        </button>
      )}
    </div>
  );
}
