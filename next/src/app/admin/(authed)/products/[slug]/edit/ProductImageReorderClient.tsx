'use client';

/* ══════════════════════════════════════════════════════════════════════════
   ProductImageReorderClient — 이미지 갤러리 업로드 + reorder + 삭제 UI

   책임 (S218 + S231-3):
   - 이미지 카드 grid (sort_order asc)
   - 1번 = ★ 대표 배지 (카트/결제/카드에 노출됨)
   - 각 카드 [↑] [↓] 버튼 + "대표로" 버튼 (= 맨 앞 이동)
   - 각 카드 [삭제] 버튼 (Storage + DB hard delete · S231-3)
   - 업로드 dropzone (file input · 5MB 제한 · plaiceholder 자동 · S231-3)
   - 변경 시 즉시 action 호출 + sonner toast (optimistic UI · 실패 시 rollback)

   GoodDays admin 답습 (uploadGoodDaysImageAction 패턴).
   ══════════════════════════════════════════════════════════════════════════ */

import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/admin/ui/button';
import { Switch } from '@/components/admin/ui/switch';
import ConfirmModal from '@/components/admin/ConfirmModal';
import {
  deleteProductImageAction,
  reorderProductImagesAction,
  updateProductImageActiveAction,
  uploadProductImageAction,
} from '../../actions';
import { cn } from '@/lib/utils';

type ImageItem = {
  id: string;
  src: string;
  blurDataUrl: string | null;
  isActive: boolean;
};

type Props = {
  productId: string;
  productSlug: string;
  initialImages: ImageItem[];
};

