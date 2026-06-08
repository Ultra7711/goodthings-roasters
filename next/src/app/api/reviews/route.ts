/* ══════════════════════════════════════════════════════════════════════════
   GET /api/reviews — 리뷰 목록 + 요약 + 본인 도움돼요 (client fetch)

   쿼리: productSlug XOR menuId · sort(latest|helpful|rating) · offset · limit
   반환: { reviews, summary, hasMore, myHelpfuls }
   - reviews: approved 공개 (RLS reviews_select_public)
   - summary: get_review_summary RPC (평균/분포/총개수)
   - myHelpfuls: 로그인 시 현재 페이지 리뷰 중 본인이 누른 review_id
   ══════════════════════════════════════════════════════════════════════════ */

import { connection } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api/errors';
import { getClaims } from '@/lib/auth/getClaims';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { toReview, REVIEW_SELECT, type ReviewRow } from '@/lib/reviewMap';
import type { Review, ReviewSort, ReviewSummary } from '@/types/review';

const LIMIT_DEFAULT = 5;
const LIMIT_MAX = 20;
const EMPTY_SUMMARY: ReviewSummary = {
  total: 0,
  average: 0,
  distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
};

function parseInt0(v: string | null, fallback: number): number {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request): Promise<Response> {
  await connection();
  try {
    const url = new URL(req.url);
    const productSlug = url.searchParams.get('productSlug');
    const menuId = url.searchParams.get('menuId');
    const sortParam = (url.searchParams.get('sort') ?? 'latest') as ReviewSort;
    const offset = Math.max(0, parseInt0(url.searchParams.get('offset'), 0));
    const limit = Math.min(LIMIT_MAX, Math.max(1, parseInt0(url.searchParams.get('limit'), LIMIT_DEFAULT)));

    /* 상품 XOR 메뉴 — 정확히 하나 */
    if ((productSlug ? 1 : 0) + (menuId ? 1 : 0) !== 1) {
      return apiError('validation_failed');
    }

    const supabase = await createRouteHandlerClient();
    const claims = await getClaims();

    let query = supabase
      .from('reviews')
      .select(REVIEW_SELECT)
      .eq('status', 'approved');
    query = productSlug
      ? query.eq('product_slug', productSlug)
      : query.eq('menu_id', menuId as string);

    if (sortParam === 'helpful') {
      query = query.order('helpful_count', { ascending: false }).order('created_at', { ascending: false });
    } else if (sortParam === 'rating') {
      query = query.order('rating', { ascending: false }).order('created_at', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }
    query = query.range(offset, offset + limit - 1);

    const { data: rows, error } = await query;
    if (error) {
      console.error('[GET /api/reviews] list error', { code: error.code, message: error.message?.slice(0, 200) });
      return apiError('server_error');
    }

    /* 요약 (평균/분포/총개수) — SECURITY DEFINER RPC */
    const { data: summaryData, error: sumErr } = await supabase.rpc('get_review_summary', {
      p_product_slug: productSlug,
      p_menu_id: menuId,
    });
    if (sumErr) {
      console.error('[GET /api/reviews] summary error', { code: sumErr.code, message: sumErr.message?.slice(0, 200) });
    }
    const summary: ReviewSummary = (summaryData as ReviewSummary | null) ?? EMPTY_SUMMARY;

    const reviewRows = (rows ?? []) as ReviewRow[];
    const approvedReviews = reviewRows.map(toReview);

    /* 본인 검토 대기(pending) — 첫 페이지 + 로그인 시 상단 노출 (타인엔 비공개).
       RLS reviews_select_own 이 본인 전체 조회 허용. 평균/분포(summary)는 approved 만. */
    let myPending: Review[] = [];
    if (offset === 0 && claims) {
      const { data: pendingRows, error: pendErr } = await supabase
        .from('reviews')
        .select(REVIEW_SELECT)
        .eq(productSlug ? 'product_slug' : 'menu_id', (productSlug ?? menuId) as string)
        .eq('user_id', claims.userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (pendErr) {
        console.error('[GET /api/reviews] my pending error', { code: pendErr.code });
      } else {
        myPending = (pendingRows ?? []).map(toReview);
      }
    }
    const reviews = [...myPending, ...approvedReviews];

    /* 작성 권한 — 메뉴=로그인 누구나 / 상품=구매 이력(has_purchased_product RPC) */
    let canWrite = false;
    if (claims) {
      if (menuId) {
        canWrite = true;
      } else if (productSlug) {
        const { data: purchased, error: pErr } = await supabase.rpc('has_purchased_product', {
          p_product_slug: productSlug,
        });
        if (pErr) {
          console.error('[GET /api/reviews] purchase check error', { code: pErr.code });
        }
        canWrite = purchased === true;
      }
    }

    /* 본인 도움돼요 — 로그인 시 현재 페이지 리뷰 한정 */
    let myHelpfuls: string[] = [];
    if (claims && reviewRows.length > 0) {
      const ids = reviewRows.map((r) => r.id);
      const { data: hf, error: hfErr } = await supabase
        .from('review_helpfuls')
        .select('review_id')
        .eq('user_id', claims.userId)
        .in('review_id', ids);
      if (hfErr) {
        console.error('[GET /api/reviews] helpfuls error', { code: hfErr.code });
      } else {
        myHelpfuls = (hf ?? []).map((h) => h.review_id as string);
      }
    }

    /* hasMore 는 공개(approved) 기준 — 본인 pending 은 페이지네이션 무관(첫 페이지 상단). */
    const hasMore = offset + approvedReviews.length < summary.total;

    return apiSuccess({ reviews, summary, hasMore, myHelpfuls, canWrite });
  } catch (err) {
    console.error('[GET /api/reviews] unexpected', err);
    return apiError('server_error');
  }
}
