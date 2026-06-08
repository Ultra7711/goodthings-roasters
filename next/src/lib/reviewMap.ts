/* ══════════════════════════════════════════
   reviewMap — reviews DB row → Review (camelCase) 변환
   순수 함수 (client/server 공용). orderRepo toOrder 패턴 답습.
   ══════════════════════════════════════════ */

import type { Review, ReviewStatus } from '@/types/review';

export type ReviewRow = {
  id: string;
  user_id: string | null;
  author_nickname: string;
  product_slug: string | null;
  menu_id: string | null;
  rating: number;
  body: string;
  status: string;
  helpful_count: number;
  created_at: string;
  updated_at: string;
};

/** 공개 목록 select 컬럼 (moderation_result 등 비노출) */
export const REVIEW_SELECT =
  'id, user_id, author_nickname, product_slug, menu_id, rating, body, status, helpful_count, created_at, updated_at';

export function toReview(row: ReviewRow): Review {
  return {
    id: row.id,
    userId: row.user_id,
    authorNickname: row.author_nickname,
    productSlug: row.product_slug,
    menuId: row.menu_id,
    rating: row.rating,
    body: row.body,
    status: row.status as ReviewStatus,
    helpfulCount: row.helpful_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
