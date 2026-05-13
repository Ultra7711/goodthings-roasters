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
import { reorderProductImagesAction } from '../../actions';

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
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 12,
        opacity: pending ? 0.7 : 1,
        transition: 'opacity 0.15s ease',
      }}
    >
      {images.map((img, idx) => {
        const isFeatured = idx === 0;
        const canMoveUp = idx > 0;
        const canMoveDown = idx < images.length - 1;
        return (
          <div
            key={img.id}
            style={{
              border: isFeatured
                ? '2px solid var(--primary)'
                : '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
              background: 'var(--surface)',
              position: 'relative',
            }}
          >
            {/* 썸네일 */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '1 / 1',
                background:
                  'repeating-linear-gradient(135deg, #EEEDEB 0 5px, #F5F4F2 5px 10px)',
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
                  style={{
                    position: 'absolute',
                    top: 6,
                    left: 6,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 8px',
                    borderRadius: 999,
                    background: 'var(--primary)',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '-0.005em',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
                  }}
                >
                  <StarIcon />
                  대표
                </span>
              )}
              {/* 순서 표시 */}
              <span
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 22,
                  height: 22,
                  padding: '0 6px',
                  borderRadius: 999,
                  background: 'rgba(0, 0, 0, 0.55)',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {idx + 1}
              </span>
            </div>

            {/* 액션 영역 */}
            <div
              style={{
                padding: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {/* 이동 버튼 */}
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  onClick={() => moveUp(idx)}
                  disabled={!canMoveUp || pending}
                  aria-label="앞으로 이동"
                  title="앞으로 이동"
                  style={miniBtnStyle(!canMoveUp || pending)}
                >
                  <ChevronLeftIcon />
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(idx)}
                  disabled={!canMoveDown || pending}
                  aria-label="뒤로 이동"
                  title="뒤로 이동"
                  style={miniBtnStyle(!canMoveDown || pending)}
                >
                  <ChevronRightIcon />
                </button>
                <button
                  type="button"
                  onClick={() => moveToFront(idx)}
                  disabled={isFeatured || pending}
                  aria-label="대표로 설정"
                  title="대표로 설정"
                  style={{
                    ...miniBtnStyle(isFeatured || pending),
                    flex: 1,
                    fontSize: 11.5,
                    fontWeight: 500,
                    gap: 3,
                  }}
                >
                  <StarIcon />
                  대표로
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function miniBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    height: 28,
    width: 28,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--border)',
    background: disabled ? 'var(--surface-muted)' : 'var(--surface)',
    color: disabled ? 'var(--foreground-subtle)' : 'var(--foreground)',
    borderRadius: 6,
    cursor: disabled ? 'not-allowed' : 'pointer',
    padding: 0,
  };
}

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
