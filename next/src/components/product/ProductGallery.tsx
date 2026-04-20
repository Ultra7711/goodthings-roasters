/* ══════════════════════════════════════════
   ProductGallery — RP-4b
   ──────────────────────────────────────────
   - 메인 이미지: 좌우 화살표(데스크탑 호버), disabled 경계 처리
   - 페이지네이션 도트: 메인 페이지 .beans-dot 스펙, 다중 이미지일 때만 노출
   - 모바일: 화살표 숨김 + 스와이프 제스처
   - 이미지 bgTheme 에 따라 arrow-btn-light / arrow-btn-dark 전환
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef, useState } from 'react';
import type { ProductImage } from '@/lib/products';

type Props = { images: ProductImage[] };

/** 이미지 한 장을 background 쇼트핸드로 변환 */
function imageBg(img: ProductImage): string {
  return img.src
    ? `${img.bg} url('${img.src}') center/contain no-repeat`
    : img.bg;
}

export default function ProductGallery({ images }: Props) {
  const [idx, setIdx] = useState(0);

  const multi = images.length > 1;
  const current = images[idx];

  /* 이미지 배열이 바뀌면 인덱스 리셋 (다른 상품으로 라우트 이동 시)
     prop 기반 내부 state 초기화 의도의 setState-in-effect. */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIdx(0);
  }, [images]);

  function goPrev() { if (idx > 0) setIdx(idx - 1); }
  function goNext() { if (idx < images.length - 1) setIdx(idx + 1); }

  /* 모바일 스와이프 — 수평 드래그 40px 이상 시 인덱스 이동 */
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current == null || touchStartY.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) goNext();
    else goPrev();
  }

  /* 이미지가 없을 때 대비: 빈 배경만 표시 */
  if (!current) {
    return (
      <div id="pd-img-main-wrap" className="no-nav">
        <div id="pd-img" style={{ background: '#f0ece6' }} />
      </div>
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
        <div
          id="pd-img"
          style={{ background: imageBg(current) }}
          onTouchStart={multi ? onTouchStart : undefined}
          onTouchEnd={multi ? onTouchEnd : undefined}
        />
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

      {multi && (
        <div id="pd-pagination" className="pd-dots" aria-label="이미지 페이지네이션">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`pd-dot${i === idx ? ' active' : ''}`}
              aria-label={`이미지 ${i + 1}`}
              aria-current={i === idx}
              onClick={() => setIdx(i)}
            />
          ))}
        </div>
      )}
    </>
  );
}
