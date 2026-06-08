import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   admin/reviewsServer.ts — /admin/reviews 리뷰 모더레이션 목록 (S314 Step 5)

   - reviews fetch (admin RLS SELECT 통과 · 085 reviews_select_admin · is_admin)
   - status 필터(검토대기/게재/차단/삭제) + 도메인(상품/메뉴) + 검색(본문/닉네임) + 페이지네이션
   - bizInquiriesServer 1:1 답습 (createRouteHandlerClient · listHelpers)
   ══════════════════════════════════════════════════════════════════════════ */

import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { summarizePgError } from './errors';
import { type AdminListResult, applyRange, applyIlikeSearch } from './listHelpers';
import {
  REVIEW_ADMIN_PAGE_SIZE,
  parseReviewSearchParams,
  sanitizeReviewQuery,
  type ReviewStatusTab,
  type ReviewSearchParams,
} from './reviews';
import type { ReviewStatus } from '@/types/review';

export type AdminReviewRow = {
  id: string;
  authorNickname: string;
  productSlug: string | null;
  menuId: string | null;
  rating: number;
  body: string;
  status: ReviewStatus;
  helpfulCount: number;
  moderationResult: unknown;
  createdAtIso: string;
};

type AdminReviewDbRow = {
  id: string;
  author_nickname: string;
  product_slug: string | null;
  menu_id: string | null;
  rating: number;
  body: string;
  status: ReviewStatus;
  helpful_count: number;
  moderation_result: unknown;
  created_at: string;
};

const SELECT_COLUMNS =
  'id, author_nickname, product_slug, menu_id, rating, body, status, helpful_count, moderation_result, created_at';

function mapRow(r: AdminReviewDbRow): AdminReviewRow {
  return {
    id: r.id,
    authorNickname: r.author_nickname,
    productSlug: r.product_slug,
    menuId: r.menu_id,
    rating: r.rating,
    body: r.body,
    status: r.status,
    helpfulCount: r.helpful_count,
    moderationResult: r.moderation_result,
    createdAtIso: r.created_at,
  };
}

export type AdminReviewsResult = AdminListResult<AdminReviewRow, ReviewStatusTab, ReviewSearchParams>;

export async function fetchAdminReviews(
  searchParamsRaw: Record<string, string | string[] | undefined>,
): Promise<AdminReviewsResult> {
  const filters = parseReviewSearchParams(searchParamsRaw);
  const supabase = await createRouteHandlerClient();

  /* 1) status 카운트 */
  const [pendingRes, approvedRes, blockedRes, deletedRes] = await Promise.all([
    supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('status', 'blocked'),
    supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('status', 'deleted'),
  ]);
  if (pendingRes.error) console.error('[fetchAdminReviews] pending count failed', summarizePgError(pendingRes.error));
  if (approvedRes.error) console.error('[fetchAdminReviews] approved count failed', summarizePgError(approvedRes.error));
  if (blockedRes.error) console.error('[fetchAdminReviews] blocked count failed', summarizePgError(blockedRes.error));
  if (deletedRes.error) console.error('[fetchAdminReviews] deleted count failed', summarizePgError(deletedRes.error));

  const pending = pendingRes.count ?? 0;
  const approved = approvedRes.count ?? 0;
  const blocked = blockedRes.count ?? 0;
  const deleted = deletedRes.count ?? 0;
  const counts: AdminReviewsResult['counts'] = {
    all: pending + approved + blocked + deleted,
    pending,
    approved,
    blocked,
    deleted,
  };

  /* 2) 메인 쿼리 (status + domain 필터 + q ilike(body/author_nickname) + 페이지네이션) */
  let query = applyRange(
    supabase
      .from('reviews')
      .select(SELECT_COLUMNS, { count: 'exact' })
      .order('created_at', { ascending: false }),
    filters.page,
    REVIEW_ADMIN_PAGE_SIZE,
  );
  if (filters.status !== 'all') query = query.eq('status', filters.status);
  if (filters.domain === 'product') query = query.not('product_slug', 'is', null);
  else if (filters.domain === 'menu') query = query.not('menu_id', 'is', null);
  query = applyIlikeSearch(query, sanitizeReviewQuery(filters.q), ['body', 'author_nickname']);

  const { data, count, error } = await query;
  if (error) {
    console.error('[fetchAdminReviews] query failed', summarizePgError(error));
    return { rows: [], total: 0, counts, filters };
  }

  return {
    rows: ((data ?? []) as AdminReviewDbRow[]).map(mapRow),
    total: count ?? 0,
    counts,
    filters,
  };
}
