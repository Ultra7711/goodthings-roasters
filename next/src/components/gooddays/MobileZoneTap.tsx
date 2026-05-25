/* ══════════════════════════════════════════
   Mobile zone tap + 피드백 fade (S121).
   yet-another-react-lightbox 의 render.controls 안에 절대위치 div.
   useController hook 으로 prev/next 호출.
   ══════════════════════════════════════════ */

'use client';

import { useCallback, useRef, useState } from 'react';
import { useController } from 'yet-another-react-lightbox';

type Props = {
  isMobile: boolean;
  /** 줌 인 상태에서는 zone 자체 unmount — 라이브러리의 핀치 인식이 image area 에서 발화하므로
      zone 이 z-index 로 image 위에 있으면 핀치 인식 방해. zoom>1 시 zone 제거 → 핀치 정상. */
  isZoomed: boolean;
};

export default function MobileZoneTap({ isMobile, isZoomed }: Props) {
  const { prev, next } = useController();
  const [flashDir, setFlashDir] = useState<'prev' | 'next' | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((dir: 'prev' | 'next') => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlashDir(dir);
    flashTimerRef.current = setTimeout(() => {
      setFlashDir(null);
      flashTimerRef.current = null;
    }, 600);
  }, []);

  if (!isMobile || isZoomed) return null;

  return (
    <>
      <div
        className="gd-tap-zone gd-tap-zone--prev"
        aria-hidden="true"
        onClick={() => {
          flash('prev');
          prev();
        }}
      />
      <div
        className="gd-tap-zone gd-tap-zone--next"
        aria-hidden="true"
        onClick={() => {
          flash('next');
          next();
        }}
      />
      {/* key 로 동일 dir 연타 시에도 animation 재시작 — ref 의도적 render 접근. */}
      {flashDir && (
        <div
          // eslint-disable-next-line react-hooks/refs
          key={`${flashDir}-${flashTimerRef.current}`}
          className={`gd-tap-flash gd-tap-flash--${flashDir}`}
          aria-hidden="true"
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {flashDir === 'prev' ? (
              <polyline points="15 18 9 12 15 6" />
            ) : (
              <polyline points="9 18 15 12 9 6" />
            )}
          </svg>
        </div>
      )}
    </>
  );
}
