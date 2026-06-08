/* ══════════════════════════════════════════
   Review Types — 유저 리뷰 (텍스트)
   상품 PDP 섹션 + 카페 메뉴 바텀시트 공용 (DEC-R1-UI)
   ══════════════════════════════════════════ */

/** 리뷰 상태 (085_user_reviews.sql · reviews_status_valid)
 * - pending   : AI 필터 큐 (Phase 2 · graceful fallback)
 * - approved  : 공개
 * - blocked   : 차단 (AI 미통과 또는 어드민 차단)
 * - deleted   : soft delete (작성자/어드민)
 */
export type ReviewStatus = 'pending' | 'approved' | 'blocked' | 'deleted';

/** 리뷰 대상 도메인 — 상품(product_slug) XOR 메뉴(menu_id) */
export type ReviewTarget =
  | { productSlug: string; menuId: null }
  | { productSlug: null; menuId: string };

/** 리뷰 (앱 camelCase — DB reviews 행 매핑) */
export type Review = {
  id: string;
  /** 탈퇴 시 익명 보존 → null 가능 (author_nickname 으로 표시) */
  userId: string | null;
  /** 작성 시점 닉네임 스냅샷 (공개 표시명) */
  authorNickname: string;
  productSlug: string | null;
  menuId: string | null;
  rating: number; // 1~5
  body: string; // 1~2000자
  status: ReviewStatus;
  helpfulCount: number;
  createdAt: string;
  updatedAt: string;
};

/** 별점 분포 (1~5 각 개수) */
export type RatingDistribution = Record<'1' | '2' | '3' | '4' | '5', number>;

/** 리뷰 요약 — get_review_summary RPC 반환 (평균/분포/총개수) */
export type ReviewSummary = {
  total: number;
  average: number; // 소수 1자리
  distribution: RatingDistribution;
};

/** 리뷰 정렬 (DEC-R-meta) */
export type ReviewSort = 'latest' | 'helpful' | 'rating';
