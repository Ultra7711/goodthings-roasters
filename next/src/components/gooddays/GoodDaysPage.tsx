/* ══════════════════════════════════════════
   GoodDaysPage — /gooddays

   설계 결정 (S121, 2026-05-01):
   1. gd-* 격리
      - gd-grid / gd-row--{a..e} / gd-cell 클래스 그대로 사용.

   2. 매거진 그리드
      - lib/gooddays.ts 의 buildGoodDaysGrid() 가 순수 함수로 rows + ordered 반환.

   3. 등장 연출
      - 타이틀: mount 후 next frame 에 gd-anim 클래스 add → CSS transition 재생.
      - 셀: IntersectionObserver 로 gd-visible 부여. 같은 row 내 인덱스로 70ms stagger.

   4. 라이트박스 — yet-another-react-lightbox 기반 (S121 라이브러리 컨버전)
      - swipe carousel (peek), 핀치 줌 (bounce), 더블탭, 키보드, body overflow,
        portal 모두 라이브러리 표준 구현. 직접 구현된 제스처/3-slide track/state machine 폐기.
      - 슬라이드 render 는 NextJsImage(custom) — fill 모드 + placeholder=blur 지원.
      - 배경 솔리드 웜블랙: --yarl__color_backdrop 토큰 매핑.
      - ?img= URL 진입 시 useState 초기값 + lastHandledImgSrcRef 로 첫 paint 라이트박스 open.
   ══════════════════════════════════════════ */

'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Lightbox, { type SlideImage } from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import { buildGoodDaysGrid } from '@/lib/gooddays';
import LightboxNextJsImage from './LightboxNextJsImage';

type GdSlide = SlideImage & { blurDataURL?: string };

