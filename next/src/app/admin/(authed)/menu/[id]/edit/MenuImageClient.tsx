'use client';

/* ══════════════════════════════════════════════════════════════════════════
   MenuImageClient — /admin/menu/[id]/edit 단일 이미지 업로드/교체 (S244)

   책임:
   - 현재 이미지 미리보기 (LQIP blur fallback)
   - file input 으로 새 이미지 업로드 → uploadCafeMenuImageAction 호출
   - 이전 이미지는 server action 내부에서 Storage cleanup

   답습:
   - products ProductImageReorderClient (단순화 — 1장 + reorder 제거)

   carry-over:
   - 운영자가 bg 색상 별도 편집 (현재는 이미지 dominant color 자동 갱신)
   ══════════════════════════════════════════════════════════════════════════ */

import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Button } from '@/components/admin/ui/button';
import { uploadCafeMenuImageAction } from '../../actions';

type Props = {
  menuId: string;
  initialImage: {
    src: string | null;
    blurDataUrl: string | null;
    width: number | null;
    height: number | null;
  };
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = ['image/webp', 'image/avif', 'image/jpeg', 'image/png'];

export default function MenuImageClient({ menuId, initialImage }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [image, setImage] = useState(initialImage);

  function handlePick() {
    fileInputRef.current?.click();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 다시 선택 허용
    if (!file) return;

    if (!ALLOWED_MIME.includes(file.type)) {
      toast.error(`이미지 형식 ${file.type || 'unknown'} 는 지원하지 않습니다 (webp/avif/jpeg/png)`);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error(`파일 크기 ${(file.size / 1024 / 1024).toFixed(1)}MB · 최대 5MB`);
      return;
    }

    const formData = new FormData();
    formData.append('id', menuId);
    formData.append('file', file);

    startTransition(async () => {
      const result = await uploadCafeMenuImageAction(formData);
      if (!result.ok) {
        const msg =
          result.error === 'unauthorized'
            ? '권한이 없습니다. 다시 로그인해 주세요.'
            : result.error === 'invalid_image'
              ? '이미지 처리에 실패했습니다. 다른 파일을 시도해 주세요.'
              : result.error === 'validation_failed'
                ? `입력값을 확인해 주세요. (${result.detail ?? ''})`
                : '처리 중 오류가 발생했습니다.';
        toast.error(msg);
        return;
      }
      toast.success('이미지를 교체했습니다');
      setImage({
        src: result.imgSrc,
        blurDataUrl: result.blurDataUrl,
        width: result.width,
        height: result.height,
      });
    });
  }

  return (
    <div>
      <div className="flex items-start gap-5 flex-wrap">
        <div
          className="relative w-40 h-40 rounded-md border border-border overflow-hidden flex-shrink-0"
          style={{
            background:
              'repeating-linear-gradient(135deg, var(--placeholder-pattern-1) 0 6px, var(--placeholder-pattern-2) 6px 12px)',
          }}
        >
          {image.src ? (
            <Image
              src={image.src}
              alt=""
              fill
              sizes="160px"
              style={{ objectFit: 'cover' }}
              placeholder={image.blurDataUrl ? 'blur' : 'empty'}
              blurDataURL={image.blurDataUrl ?? undefined}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-[var(--foreground-subtle)]">
              이미지 없음
            </div>
          )}
        </div>

        <div className="flex-1 min-w-[200px]">
          <div className="text-xs text-muted-foreground leading-relaxed mb-3">
            웹페이지 메뉴 카드 · 영양 시트에 사용되는 단일 이미지입니다.
            업로드 시 자동으로 WebP 변환 + 1600px 리사이즈 + LQIP 블러 + 카드 배경 색상 추출이 진행됩니다.
          </div>
          {image.width && image.height && (
            <div className="text-xs text-[var(--foreground-subtle)] gtr-mono mb-3">
              {image.width} × {image.height}px
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_MIME.join(',')}
            onChange={handleChange}
            className="hidden"
            disabled={pending}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePick}
            disabled={pending}
          >
            {pending ? '업로드 중…' : image.src ? '이미지 교체' : '이미지 업로드'}
          </Button>
        </div>
      </div>
    </div>
  );
}
