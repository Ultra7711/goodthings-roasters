/* ══════════════════════════════════════════
   useReviews — 리뷰 목록 client fetch (Phase 1 Step 3)

   - 마운트 시 첫 페이지 + 요약 로드
   - 정렬 변경(최신/별점/도움순) → 첫 페이지 리셋
   - 더 보기 → offset 누적 append
   - 도움돼요 optimistic 토글 (+ 실패 롤백)
   ══════════════════════════════════════════ */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Review, ReviewSummary, ReviewSort } from '@/types/review';

export type ReviewTarget = { productSlug: string } | { menuId: string };

const EMPTY_SUMMARY: ReviewSummary = {
  total: 0,
  average: 0,
  distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
};

type ApiPayload = {
  reviews: Review[];
  summary: ReviewSummary;
  hasMore: boolean;
  myHelpfuls: string[];
  canWrite: boolean;
};

function targetQuery(target: ReviewTarget): string {
  return 'productSlug' in target
    ? `productSlug=${encodeURIComponent(target.productSlug)}`
    : `menuId=${encodeURIComponent(target.menuId)}`;
}

export function useReviews(target: ReviewTarget, pageSize: number) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<ReviewSummary>(EMPTY_SUMMARY);
  const [sort, setSort] = useState<ReviewSort>('latest');
  const [hasMore, setHasMore] = useState(false);
  const [canWrite, setCanWrite] = useState(false);
  const [myHelpfuls, setMyHelpfuls] = useState<Set<string>>(new Set());
  const [isLoading, setLoading] = useState(true);
  const [isLoadingMore, setLoadingMore] = useState(false);

  const qs = targetQuery(target);
  /* 정렬 변경/더보기 경쟁 방지 — 최신 요청만 반영 */
  const reqIdRef = useRef(0);

  const fetchPage = useCallback(
    async (nextSort: ReviewSort, offset: number, append: boolean) => {
      const reqId = ++reqIdRef.current;
      const url = `/api/reviews?${qs}&sort=${nextSort}&offset=${offset}&limit=${pageSize}`;
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const json = (await res.json()) as { data: ApiPayload };
        if (reqId !== reqIdRef.current) return; // stale 응답 폐기
        const data = json.data;
        setReviews((prev) => (append ? [...prev, ...data.reviews] : data.reviews));
        setSummary(data.summary);
        setHasMore(data.hasMore);
        setCanWrite(data.canWrite);
        setMyHelpfuls((prev) => {
          const next = new Set(append ? prev : []);
          data.myHelpfuls.forEach((id) => next.add(id));
          return next;
        });
      } catch (err) {
        console.error('[useReviews] fetch failed', err);
      }
    },
    [qs, pageSize],
  );

  useEffect(() => {
    setLoading(true);
    void fetchPage('latest', 0, false).finally(() => setLoading(false));
  }, [fetchPage]);

  const changeSort = useCallback(
    (next: ReviewSort) => {
      if (next === sort) return;
      setSort(next);
      setLoading(true);
      void fetchPage(next, 0, false).finally(() => setLoading(false));
    },
    [sort, fetchPage],
  );

  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    setLoadingMore(true);
    void fetchPage(sort, reviews.length, true).finally(() => setLoadingMore(false));
  }, [isLoadingMore, hasMore, sort, reviews.length, fetchPage]);

  /* 도움돼요 optimistic 토글. 401 → onAuthRequired. 실패 → 롤백. */
  const toggleHelpful = useCallback(
    async (reviewId: string, onAuthRequired?: () => void) => {
      const liked = myHelpfuls.has(reviewId);
      const delta = liked ? -1 : 1;

      setMyHelpfuls((prev) => {
        const next = new Set(prev);
        if (liked) next.delete(reviewId);
        else next.add(reviewId);
        return next;
      });
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId ? { ...r, helpfulCount: Math.max(0, r.helpfulCount + delta) } : r,
        ),
      );

      const rollback = () => {
        setMyHelpfuls((prev) => {
          const next = new Set(prev);
          if (liked) next.add(reviewId);
          else next.delete(reviewId);
          return next;
        });
        setReviews((prev) =>
          prev.map((r) =>
            r.id === reviewId ? { ...r, helpfulCount: Math.max(0, r.helpfulCount - delta) } : r,
          ),
        );
      };

      try {
        const res = await fetch(`/api/reviews/${reviewId}/helpful`, {
          method: liked ? 'DELETE' : 'POST',
        });
        if (res.status === 401) {
          rollback();
          onAuthRequired?.();
          return;
        }
        if (!res.ok) rollback();
      } catch (err) {
        console.error('[useReviews] toggleHelpful failed', err);
        rollback();
      }
    },
    [myHelpfuls],
  );

  /* 작성/수정/삭제 후 새로고침 — 현재 정렬 첫 페이지로 리셋 */
  const refresh = useCallback(() => {
    setLoading(true);
    void fetchPage(sort, 0, false).finally(() => setLoading(false));
  }, [sort, fetchPage]);

  return {
    reviews,
    summary,
    sort,
    hasMore,
    canWrite,
    myHelpfuls,
    isLoading,
    isLoadingMore,
    changeSort,
    loadMore,
    toggleHelpful,
    refresh,
  };
}
