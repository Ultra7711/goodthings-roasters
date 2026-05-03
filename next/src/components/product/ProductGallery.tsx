/* ══════════════════════════════════════════
   ProductGallery — yet-another-react-lightbox 기반 (S134)
   ──────────────────────────────────────────
   - Inline plugin: 메인 이미지 영역을 라이트박스 인라인으로 렌더 (모달 X)
   - Thumbnails plugin: 이미지 ≥ 2장일 때만 하단 스트립 (드래그/스와이프 빌트인)
   - render.slide / render.thumbnail: ProductImage.bg 그라데이션 + src contain 합성 보존
   - status floating 뱃지: 좌상단 absolute (Lightbox 외부 wrapper 자식)
   ══════════════════════════════════════════ */

'use client';

import { type CSSProperties, useEffect, useState } from 'react';
import Lightbox, { type SlideImage } from 'yet-another-react-lightbox';
import Inline from 'yet-another-react-lightbox/plugins/inline';
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/thumbnails.css';
import type { ProductImage, ProductStatus } from '@/lib/products';
import { getStatusBadgeClass } from '@/lib/products';

type Props = {
  images: ProductImage[];
  /** 상품 status — 좌상단 floating 뱃지 표시 (Shop 카드와 동일 위치) */
  status?: ProductStatus;
};

/** yarl SlideImage 에 ProductImage 메타데이터 attach — render.slide / render.thumbnail 에서 사용 */
type GallerySlide = SlideImage & { _img: ProductImage };

/** 이미지 한 장을 background 쇼트핸드로 변환 — bg 그라데이션 + src contain 합성 */
function imageBg(img: ProductImage): string {
  return img.src
    ? `${img.bg} url('${img.src}') center/contain no-repeat`
    : img.bg;
}

export default function ProductGallery({ images, status }: Props) {
  const [idx, setIdx] = useState(0);

  /* 상품 변경 시 인덱스 리셋 */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setIdx(0);
  }, [images]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* 이미지가 없을 때 빈 배경 */
  if (images.length === 0) {
    return (
      <div id="pd-img-main-wrap" className="pd-yarl-wrap no-nav">
        {status && <span className={getStatusBadgeClass(status)}>{status}</span>}
        <div id="pd-img" style={{ background: '#f0ece6' }} />
      </div>
    );
  }

  /* yarl 슬라이드 객체 — _img 메타데이터로 ProductImage 보존 */
  const slides: GallerySlide[] = images.map((img, i) => ({
    src: img.src || `pd-slide-${i}`,
    _img: img,
  }));

  const multi = images.length > 1;
  const showThumbnails = images.length >= 2;
  const plugins = showThumbnails ? [Inline, Thumbnails] : [Inline];

  /* 현재 슬라이드 bgTheme 기준 화살표 색상 */
  const current = images[idx] ?? images[0];
  const themeClass = current.bgTheme === 'dark' ? 'pd-yarl--dark' : 'pd-yarl--light';
  const thumbsClass = showThumbnails ? ' pd-yarl--with-thumbs' : '';

  /* LightboxRoot size — 공식 docs 권고 패턴: inline.style 에 직접 부여.
     1장: aspect-ratio 1/1 (정사각형).
     2장+: 메인 1:1 (=100cqw) + 썸네일 트랙 (96px). 부모 .pd-yarl-wrap 의
     container-type: inline-size 가 100cqw 를 활성화. */
  const inlineStyle: CSSProperties = showThumbnails
    ? { width: '100%', height: 'calc(100cqw + var(--pd-yarl-thumbs-h, 96px))' }
    : { width: '100%', aspectRatio: '1 / 1' };

  return (
    <div
      id="pd-img-main-wrap"
      className={`pd-yarl-wrap ${themeClass}${thumbsClass}${multi ? '' : ' no-nav'}`}
    >
      {status && <span className={getStatusBadgeClass(status)}>{status}</span>}
      <Lightbox
        open
        close={() => undefined}
        index={idx}
        slides={slides}
        plugins={plugins}
        on={{ view: ({ index }) => setIdx(index) }}
        carousel={{ finite: true, padding: 0, spacing: 0 }}
        animation={{ swipe: 250, fade: 0 }}
        controller={{ closeOnBackdropClick: false }}
        inline={{ className: 'pd-yarl-inline', style: inlineStyle }}
        thumbnails={
          showThumbnails
            ? {
                position: 'bottom',
                width: 80,
                height: 80,
                gap: 8,
                border: 0,
                borderRadius: 4,
                padding: 0,
                vignette: false,
                imageFit: 'contain',
              }
            : undefined
        }
        render={{
          slide: ({ slide }) => {
            const s = slide as GallerySlide;
            return <div className="pd-yarl-slide-bg" style={{ background: imageBg(s._img) }} />;
          },
          thumbnail: ({ slide }) => {
            const s = slide as GallerySlide;
            return <div className="pd-yarl-thumb-bg" style={{ background: imageBg(s._img) }} />;
          },
          /* 1장일 때 화살표 숨김 — null 반환은 컴포넌트 미렌더 */
          buttonPrev: multi ? undefined : () => null,
          buttonNext: multi ? undefined : () => null,
          /* 화살표 SVG — 굿데이즈 라이트박스와 동일 사양 (48×48 / strokeWidth 1.25).
             PDP 색상(bgTheme 동적)·hover-only·모바일 숨김은 CSS 에서 처리. */
          iconPrev: () => (
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          ),
          iconNext: () => (
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          ),
        }}
      />
    </div>
  );
}
