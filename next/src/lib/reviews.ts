'use server';

/* ══════════════════════════════════════════════════════════════════════════
   lib/reviews.ts — 유저 리뷰 server action (Phase 1 Step 2)

   책임:
   - createReview / updateReview / deleteReview(soft)
   - Zod 검증 (rating 1~5 · body 1~2000 · 상품 XOR 메뉴)
   - 작성 게이팅은 RLS(085)가 DB 강제 — 상품 미구매 시 42501 → 'not_eligible' 매핑
   - author_nickname 은 트리거(set_review_author_nickname)가 강제 → payload 생략

   참조:
   - 085_user_reviews.sql (RLS · 게이팅 · 트리거)
   - lib/bizSubmit.ts (id 사전생성 + RETURNING 회피 패턴 답습)
   ════════════════════════════════════════════════════════════════════════ */

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { moderateReviewBody } from '@/lib/admin/reviewModeration';

/* 상품 XOR 메뉴 — 정확히 하나 */
const reviewSchema = z
  .object({
    rating: z.number().int().min(1, '별점을 선택해 주세요.').max(5),
    body: z
      .string()
      .trim()
      .min(1, '리뷰 내용을 입력해 주세요.')
      .max(2000, '리뷰는 2000자 이하여야 합니다.'),
    productSlug: z.string().trim().min(1).nullable().default(null),
    menuId: z.string().trim().min(1).nullable().default(null),
  })
  .refine(
    (v) => (v.productSlug !== null) !== (v.menuId !== null),
    { message: '리뷰 대상이 올바르지 않습니다.' },
  );

export type CreateReviewInput = z.input<typeof reviewSchema>;

export type CreateReviewResult =
  | { ok: true; id: string; status: 'approved' | 'pending' }
  | {
      ok: false;
      error:
        | 'unauthenticated'
        | 'invalid'
        | 'not_eligible'
        | 'already_reviewed'
        | 'blocked'
        | 'needs_confirm'
        | 'db_error';
      message?: string;
    };

export async function createReview(
  input: CreateReviewInput,
  /** 약(경계어) 인라인 경고 후 작성자가 '그대로 등록' 확인 시 true → pending 저장. */
  confirmed = false,
): Promise<CreateReviewResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'invalid', message: parsed.error.issues[0]?.message };
  }
  const { rating, body, productSlug, menuId } = parsed.data;

  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  /* 욕설 필터 (Phase 2 · 로컬 사전 동기 검수). 결정적·throw 없음. */
  const moderation = await moderateReviewBody(body);

  /* 강(명백 욕설·혐오·위협) → 작성 거부 (저장 안 함 → 작성자 즉시 수정·재작성 자유). */
  if (moderation.status === 'blocked') {
    return { ok: false, error: 'blocked' };
  }
  /* 약(경계·문맥의존) → 1차엔 인라인 경고 요청 (저장 안 함). 작성자가 '그대로 등록'
     (confirmed=true) 으로 재호출할 때만 pending 저장 → 어드민 검토 큐(허용/삭제). */
  if (moderation.status === 'pending' && !confirmed) {
    return { ok: false, error: 'needs_confirm' };
  }

  /* 저장: clean→approved 즉시 게재 / 약+confirmed→pending.
     id 사전생성 + RETURNING 회피 (bizSubmit 답습 · author_nickname 은 트리거 강제). */
  const id = randomUUID();
  const { error } = await supabase.from('reviews').insert({
    id,
    user_id: user.id,
    product_slug: productSlug,
    menu_id: menuId,
    rating,
    body,
    status: moderation.status,
    moderation_result: moderation.result,
  });

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'already_reviewed' };
    /* 42501 = RLS insert 거부 (상품 미구매 게이팅). */
    if (error.code === '42501') return { ok: false, error: 'not_eligible' };
    console.error('[reviews.createReview] insert failed', error);
    return { ok: false, error: 'db_error' };
  }
  return { ok: true, id, status: moderation.status };
}

const updateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(1).max(2000),
});

export type UpdateReviewResult =
  | { ok: true }
  | { ok: false; error: 'unauthenticated' | 'invalid' | 'blocked' | 'db_error'; message?: string };

/* 본인 리뷰 수정 (rating/body). status 미변경 → 전이 트리거 무관. RLS 본인만. */
export async function updateReview(
  id: string,
  input: z.input<typeof updateSchema>,
): Promise<UpdateReviewResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'invalid', message: parsed.error.issues[0]?.message };
  }

  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  /* 수정 본문 재검수 (작성 우회 차단). status 전이 트리거상 작성자는 approved→blocked
     전환이 불가하므로, 강(명백 욕설) 감지 시 update 자체를 거부(body 유지·기존 status 보존).
     약(pending 판정)·통과는 그대로 수정 허용 — 경계어로 정상 수정 막지 않음. */
  const moderation = await moderateReviewBody(parsed.data.body);
  if (moderation.status === 'blocked') {
    return { ok: false, error: 'blocked' };
  }

  const { error } = await supabase
    .from('reviews')
    .update({ rating: parsed.data.rating, body: parsed.data.body })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('[reviews.updateReview] failed', error);
    return { ok: false, error: 'db_error' };
  }
  return { ok: true };
}

export type DeleteReviewResult =
  | { ok: true }
  | { ok: false; error: 'unauthenticated' | 'db_error' };

/* soft delete — status='deleted' (전이 트리거: 본인+deleted 허용). RLS 본인만. */
export async function deleteReview(id: string): Promise<DeleteReviewResult> {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const { error } = await supabase
    .from('reviews')
    .update({ status: 'deleted' })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('[reviews.deleteReview] failed', error);
    return { ok: false, error: 'db_error' };
  }
  return { ok: true };
}
