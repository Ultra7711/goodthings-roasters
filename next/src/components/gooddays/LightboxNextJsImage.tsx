/* ══════════════════════════════════════════
   yet-another-react-lightbox 의 slide render 컴포넌트 (S121).
   Custom NextJsImage — fill 모드 + placeholder=blur + sizes 명시.
   라이브러리 docs 의 Next.js example 패턴 동일.
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

export default function LightboxNextJsImage({ slide, offset, rect }: RenderSlideProps) {
  const {
    on: { click },
    carousel: { imageFit },
  } = useLightboxProps();
  const { currentIndex } = useLightboxState();

  if (!isImageSlide(slide)) return undefined;

  const cover = isImageFitCover(slide, imageFit);
  const width = rect.width;
  const height = rect.height;
  const gdSlide = slide as GdSlide;

  return (
    <div style={{ position: 'relative', width, height }}>
      <Image
        fill
        alt={typeof slide.alt === 'string' ? slide.alt : ''}
        src={slide.src}
        loading="eager"
        draggable={false}
        placeholder={gdSlide.blurDataURL ? 'blur' : 'empty'}
        blurDataURL={gdSlide.blurDataURL}
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
