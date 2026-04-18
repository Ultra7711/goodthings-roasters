/* ══════════════════════════════════════════
   ProductGallery — RP-4b
   ──────────────────────────────────────────
   프로토타입 renderPdGallery(images) 이식.
   - 메인 이미지: 좌우 화살표(호버 시 표시), disabled 경계 처리
   - 썸네일 스트립: 다중 이미지일 때만 노출, active 경계
   - 썸네일 오버플로 시 스크롤 화살표 노출 (PC hover only)
   - 이미지 bgTheme 에 따라 arrow-btn-light / arrow-btn-dark 전환
   ══════════════════════════════════════════ */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProductImage } from '@/lib/products';

const THUMB_SCROLL_STEP = 160;

type Props = { images: ProductImage[] };

/** 이미지 한 장을 background 쇼트핸드로 변환 */
function imageBg(img: ProductImage): string {
  return img.src
    ? `${img.bg} url('${img.src}') center/contain no-repeat`
    : img.bg;
}

export default function ProductGallery({ images }: Props) {
  const [idx, setIdx] = useState(0);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const [thumbOverflow, setThumbOverflow] = useState(false);
  const [thumbAtStart, setThumbAtStart] = useState(true);
  const [thumbAtEnd, setThumbAtEnd] = useState(false);

  const multi = images.length > 1;
  const current = images[idx];

  /* 이미지 배열이 바뀌면 인덱스 리셋 (다른 상품으로 라우트 이동 시)
     prop 기반 내부 state 초기화 의도의 setState-in-effect. */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIdx(0);
  }, [images]);

  /* 썸네일 스크롤 상태 업데이트 — 초기/스크롤/리사이즈 시 호출 */
  const updateThumbScroll = useCallback(() => {
    const el = thumbsRef.current;
    if (!el) return;
    const overflow = el.scrollWidth > el.clientWidth + 1;
    setThumbOverflow(overflow);
    setThumbAtStart(el.scrollLeft <= 0);
    setThumbAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    updateThumbScroll();
    const el = thumbsRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateThumbScroll, { passive: true });
    window.addEventListener('resize', updateThumbScroll);
    return () => {
      el.removeEventListener('scroll', updateThumbScroll);
      window.removeEventListener('resize', updateThumbScroll);
    };
  }, [updateThumbScroll, images]);

  function goPrev() { if (idx > 0) setIdx(idx - 1); }
  function goNext() { if (idx < images.length - 1) setIdx(idx + 1); }

  function scrollThumbs(dir: -1 | 1) {
    thumbsRef.current?.scrollBy({ left: dir * THUMB_SCROLL_STEP, behavior: 'smooth' });
  }

  /* 이미지가 없을 때 대비: 빈 배경만 표시 */
  if (!current) {
    return (
      <>
        <div id="pd-img-main-wrap" className="no-nav">
          <div id="pd-img" style={{ background: '#f0ece6' }} />
        </div>
        <div id="pd-img-bottom">
          <div id="pd-thumbs-wrap">
            <div id="pd-thumbs" ref={thumbsRef} />
          </div>
        </div>
      </>
    );
  }

  /* 화살표 색상 테마 — 메인 이미지의 bgTheme 기준 */
  const arrowColorClass =
    current.bgTheme === 'dark' ? 'arrow-btn-dark' : 'arrow-btn-light';

  return (
    <>
      <div id="pd-img-main-wrap" className={multi ? '' : 'no-nav'}>
        <button
          className={`pd-img-arrow arrow-btn arrow-btn-primary ${arrowColorClass}${multi ? '' : ' hidden'}`}
          id="pd-img-prev"
          type="button"
          aria-label="이전"
          disabled={idx === 0}
          onClick={goPrev}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div id="pd-img" style={{ background: imageBg(current) }} />
        <button
          className={`pd-img-arrow arrow-btn arrow-btn-primary ${arrowColorClass}${multi ? '' : ' hidden'}`}
          id="pd-img-next"
          type="button"
          aria-label="다음"
          disabled={idx === images.length - 1}
          onClick={goNext}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      <div id="pd-img-bottom">
        <div id="pd-thumbs-wrap" className={multi ? '' : 'no-nav'}>
          {/* 썸네일 오버플로 스크롤 화살표 — PC hover 시에만 표시 (CSS media query 제어) */}
          <button
            id="pd-thumb-prev"
            className={`pd-thumb-arrow arrow-btn arrow-btn-secondary arrow-btn-light${thumbOverflow ? '' : ' hidden'}`}
            type="button"
            aria-label="이전"
            disabled={thumbAtStart}
            onClick={() => scrollThumbs(-1)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div id="pd-thumbs" ref={thumbsRef}>
            {multi &&
              images.map((img, i) => (
                <div
                  key={i}
                  className={`pd-thumb${i === idx ? ' active' : ''}`}
                  style={{ background: imageBg(img) }}
                  onClick={() => setIdx(i)}
                  role="button"
                  tabIndex={0}
                  aria-label={`이미지 ${i + 1}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setIdx(i);
                    }
                  }}
                />
              ))}
          </div>
          <button
            id="pd-thumb-next"
            className={`pd-thumb-arrow arrow-btn arrow-btn-secondary arrow-btn-light${thumbOverflow ? '' : ' hidden'}`}
            type="button"
            aria-label="다음"
            disabled={thumbAtEnd}
            onClick={() => scrollThumbs(1)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
