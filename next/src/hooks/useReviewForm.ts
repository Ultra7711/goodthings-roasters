/* ══════════════════════════════════════════
   useReviewForm — 리뷰 작성/수정 폼 상태 (Phase 1 Step 2)

   - 별점(rating) + 본문(body) state + 클라 즉시 검증
   - initial 있으면 수정(updateReview), 없으면 작성(createReview)
   - server action 결과 → 한국어 에러 매핑
   ══════════════════════════════════════════ */

'use client';

import { useCallback, useState } from 'react';
import { createReview, updateReview } from '@/lib/reviews';

type ReviewTargetInput = {
  productSlug: string | null;
  menuId: string | null;
};

type UseReviewFormOptions = {
  /** 작성 대상 — 상품 XOR 메뉴 (수정 모드에선 무시) */
  target: ReviewTargetInput;
  /** 수정 모드 초기값 */
  initial?: { id: string; rating: number; body: string };
  /** 성공 시 호출 */
  onSuccess?: () => void;
};

function mapReviewError(error: string, message?: string): string {
  switch (error) {
    case 'not_eligible':
      return '구매한 상품에만 리뷰를 작성할 수 있습니다.';
    case 'already_reviewed':
      return '이미 작성한 리뷰가 있습니다. 기존 리뷰를 수정해 주세요.';
    case 'blocked':
      return '부적절한 표현이 포함되어 등록할 수 없습니다. 내용을 확인해 주세요.';
    case 'unauthenticated':
      return '로그인이 필요합니다.';
    case 'invalid':
      return message ?? '입력값을 확인해 주세요.';
    default:
      return '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.';
  }
}

export function useReviewForm({ target, initial, onSuccess }: UseReviewFormOptions) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [body, setBody] = useState(initial?.body ?? '');
  const [error, setError] = useState<string | undefined>(undefined);
  const [isLoading, setLoading] = useState(false);

  const submit = useCallback(async (): Promise<boolean> => {
    if (rating < 1) {
      setError('별점을 선택해 주세요.');
      return false;
    }
    if (body.trim().length < 1) {
      setError('리뷰 내용을 입력해 주세요.');
      return false;
    }

    setLoading(true);
    const res = initial
      ? await updateReview(initial.id, { rating, body })
      : await createReview({ rating, body, productSlug: target.productSlug, menuId: target.menuId });
    setLoading(false);

    if (res.ok) {
      onSuccess?.();
      return true;
    }
    setError(mapReviewError(res.error, 'message' in res ? res.message : undefined));
    return false;
  }, [rating, body, initial, target, onSuccess]);

  return { rating, setRating, body, setBody, error, setError, isLoading, submit };
}
