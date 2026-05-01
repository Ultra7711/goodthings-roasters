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
import { ZoomIn, ZoomOut } from 'lucide-react';
import { buildGoodDaysGrid } from '@/lib/gooddays';
import LightboxNextJsImage from './LightboxNextJsImage';
import MobileZoneTap from './MobileZoneTap';

type GdSlide = SlideImage & { blurDataURL?: string };

type Props = {
  /** 서버 측에서 searchParams.img 으로 결정된 초기 이미지 src (없으면 null).
      page.tsx (server component) 가 prop 으로 전달 → 첫 paint 부터 라이트박스 open. */
  initialImgSrc: string | null;
};

export default function GoodDaysPage({ initialImgSrc }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  /* 그리드 데이터는 렌더링 순수 함수 — useMemo 로 한 번만 계산 */
  const grid = useMemo(() => buildGoodDaysGrid(), []);
  const { rows, ordered } = grid;

  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const ioRef = useRef<IntersectionObserver | null>(null);

  /* 라이트박스용 슬라이드 — ordered 순서.
     width/height: yet-another-react-lightbox Zoom plugin 활성화 필수 조건.
     blurDataURL: LightboxNextJsImage 의 placeholder=blur. */
  const slides = useMemo<GdSlide[]>(
    () =>
      ordered.map((item) => ({
        src: item.src,
        width: item.width,
        height: item.height,
        blurDataURL: item.blurDataURL,
        alt: '',
      })),
    [ordered],
  );

  /* 모바일 detection — render.buttonZoom hide 용 (모바일은 핀치 제스처로 충분).
     SSR 안전: 첫 렌더 false → mount 후 matchMedia 결과로 갱신. */
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  /* 줌 상태 — Zoom plugin 의 on.zoom 콜백으로 sync.
     - isZoomed > 0 시 zone tap unmount (핀치 충돌 차단)
     - controlsHidden true → 닫기 버튼 hide
     - 사용자가 줌 인 상태에서 image 탭 → controlsHidden toggle (UI 노출/hide) */
  const [isZoomed, setIsZoomed] = useState(false);
  const [controlsHidden, setControlsHidden] = useState(false);
  const isZoomedRef = useRef(false);
  isZoomedRef.current = isZoomed;

  /* initialImgSrc prop 으로 첫 마운트 시점 라이트박스 인덱스 결정.
     useState 초기값 함수가 첫 paint 에 라이트박스 open 보장 → 흰 본문 노출 차단. */
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

  /* Activity 복귀 시 ?img= 변경 감지 — cacheComponents 활성화 환경에서 컴포넌트 인스턴스가
     재사용되면 useState 초기값이 stale (이미 한 번 실행됨). lastHandledImgSrcRef 가드로
     같은 src 두 번 처리 방지 + ref 초기값을 initialImgSrc 로 set → 첫 useEffect 스킵. */
  const lastHandledImgSrcRef = useRef<string | null>(initialImgSrc);

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

  /* 첫 마운트 시 body.gd-route-transition 클래스 제거 — 메인→굿데이즈 전환 검정 오버레이 종료.
     Suspense fallback 검정 → GoodDaysPage 마운트 + 라이트박스 검정 → ::before 제거 자연스러움. */
  useEffect(() => {
    document.body.classList.remove('gd-route-transition');
  }, []);

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

  /* 갤러리 셀 click — 라이트박스 open */
  const openLightbox = useCallback((idx: number) => {
    setLbIndex(idx);
    setLbOpen(true);
  }, []);

  /* 라이트박스 close — ?img= URL 정리.
     URL 이 이미 /gooddays 면 router.replace no-op 처리됨. */
  const handleClose = useCallback(() => {
    setLbOpen(false);
    router.replace('/gooddays', { scroll: false });
  }, [router]);

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
          /* 줌 sync — zoom>1 진입 시 isZoomed=true + 자동 controls hide.
             zoom===1 복귀 시 둘 다 reset. */
          zoom: ({ zoom }) => {
            const zoomed = zoom > 1;
            setIsZoomed(zoomed);
            setControlsHidden(zoomed);
          },
          /* 줌 in 상태에서 image 탭 → 닫기 버튼 toggle (한 번 노출, 다시 hide).
             zoom===1 상태 탭은 스킵 (zone tap 또는 swipe 가 처리). */
          click: () => {
            if (isZoomedRef.current) {
              setControlsHidden((v) => !v);
            }
          },
        }}
        render={{
          slide: LightboxNextJsImage,
          /* 모바일 zone tap + 피드백 fade — useController 로 prev/next 호출.
             isZoomed 시 zone unmount (핀치 인식 충돌 차단). */
          controls: () => <MobileZoneTap isMobile={isMobile} isZoomed={isZoomed} />,
          /* 좌우 화살표 — 기존 GTR 디자인 (polyline) 재사용. 색상은 라이브러리 default white.
             데스크탑 hit 영역 키움: SVG 48px + strokeWidth 1.25 (시각 균형). */
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
          /* 모바일은 drag swipe 로 충분 → 화살표 제거. 데스크탑은 default 노출. */
          buttonPrev: isMobile ? () => null : undefined,
          buttonNext: isMobile ? () => null : undefined,
          /* controlsHidden 시 닫기 버튼 hide (줌 in 자동 또는 탭 토글). */
          buttonClose: controlsHidden ? () => null : undefined,
          /* 줌 +/- 아이콘 — Lucide ZoomIn / ZoomOut */
          iconZoomIn: () => <ZoomIn size={28} strokeWidth={1.5} aria-hidden="true" />,
          iconZoomOut: () => <ZoomOut size={28} strokeWidth={1.5} aria-hidden="true" />,
          /* 닫기 X — GTR 표준 디자인 (CartDrawer · CafeNutritionSheet 동일) */
          iconClose: () => (
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19,5l-14,14" />
              <path d="M5,5l14,14" />
            </svg>
          ),
          /* 모바일은 핀치 제스처로 줌 → +/- 버튼 hide. 데스크탑은 default 노출. */
          buttonZoom: isMobile ? () => null : undefined,
        }}
        styles={{
          root: { '--yarl__color_backdrop': 'var(--color-background-inverse)' },
        }}
      />
    </div>
  );
}
