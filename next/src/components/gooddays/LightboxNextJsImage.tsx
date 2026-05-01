/* ══════════════════════════════════════════
   yet-another-react-lightbox 의 slide render 컴포넌트 (S121).
   라이브러리 docs 의 Next.js example 패턴 동일 — fill + width/height 기반 contain 계산.
   slide.width/height 가 있으면 isNextJsImage 로 검증 → Zoom plugin 활성화 (필수 조건).
   ══════════════════════════════════════════ */

'use client';

import Image from 'next/image';
import {
  isImageFitCover,
  isImageSlide,
  useLightboxProps,
  useLightboxState,
  type RenderSlideProps,
  type SlideImage,
} from 'yet-another-react-lightbox';

type GdSlide = SlideImage & {
  blurDataURL?: string;
};

function isNextJsImage(slide: SlideImage): slide is GdSlide & { width: number; height: number } {
  return (
    isImageSlide(slide) &&
    typeof slide.width === 'number' &&
    typeof slide.height === 'number'
  );
}

export default function LightboxNextJsImage({ slide, offset, rect }: RenderSlideProps) {
  const {
    on: { click },
    carousel: { imageFit },
  } = useLightboxProps();
  const { currentIndex } = useLightboxState();

  if (!isNextJsImage(slide)) return undefined;

  const cover = isImageFitCover(slide, imageFit);
  const width = !cover
    ? Math.round(
        Math.min(rect.width, (rect.height / slide.height) * slide.width),
      )
    : rect.width;
  const height = !cover
    ? Math.round(
        Math.min(rect.height, (rect.width / slide.width) * slide.height),
      )
    : rect.height;

  return (
    <div style={{ position: 'relative', width, height }}>
      <Image
        fill
        alt={typeof slide.alt === 'string' ? slide.alt : ''}
        src={slide.src}
        loading="eager"
        draggable={false}
        placeholder={slide.blurDataURL ? 'blur' : 'empty'}
        blurDataURL={slide.blurDataURL}
        style={{
          objectFit: cover ? 'cover' : 'contain',
          cursor: click ? 'pointer' : undefined,
        }}
        sizes={
          typeof window !== 'undefined'
            ? `${Math.ceil((width / window.innerWidth) * 100)}vw`
            : '100vw'
        }
        onClick={
          offset === 0 ? () => click?.({ index: currentIndex }) : undefined
        }
      />
    </div>
  );
}
