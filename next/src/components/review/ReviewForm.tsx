/* ══════════════════════════════════════════
   ReviewForm — 리뷰 작성/수정 폼 (Phase 1 Step 2)

   별점(RatingInput) + 본문(Textarea) + 등록/취소.
   PDP 섹션 + 카페 바텀시트 공용 (Step 4 통합 시 배치).
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef } from 'react';
import './review.css';
import RatingInput from './RatingInput';
import { Textarea } from '@/components/ui/Textarea';
import { useReviewForm, type SubmittedStatus } from '@/hooks/useReviewForm';
import { shakeFields } from '@/lib/shakeFields';

type Props = {
  /** 작성 대상 — 상품 XOR 메뉴 */
  target: { productSlug: string | null; menuId: string | null };
  /** 수정 모드 초기값 (없으면 작성) */
  initial?: { id: string; rating: number; body: string };
  onSuccess?: (status?: SubmittedStatus) => void;
  onCancel?: () => void;
};

export default function ReviewForm({ target, initial, onSuccess, onCancel }: Props) {
  const form = useReviewForm({ target, initial, onSuccess });
  const formRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* 작성/수정 폼 마운트 시 입력칸 자동 포커스 (입력 필드 단일).
     preventScroll — 스크롤은 ReviewSection(컨테이너 scrollHeight)이 담당.
     수정 모드는 커서를 본문 맨 뒤로 (작성 모드는 빈 값이라 0,0 = 무관). */
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus({ preventScroll: true });
    const len = ta.value.length;
    ta.setSelectionRange(len, len);
  }, []);

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
        ref={textareaRef}
        ariaLabel="리뷰 내용"
        value={form.body}
        onChange={(v) => {
          form.setBody(v);
          form.setError(undefined);
        }}
        maxLength={2000}
        rows={5}
      />

      {/* 메시지 고정 슬롯 — 에러/경고 동일 높이 (버튼 위치 고정) */}
      <p
        className="review-form-msg"
        data-tone={form.error ? 'error' : form.needsConfirm ? 'warn' : undefined}
      >
        {form.error ?? (form.needsConfirm ? '부적절할 수 있는 표현이 감지됐어요.' : '')}
      </p>

      {form.needsConfirm ? (
        /* 약(경계어) 경고 — 수정 / 그대로 등록(검토 대기) */
        <div className="review-form-actions">
          <button
            type="button"
            className="cta-btn cta-btn-light-outline"
            onClick={form.cancelConfirm}
            disabled={form.isLoading}
            data-gtr-tap
          >
            수정
          </button>
          <button
            type="button"
            className="cta-btn cta-btn-light-filled"
            disabled={form.isLoading}
            onClick={() => void form.submit(true)}
            data-gtr-tap
          >
            {form.isLoading ? '등록 중…' : '그대로 등록'}
          </button>
        </div>
      ) : (
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
              void form.submit().then((outcome) => {
                if (outcome === 'error') setTimeout(() => shakeFields(formRef.current), 0);
              });
            }}
            data-gtr-tap
          >
            {form.isLoading ? (initial ? '수정 중…' : '등록 중…') : initial ? '수정' : '등록'}
          </button>
        </div>
      )}
    </div>
  );
}
