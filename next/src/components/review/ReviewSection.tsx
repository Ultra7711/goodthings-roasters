/* ══════════════════════════════════════════
   ReviewSection — 리뷰 영역 컨테이너 (Phase 1 Step 4)
   요약 헤더 + 정렬 + 작성/수정 폼 + 카드 리스트 + 더 보기.
   variant: page(상품 PDP) / sheet(카페 바텀시트).
   ══════════════════════════════════════════ */

'use client';

import './review.css';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useReviews, type ReviewTarget } from '@/hooks/useReviews';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { useToast } from '@/hooks/useToast';
import { deleteReview } from '@/lib/reviews';
import type { ReviewSort } from '@/types/review';
import ReviewSummaryHeader from './ReviewSummaryHeader';
import ReviewCard from './ReviewCard';
import ReviewForm from './ReviewForm';
import { ReviewSummarySkeleton, ReviewListSkeleton } from './ReviewSkeleton';

const PAGE_SIZE: Record<'page' | 'sheet', number> = { page: 5, sheet: 3 };

const SORTS: { key: ReviewSort; label: string }[] = [
  { key: 'latest', label: '최신순' },
  { key: 'helpful', label: '도움순' },
  { key: 'rating', label: '별점순' },
];

type Props = {
  variant: 'page' | 'sheet';
  target: ReviewTarget;
  /** 좌측 요약 컬럼 상단 타이틀 (PDP 2단용 · 시트는 미사용) */
  title?: ReactNode;
};

export default function ReviewSection({ variant, target, title }: Props) {
  const r = useReviews(target, PAGE_SIZE[variant]);
  const { user, isLoggedIn } = useSupabaseSession();
  /* 메뉴(sheet)는 구매 검증 불필요 → 세션으로 즉시 판정(API 왕복 대기 제거).
     상품(page)은 구매 여부 검증이 필요해 API canWrite 사용. */
  const canWrite = variant === 'sheet' ? isLoggedIn : r.canWrite;
  const { show: toast } = useToast();
  const [writing, setWriting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const writeFormRef = useRef<HTMLDivElement>(null);

  /* 작성 폼 펼침 시 스크롤 컨테이너를 맨 끝까지 이동 (시트 내부 #cns-panel / 페이지 공용).
     scrollIntoView(block:'end')는 폼 경계까지만 가 하단 패딩이 잘려 어색 → 컨테이너
     scrollHeight 까지 스크롤해 폼 + 하단 여백 전체가 보이게. */
  useEffect(() => {
    if (!writing || !writeFormRef.current) return;
    const el = writeFormRef.current;
    requestAnimationFrame(() => {
      let p: HTMLElement | null = el.parentElement;
      while (p) {
        const oy = getComputedStyle(p).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) {
          p.scrollTo({ top: p.scrollHeight, behavior: 'smooth' });
          return;
        }
        p = p.parentElement;
      }
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    });
  }, [writing]);

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
      {/* 좌 컬럼 (데스크탑 sticky) — 타이틀 + 평균/별/개수/분포 */}
      <div className="review-section-summary">
        {title}
        {r.isLoading ? (
          <ReviewSummarySkeleton />
        ) : (
          <ReviewSummaryHeader summary={r.summary} variant={variant} />
        )}
      </div>

      {/* 우 컬럼 — 정렬 + 목록 + 더보기 + 작성 */}
      <div className="review-section-main">
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

        {/* 목록 (비었을 때 — 작성 중이면 빈 안내 숨김) */}
        {r.isLoading ? (
        <ReviewListSkeleton count={variant === 'sheet' ? 2 : 3} />
      ) : r.reviews.length === 0 ? (
        /* 빈 안내는 작성 가능자에게만(첫 리뷰 유도). 미구매/비로그인은 하단 권한 안내로 일원화. */
        !writing && canWrite && (
          <p className="review-section-empty">아직 리뷰가 없습니다. 첫 리뷰를 남겨주세요.</p>
        )
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
          className="text-link review-section-more"
          onClick={r.loadMore}
          disabled={r.isLoadingMore}
          data-gtr-tap
        >
          {r.isLoadingMore ? '불러오는 중…' : '더 보기'}
        </button>
      )}

      {/* 하단 작성 영역 — 로딩 완료 후 단일 분기 (깜빡임/중복 방지).
          비로그인=로그인안내 / 본인작성=null / 작성가능=폼 또는 버튼 /
          상품 미구매=구매안내(메뉴는 안내 없음 — 누구나 작성). */}
      {!r.isLoading &&
        (!isLoggedIn ? (
          <p className="review-section-empty">로그인 후 리뷰를 작성할 수 있습니다.</p>
        ) : myReview ? null : canWrite ? (
          writing ? (
            <div className="review-section-write" ref={writeFormRef}>
              <ReviewForm
                target={formTarget}
                onSuccess={(status) => {
                  setWriting(false);
                  toast(
                    status === 'pending'
                      ? '리뷰가 접수되었습니다. 검토 후 공개됩니다.'
                      : '리뷰가 등록되었습니다.',
                  );
                  r.refresh();
                }}
                onCancel={() => setWriting(false)}
              />
            </div>
          ) : (
            <button
              type="button"
              className="cta-btn cta-btn-light-outline review-section-write-cta"
              onClick={() => setWriting(true)}
              data-gtr-tap
            >
              리뷰 작성
            </button>
          )
        ) : variant === 'page' ? (
          <p className="review-section-empty">구매하신 분만 리뷰를 작성할 수 있습니다.</p>
        ) : null)}
      </div>
    </div>
  );
}
