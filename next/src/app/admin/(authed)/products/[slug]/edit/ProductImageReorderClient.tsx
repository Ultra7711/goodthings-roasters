'use client';

/* ══════════════════════════════════════════════════════════════════════════
   ProductImageReorderClient — 이미지 갤러리 reorder UI (S218 Phase 1 추가)

   책임:
   - 이미지 카드 grid (sort_order asc)
   - 1번 = ★ 대표 배지 (카트/결제/카드에 노출됨)
   - 각 카드 [↑] [↓] 버튼 + "대표로" 버튼 (= 맨 앞 이동)
   - 변경 시 즉시 reorderProductImagesAction 호출 + sonner toast
   - 실패 시 rollback (optimistic UI)
   ══════════════════════════════════════════════════════════════════════════ */

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Button } from '@/components/admin/ui/button';
import { reorderProductImagesAction } from '../../actions';
import { cn } from '@/lib/utils';

type ImageItem = {
  id: string;
  src: string;
  blurDataUrl: string | null;
};

type Props = {
  productId: string;
  initialImages: ImageItem[];
};

export default function ProductImageReorderClient({
  productId,
  initialImages,
}: Props) {
  const [images, setImages] = useState(initialImages);
  const [pending, startTransition] = useTransition();

  function applyOrder(next: ImageItem[]) {
    const prev = images;
    setImages(next);
    startTransition(async () => {
      const result = await reorderProductImagesAction({
        productId,
        orderedImageIds: next.map((i) => i.id),
      });
      if (!result.ok) {
        setImages(prev);
        const msg =
          result.error === 'unauthorized'
            ? '권한이 없습니다. 다시 로그인해주세요.'
            : result.error === 'mismatch'
              ? '이미지 목록이 일치하지 않습니다. 페이지를 새로고침해주세요.'
              : result.error === 'validation_failed'
                ? '입력값이 올바르지 않습니다.'
                : '처리 중 오류가 발생했습니다.';
        toast.error(msg);
        return;
      }
      toast.success('이미지 순서가 저장되었습니다');
    });
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    const next = [...images];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    applyOrder(next);
  }

  function moveDown(idx: number) {
    if (idx === images.length - 1) return;
    const next = [...images];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    applyOrder(next);
  }

  function moveToFront(idx: number) {
    if (idx === 0) return;
    const next = [...images];
    const [item] = next.splice(idx, 1);
    next.unshift(item);
    applyOrder(next);
  }

  return (
    <div
      className={cn(
        'grid gap-3 transition-opacity duration-150 ease',
        pending ? 'opacity-70' : 'opacity-100',
      )}
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
    >
      {images.map((img, idx) => {
        const isFeatured = idx === 0;
        const canMoveUp = idx > 0;
        const canMoveDown = idx < images.length - 1;
        return (
          <div
            key={img.id}
            className={cn(
              'rounded-[var(--radius-sm)] overflow-hidden bg-[var(--surface)] relative',
              isFeatured ? 'border-2 border-[var(--primary)]' : 'border border-border',
            )}
          >
            {/* 썸네일 */}
            <div
              className="relative w-full aspect-square"
              style={{
                background:
                  'repeating-linear-gradient(135deg, var(--placeholder-pattern-1) 0 5px, var(--placeholder-pattern-2) 5px 10px)',
              }}
            >
              <Image
                src={img.src}
                alt=""
                fill
                sizes="180px"
                style={{ objectFit: 'cover' }}
                placeholder={img.blurDataUrl ? 'blur' : 'empty'}
                blurDataURL={img.blurDataUrl ?? undefined}
              />
              {/* 대표 배지 */}
              {isFeatured && (
                <span
                  className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--primary)] !text-white text-xs font-semibold"
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.18)' }}
                >
                  <StarIcon />
                  대표
                </span>
              )}
              {/* 순서 표시 */}
              <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-black/55 !text-white text-xs font-semibold tabular-nums">
                {idx + 1}
              </span>
            </div>

            {/* 액션 영역 */}
            <div className="p-2 flex flex-col gap-1.5">
              {/* 이동 버튼 */}
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => moveUp(idx)}
                  disabled={!canMoveUp || pending}
                  aria-label="앞으로 이동"
                  title="앞으로 이동"
                >
                  <ChevronLeftIcon />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => moveDown(idx)}
                  disabled={!canMoveDown || pending}
                  aria-label="뒤로 이동"
                  title="뒤로 이동"
                >
                  <ChevronRightIcon />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => moveToFront(idx)}
                  disabled={isFeatured || pending}
                  aria-label="대표로 설정"
                  title="대표로 설정"
                  className="flex-1 !h-7"
                >
                  <StarIcon />
                  대표로
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* S222 PR-5: miniBtnStyle 폐기 (shadcn Button variant=outline size=icon-sm/sm). */

function StarIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 17.3 6.18 21l1.64-6.81L2.5 9.7l7-.61L12 2.5l2.5 6.59 7 .61-5.32 4.49L17.82 21z" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