export default function GoodDaysPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  /* 그리드 데이터는 렌더링 순수 함수 — useMemo 로 한 번만 계산 */
  const grid = useMemo(() => buildGoodDaysGrid(), []);
  const { rows, ordered } = grid;

  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const ioRef = useRef<IntersectionObserver | null>(null);

  /* 라이트박스용 슬라이드 — ordered 순서. blurDataURL 도 함께 전달. */
  const slides = useMemo<GdSlide[]>(
    () =>
      ordered.map((item) => ({
        src: item.src,
        blurDataURL: item.blurDataURL,
        alt: '',
      })),
    [ordered],
  );

  /* ?img= URL 진입 시 첫 paint 부터 라이트박스 open — 화이트 flash 차단.
     useState 초기값 함수에서 동기 결정. useEffect 처리는 Activity 복귀 등 후속 케이스. */
  const initialImgSrc = useMemo(
    () => searchParams.get('img'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const initialIdx = useMemo(
    () => {
      if (!initialImgSrc) return -1;
      return ordered.findIndex((item) => item.src === initialImgSrc);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [lbOpen, setLbOpen] = useState(initialIdx >= 0);
  const [lbIndex, setLbIndex] = useState(initialIdx >= 0 ? initialIdx : 0);

  /* ?img= 변경 동기화 — 같은 src 가 두 번 처리되지 않도록 ref 가드.
     useState 초기값으로 이미 set 됐으면 첫 useEffect 에서 스킵. */
  const lastHandledImgSrcRef = useRef<string | null>(initialImgSrc);

  /* 셀 gd-visible 제거 + IO 재설정 — 이벤트 핸들러에서 직접 호출 (동기).
     gtr:route-change 는 NVG useLayoutEffect 내 동기 발송 → 이 함수가 실행 완료된 후
     data-transitioning 이 제거되므로, 셀이 opacity:0 상태로 콘텐츠가 노출됨 → 플래시 없음. */
  const setupCells = useCallback(() => {
    const gridEl = gridRef.current;
    if (!gridEl) return;
    if (ioRef.current) {
      ioRef.current.disconnect();
      ioRef.current = null;
    }
    const cells = Array.from(
      gridEl.querySelectorAll<HTMLElement>('.gd-cell:not(.gd-cell--placeholder)'),
    );
    cells.forEach((c) => {
      c.classList.remove('gd-visible');
      c.style.animationDelay = '';
    });
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const cell = entry.target as HTMLElement;
          const row = cell.parentElement;
          if (!row) return;
          const siblings = Array.from(row.children).filter(
            (c) => !c.classList.contains('gd-cell--placeholder'),
          );
          const idx = siblings.indexOf(cell);
          cell.style.animationDelay = `${idx * 70}ms`;
          cell.classList.add('gd-visible');
          io.unobserve(cell);
        });
      },
      { threshold: 0.15 },
    );
    ioRef.current = io;
    cells.forEach((c) => io.observe(c));
  }, []);

  /* 타이틀 gd-anim 클래스 DOM 직접 토글 (동기, reflow 강제).
     Shop/Menu 의 sp-anim/cm-anim 토글과 동일 패턴. */
  const triggerTitleAnim = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    root.classList.remove('gd-anim');
    void root.offsetHeight;
    root.classList.add('gd-anim');
  }, []);

  /* 초기 마운트 — 직접 진입 시 타이틀 연출 + 셀 IO 설정 */
  useEffect(() => {
    if (window.location.pathname === '/gooddays') triggerTitleAnim();
    setupCells();
    return () => {
      ioRef.current?.disconnect();
      ioRef.current = null;
    };
    // setupCells/triggerTitleAnim 은 stable callback ([] deps) — mount 1회만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* same-page reentry — SiteHeader Good Days 링크 재클릭 시 발송. */
  useEffect(() => {
    function onReset() {
      window.scrollTo({ top: 0, behavior: 'instant' });
      setupCells();
      triggerTitleAnim();
    }
    window.addEventListener('gtr:gooddays-reset', onReset);
    return () => window.removeEventListener('gtr:gooddays-reset', onReset);
  }, [setupCells, triggerTitleAnim]);

  /* route-change (다른 페이지 → /gooddays 복귀) — NVG useLayoutEffect 내 동기 발송.
     setupCells/triggerTitleAnim 을 핸들러에서 직접 호출 →
     data-transitioning 제거 전에 셀 opacity:0 도달 → 플래시 없음. */
  useEffect(() => {
    function onRouteChange(e: Event) {
      if ((e as CustomEvent<string>).detail !== '/gooddays') return;
      setupCells();
      triggerTitleAnim();
    }
    window.addEventListener('gtr:route-change', onRouteChange);
    return () => window.removeEventListener('gtr:route-change', onRouteChange);
  }, [setupCells, triggerTitleAnim]);

  /* ?img= URL 변경 → 라이트박스 동기화 (Activity 복귀 / 메인에서 다른 src 진입).
     useState 초기값으로 이미 처리된 src 는 ref 가드로 스킵 → 무한 루프 방지. */
  useEffect(() => {
    const imgSrc = searchParams.get('img');
    if (!imgSrc) {
      lastHandledImgSrcRef.current = null;
      return;
    }
    if (lastHandledImgSrcRef.current === imgSrc) return;
    if (ordered.length === 0) return;
    const idx = ordered.findIndex((item) => item.src === imgSrc);
    if (idx < 0) return;
    lastHandledImgSrcRef.current = imgSrc;
    setLbIndex(idx);
    setLbOpen(true);
  }, [searchParams, ordered]);

  /* 갤러리 셀 click — 라이트박스 open */
  const openLightbox = useCallback((idx: number) => {
    setLbIndex(idx);
    setLbOpen(true);
  }, []);

  /* 라이트박스 close — ?img= URL 정리 + ref 리셋 */
  const handleClose = useCallback(() => {
    setLbOpen(false);
    lastHandledImgSrcRef.current = null;
    if (searchParams.get('img')) {
      router.replace('/gooddays', { scroll: false });
    }
  }, [router, searchParams]);

  return (
    <div
      id="gd-page"
      ref={rootRef}
      data-header-theme="light"
    >
      <div id="gd-inner">
        <div className="page-title-area">
          <h1 id="gd-title" className="page-title">좋은 순간들</h1>
          <p className="page-subtitle">매장에서 보내는 하루하루를 기록합니다.</p>
        </div>
        <div className="gd-grid" id="gd-grid" ref={gridRef}>
          {rows.map((row, rIdx) => (
            <div key={`${row.pattern.cls}-${rIdx}`} className={`gd-row ${row.pattern.cls}`}>
              {row.cells.map((cell, cIdx) => {
                const spanCls = cell.span ? 'gd-cell--span' : '';
                if (cell.kind === 'image') {
                  return (
                    <div
                      key={`img-${cell.orderedIdx}`}
                      className={`gd-cell ${spanCls}`.trim()}
                      data-gd-idx={cell.orderedIdx}
                      onClick={() => openLightbox(cell.orderedIdx)}
                    >
                      <Image
                        src={cell.src}
                        alt={`갤러리 이미지 ${cell.orderedIdx + 1}`}
                        fill
                        sizes="(max-width: 767px) 50vw, (max-width: 1440px) 50vw, 720px"
                        placeholder="blur"
                        blurDataURL={cell.blurDataURL}
                        priority={rIdx === 0}
                      />
                    </div>
                  );
                }
                return (
                  <div
                    key={`ph-${rIdx}-${cIdx}`}
                    className={`gd-cell gd-cell--placeholder ${spanCls}`.trim()}
                    style={{ background: cell.bg }}
                    aria-hidden="true"
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <Lightbox
        open={lbOpen}
        close={handleClose}
        index={lbIndex}
        slides={slides}
        plugins={[Zoom]}
        zoom={{
          maxZoomPixelRatio: 4,
          doubleTapDelay: 300,
          doubleClickMaxStops: 2,
          scrollToZoom: true,
        }}
        animation={{ swipe: 250, fade: 250 }}
        carousel={{ finite: false, padding: 0, spacing: 24 }}
        controller={{ closeOnBackdropClick: true }}
        on={{
          view: ({ index }) => setLbIndex(index),
        }}
        render={{ slide: LightboxNextJsImage }}
        styles={{
          root: { '--yarl__color_backdrop': 'var(--color-background-inverse)' },
        }}
      />
    </div>
  );
}
