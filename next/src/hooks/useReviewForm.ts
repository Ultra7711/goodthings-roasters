/* ══════════════════════════════════════════
   useReviewForm — 리뷰 작성/수정 폼 상태 (Phase 1 Step 2 · Phase 2 경고)

   - 별점(rating) + 본문(body) state + 클라 즉시 검증
   - initial 있으면 수정(updateReview), 없으면 작성(createReview)
   - server action 결과 → 한국어 에러 매핑
   - Phase 2: 약(경계어) 감지 시 needs_confirm → 인라인 경고 → '그대로 등록'(confirmed)
   ══════════════════════════════════════════ */

'use client';

import { useCallback, useState } from 'react';
import { createReview, updateReview } from '@/lib/reviews';

type ReviewTargetInput = {
  productSlug: string | null;
  menuId: string | null;
};

/** 작성 결과 상태 — 토스트 분기용 (pending=검토 대기). */
export type SubmittedStatus = 'approved' | 'pending';

/** submit 결과 — success(완료) / confirm(약 경고 노출) / error(검증·저장 실패). */
export type SubmitOutcome = 'success' | 'confirm' | 'error';

type UseReviewFormOptions = {
  /** 작성 대상 — 상품 XOR 메뉴 (수정 모드에선 무시) */
  target: ReviewTargetInput;
  /** 수정 모드 초기값 */
  initial?: { id: string; rating: number; body: string };
  /** 성공 시 호출 (작성은 status 전달 · 수정은 undefined) */
  onSuccess?: (status?: SubmittedStatus) => void;
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
  /* 약(경계어) 감지 → 인라인 경고 노출 (작성자 '그대로 등록' 대기) */
  const [needsConfirm, setNeedsConfirm] = useState(false);

  const submit = useCallback(
    async (confirmed = false): Promise<SubmitOutcome> => {
      if (rating < 1) {
        setError('별점을 선택해 주세요.');
        return 'error';
      }
      if (body.trim().length < 1) {
        setError('리뷰 내용을 입력해 주세요.');
        return 'error';
      }

      setLoading(true);
      try {
        /* 수정: 강만 거부(약/통과는 update). status 전이 트리거상 pending 전환 불가. */
        if (initial) {
          const res = await updateReview(initial.id, { rating, body });
          if (res.ok) {
            setNeedsConfirm(false);
            onSuccess?.();
            return 'success';
          }
          setNeedsConfirm(false);
          setError(mapReviewError(res.error, res.message));
          return 'error';
        }

        /* 작성: 2-step. 약(경계) → needs_confirm → 인라인 경고 → confirmed 재호출. */
        const res = await createReview(
          { rating, body, productSlug: target.productSlug, menuId: target.menuId },
          confirmed,
        );
        if (res.ok) {
          setNeedsConfirm(false);
          onSuccess?.(res.status);
          return 'success';
        }
        if (res.error === 'needs_confirm') {
          setNeedsConfirm(true);
          return 'confirm';
        }
        setNeedsConfirm(false);
        setError(mapReviewError(res.error, res.message));
        return 'error';
      } finally {
        setLoading(false);
      }
    },
    [rating, body, initial, target, onSuccess],
  );

  /* 경고에서 '수정' 선택 → 경고 해제하고 폼 복귀 */
  const cancelConfirm = useCallback(() => setNeedsConfirm(false), []);

  return {
    rating,
    setRating,
    body,
    setBody,
    error,
    setError,
    isLoading,
    needsConfirm,
    submit,
    cancelConfirm,
  };
}
