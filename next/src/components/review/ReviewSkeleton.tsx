/* ══════════════════════════════════════════
   ReviewSkeleton — 리뷰 영역 로딩 placeholder

   시트/PDP 리뷰는 client fetch(useReviews) 라 마운트 후 비동기로 채워진다.
   isLoading 동안 요약 0.0/0개 + "불러오는 중…" 점프 대신 스켈레톤으로 레이아웃을
   미리 reserve → 데이터 도착 시 점프·깜빡임 최소화.

   .skel 공용 atom(정적 gradient) 재활용 — search/cart/shop 동일 패턴.
   카드는 실제 .review-card 구조로 감싸 padding/border 높이 정합.
   ══════════════════════════════════════════ */

const DEFAULT_CARDS = 2;

/** 요약 헤더 스켈레톤 — 평균 숫자 + 별 + 개수 (분포는 데이터 도착 후). */
export function ReviewSummarySkeleton() {
  return (
    <div className="review-summary" aria-hidden="true">
      <div className="review-summary-avg">
        <span className="skel review-skel-avgnum" />
        <span className="skel review-skel-bigstars" />
        <span className="skel review-skel-count" />
      </div>
    </div>
  );
}

/** 카드 리스트 스켈레톤 — count 개 (sheet 2 / page 3 권장). */
export function ReviewListSkeleton({ count = DEFAULT_CARDS }: { count?: number }) {
  return (
    <div className="review-section-list" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className="review-card" key={i}>
          <div className="review-card-head">
            <span className="skel review-skel-cardstars" />
            <span className="skel review-skel-author" />
          </div>
          <span className="skel review-skel-line" />
          <span className="skel review-skel-line review-skel-line--short" />
        </div>
      ))}
    </div>
  );
}