export default function ProductImageReorderClient({
  productId,
  productSlug,
  initialImages,
}: Props) {
  const [images, setImages] = useState(initialImages);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteTargetIdx, setDeleteTargetIdx] = useState<number | null>(null);

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

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.set('productId', productId);
      formData.set('slug', productSlug);
      formData.set('file', file);

      const result = await uploadProductImageAction(formData);
      if (!result.ok) {
        const msg =
          result.error === 'unauthorized'
            ? '권한이 없습니다. 다시 로그인해주세요.'
            : result.error === 'invalid_image'
              ? '이미지 파일을 읽을 수 없습니다.'
              : result.error === 'validation_failed'
                ? result.detail === 'file_too_large'
                  ? '파일 크기는 5MB 이하만 가능합니다.'
                  : `입력값이 올바르지 않습니다. (${result.detail ?? ''})`
                : '업로드 중 오류가 발생했습니다.';
        toast.error(`${file.name} — ${msg}`);
        continue;
      }
      toast.success(`${file.name} 업로드 완료`);
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';

    /* 서버 revalidate 후 page refresh 가 필요 — 새 row 가 state 에 없음.
       window.location.reload 보다 깔끔한 방법: router.refresh 답습. */
    if (typeof window !== 'undefined') window.location.reload();
  }

  function handleToggleActive(idx: number) {
    const img = images[idx];
    if (!img) return;
    const next = images.map((it, i) =>
      i === idx ? { ...it, isActive: !it.isActive } : it,
    );
    const prev = images;
    setImages(next);

    startTransition(async () => {
      const result = await updateProductImageActiveAction({
        imageId: img.id,
        isActive: !img.isActive,
      });
      if (!result.ok) {
        setImages(prev);
        const msg =
          result.error === 'unauthorized'
            ? '권한이 없습니다. 다시 로그인해주세요.'
            : result.error === 'not_found'
              ? '이미지를 찾을 수 없습니다.'
              : '처리 중 오류가 발생했습니다.';
        toast.error(msg);
        return;
      }
      toast.success(
        !img.isActive ? '이미지를 공개했습니다' : '이미지를 비공개로 전환했습니다',
      );
    });
  }

  function handleDeleteConfirm() {
    if (deleteTargetIdx === null) return;
    const idx = deleteTargetIdx;
    const img = images[idx];
    if (!img) {
      setDeleteTargetIdx(null);
      return;
    }
    const prev = images;
    const next = images.filter((_, i) => i !== idx);
    setImages(next);

    startTransition(async () => {
      const result = await deleteProductImageAction({ imageId: img.id });
      if (!result.ok) {
        setImages(prev);
        const msg =
          result.error === 'unauthorized'
            ? '권한이 없습니다. 다시 로그인해주세요.'
            : result.error === 'not_found'
              ? '이미지를 찾을 수 없습니다.'
              : '삭제 중 오류가 발생했습니다.';
        toast.error(msg);
        setDeleteTargetIdx(null);
        return;
      }
      toast.success('이미지가 삭제되었습니다');
      setDeleteTargetIdx(null);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 업로드 dropzone */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="!h-8"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || pending}
        >
          <Upload size={14} />
          {uploading ? '업로드 중…' : '이미지 추가'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/webp,image/avif,image/jpeg,image/png"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
        <span className="text-xs text-muted-foreground">
          5MB 이하 · webp 권장 · 다중 선택 가능
        </span>
      </div>

      {images.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-muted-foreground bg-muted rounded-md border border-dashed border-border">
          아직 등록된 이미지가 없습니다. 위 버튼으로 업로드해주세요.
        </div>
      ) : (
        <div
          className={cn(
            'grid gap-3 transition-opacity duration-150 ease',
            pending || uploading ? 'opacity-70' : 'opacity-100',
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
                  isFeatured
                    ? 'border-2 border-[var(--primary)]'
                    : 'border border-border',
                  !img.isActive && 'opacity-70',
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
                  {/* 비공개 배지 (안전장치 · 050) */}
                  {!img.isActive && (
                    <span
                      className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--neutral-soft)] text-[var(--neutral-soft-fg)] text-xs font-semibold"
                      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.18)' }}
                    >
                      비공개
                    </span>
                  )}
                  {/* 순서 표시 */}
                  <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-black/55 !text-white text-xs font-semibold tabular-nums">
                    {idx + 1}
                  </span>
                </div>

                {/* 액션 영역 */}
                <div className="p-2.5 flex flex-col gap-2.5">
                  {/* 이동 버튼 — 좌 / 대표로 / 우 (높이 28px 통일) */}
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="!size-7"
                      onClick={() => moveUp(idx)}
                      disabled={!canMoveUp || pending || uploading}
                      aria-label="앞으로 이동"
                      title="앞으로 이동"
                    >
                      <ChevronLeftIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => moveToFront(idx)}
                      disabled={isFeatured || pending || uploading}
                      aria-label="대표로 설정"
                      title="대표로 설정"
                      className="flex-1 !h-7"
                    >
                      <StarIcon />
                      대표로
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="!size-7"
                      onClick={() => moveDown(idx)}
                      disabled={!canMoveDown || pending || uploading}
                      aria-label="뒤로 이동"
                      title="뒤로 이동"
                    >
                      <ChevronRightIcon />
                    </Button>
                  </div>
                  {/* 공개/비공개 토글 + 삭제 (안전장치 · 050) — 한 줄 배치 · 텍스트 크기 통일 */}
                  <div className="flex items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                      <Switch
                        checked={img.isActive}
                        onCheckedChange={() => handleToggleActive(idx)}
                        disabled={pending || uploading}
                        aria-label={img.isActive ? '비공개로 전환' : '공개로 전환'}
                        className="data-[state=unchecked]:bg-[var(--switch-off-bg)]"
                      />
                      <span className="text-muted-foreground">
                        {img.isActive ? '공개' : '비공개'}
                      </span>
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="!h-7 !text-[var(--danger)] hover:!bg-[var(--danger-soft)] !text-xs !px-2"
                      onClick={() => setDeleteTargetIdx(idx)}
                      disabled={pending || uploading}
                      aria-label="이미지 삭제"
                    >
                      <Trash2 size={14} />
                      삭제
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={deleteTargetIdx !== null}
        variant="danger"
        title="이미지를 삭제하시겠습니까?"
        description="이 이미지는 영원히 사라지며, 되돌릴 수 없습니다."
        confirmLabel="삭제"
        pending={pending}
        onCancel={() => setDeleteTargetIdx(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
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
