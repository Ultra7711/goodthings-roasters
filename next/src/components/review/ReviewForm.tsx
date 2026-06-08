/* ══════════════════════════════════════════
   ReviewForm — 리뷰 작성/수정 폼 (Phase 1 Step 2)

   별점(RatingInput) + 본문(Textarea) + 등록/취소.
   PDP 섹션 + 카페 바텀시트 공용 (Step 4 통합 시 배치).
   ══════════════════════════════════════════ */

'use client';

import { useRef } from 'react';
import './review.css';
import RatingInput from './RatingInput';
import { Textarea } from '@/components/ui/Textarea';
import { useReviewForm } from '@/hooks/useReviewForm';
import { shakeFields } from '@/lib/shakeFields';

type Props = {
  /** 작성 대상 — 상품 XOR 메뉴 */
  target: { productSlug: string | null; menuId: string | null };
  /** 수정 모드 초기값 (없으면 작성) */
  initial?: { id: string; rating: number; body: string };
  onSuccess?: () => void;
  onCancel?: () => void;
};

export default function ReviewForm({ target, initial, onSuccess, onCancel }: Props) {
  const form = useReviewForm({ target, initial, onSuccess });
  const formRef = useRef<HTMLDivElement>(null);

  return (
    <div className="review-form" ref={formRef}>
      <div className="review-form-rating-row">
        <span className="review-form-rating-label">별점</span>
        <RatingInput
          value={form.rating}
          onChange={(v) => {
            form.setRating(v);
            form.setError(undefined);
          }}
          disabled={form.isLoading}
        />
      </div>

      <Textarea
        ariaLabel="리뷰 내용"
        value={form.body}
        onChange={(v) => {
          form.setBody(v);
          form.setError(undefined);
        }}
        maxLength={2000}
        rows={5}
      />

      {form.error && <p className="review-form-error">{form.error}</p>}

      <div className="review-form-actions">
        {onCancel && (
          <button
            type="button"
            className="cta-btn cta-btn-light-outline"
            onClick={onCancel}
            disabled={form.isLoading}
            data-gtr-tap
          >
            취소
          </button>
        )}
        <button
          type="button"
          className="cta-btn cta-btn-light-filled"
          disabled={form.isLoading}
          onClick={() => {
            void form.submit().then((ok) => {
              if (!ok) setTimeout(() => shakeFields(formRef.current), 0);
            });
          }}
          data-gtr-tap
        >
          {form.isLoading ? '저장 중…' : initial ? '수정' : '등록'}
        </button>
      </div>
    </div>
  );
}
