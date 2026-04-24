/* ══════════════════════════════════════════
   GoodDaysPage — /gooddays
   프로토타입 #gd-page (L4180~4197 + L10628~10870) 이식.

   설계 결정:
   1. gd-* 격리
      - gd-grid / gd-row--{a..e} / gd-cell / gd-lightbox 클래스 그대로 사용.
        Story/Biz 와 동일한 파일 격리 원칙.

   2. 매거진 그리드
      - lib/gooddays.ts 의 buildGoodDaysGrid() 가 순수 함수로 rows + ordered 반환.
        component 는 iterate 만 담당.

   3. 등장 연출
      - 타이틀: mount 후 next frame 에 gd-anim 클래스 add → CSS transition 재생.
      - 셀: IntersectionObserver 로 gd-visible 부여. 같은 row 내 인덱스로 70ms stagger.
        placeholder 셀은 관찰 대상 제외.

   4. 라이트박스
      - 포탈 없이 inline 렌더. position:fixed + z-index:var(--z-lightbox) 로 처리.
      - lightboxIdx: null = 닫힘, number = 해당 ordered idx 표시.
      - Esc / Arrow 키는 window keydown 리스너.
      - settled 클래스는 open 후 600ms 뒤 부여 (프로토타입 동일 — 배경이 완전 black →
        반투명 overlay-lightbox-bg 로 전환되는 미세한 단계).
   ══════════════════════════════════════════ */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { buildGoodDaysGrid } from '@/lib/gooddays';

export default function GoodDaysPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  /* 그리드 데이터는 렌더링 순수 함수 — useMemo 로 한 번만 계산 */
  const grid = useMemo(() => buildGoodDaysGrid(), []);
  const { rows, ordered } = grid;

  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [anim, setAnim] = useState(false);
  /* 재진입마다 타이틀 페이드 + 셀 IO 재구성을 재생하기 위한 카운터.
     SiteHeader 의 'gtr:gooddays-reset' (same-path 재클릭) 시 증가. */
  const [resetTick, setResetTick] = useState(0);
  /* 라이트박스 portal 은 document.body 가 존재해야 렌더 가능 — SSR/hydration 회피.
     mount 직후 1회성 true 전환 — SiteHeader.tsx L40 setMounted 컨벤션 동일. */
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  /* 라이트박스 상태 — null = 닫힘 */
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [lbSettled, setLbSettled] = useState(false);
  /* instant 모드 — 메인 페이지 갤러리에서 진입 시 transition 없이 즉시 표시.
     프로토타입 L2463 gd-lb-instant 클래스 동일. 화이트 flash 차단. */
  const [lbInstant, setLbInstant] = useState(false);
  /* 화살표 클릭 직후 즉시 숨김 — pointerMove 로 복원 */
  const [arrowsHidden, setArrowsHidden] = useState(false);
  /* 라이트박스 settled 타이머 ref — 빠른 열기/닫기 시 stale state update 방지 */
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* ?img= query 마지막 처리 src — 중복 실행 방지 + Activity 복귀 시 stale 판정.
     BUG-006 Stage D-2 (2026-04-24): boolean 플래그로는 cacheComponents 활성화 후
     Activity hidden→visible 복귀 시 새 ?img= 가 무시되어 이전 이미지가 stale 하게
     표시되는 버그 발생. src 문자열을 비교하면 재진입 여부를 정확히 판정 가능. */
  const lastHandledImgSrcRef = useRef<string | null>(null);

  /* 메인 페이지 갤러리 클릭 → ?img=<src> query 로 진입 시
     라이트박스를 instant(transition 없이) 즉시 표시.
     프로토타입 openGoodDaysPage(lightboxSrc) L10845~10858 동일.
     flow: gd-lb-instant(즉시 표시) → 2 rAF 후 instant 해제 + settled 부여.

     Stage D-2: src 기반 중복 판정 — Activity 복귀 시 다른 ?img= 가 오면 재처리. */
  useEffect(() => {
    const imgSrc = searchParams.get('img');
    if (!imgSrc || ordered.length === 0) {
      /* 쿼리 없는 진입: 다음 ?img= 를 새로 처리할 수 있도록 ref 리셋 */
      lastHandledImgSrcRef.current = null;
      return;
    }
    if (lastHandledImgSrcRef.current === imgSrc) return;
    const idx = ordered.indexOf(imgSrc);
    if (idx < 0) return;
    lastHandledImgSrcRef.current = imgSrc;
    // instant: transition 없이 즉시 검정 배경 표시 (화이트 flash 차단)
    // 쿼리 진입 1회성 동기 set — useEffect 내 즉시 set 의도된 패턴
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLbInstant(true);
    setLightboxIdx(idx);
    setLbSettled(false);
    // 2 rAF 후 instant 해제 → 이후 일반 transition 복원 + settled
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setLbInstant(false);
        setLbSettled(true);
      });
    });
  }, [searchParams, ordered]);

  /* 타이틀 등장 연출 — 재진입 시 anim 재부여.
     deps: resetTick (same-path 재클릭) · pathname (다른 페이지 → 재진입).
     Next.js 16 + cacheComponents + Activity 하에서 페이지는 display:none 토글로 보존 →
     pathname 변화로 재진입 감지. `=== '/gooddays'` 가드로 visible 복귀 시에만 재생. */
  useEffect(() => {
    if (pathname !== '/gooddays') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnim(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnim(true));
    });
    return () => cancelAnimationFrame(id);
  }, [resetTick, pathname]);

  /* 셀 스크롤 리빌 IO — row 내 인덱스 * 70ms stagger.
     재진입 시 기존 gd-visible + inline transitionDelay 모두 초기화해야 stagger 를
     처음부터 다시 재생 가능 (DB-11: Activity preserve 하에서 이전 delay 가 잔존하면
     "전체적으로 묶여서 속도가 빨라지는" 증상 발생). */
  useEffect(() => {
    if (pathname !== '/gooddays') return;
    const gridEl = gridRef.current;
    if (!gridEl) return;
    const cells = Array.from(
      gridEl.querySelectorAll<HTMLElement>('.gd-cell:not(.gd-cell--placeholder)'),
    );
    /* 재진입 시 기존 visible + stagger delay 초기화 */
    cells.forEach((c) => {
      c.classList.remove('gd-visible');
      c.style.transitionDelay = '';
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
          cell.style.transitionDelay = `${idx * 70}ms`;
          cell.classList.add('gd-visible');
          io.unobserve(cell);
        });
      },
      { threshold: 0.15 },
    );
    cells.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [rows, resetTick, pathname]);

  /* same-page reentry — SiteHeader Good Days 링크 재클릭 시 발송.
     스크롤 top + resetTick 증가 → 타이틀 페이드 + 셀 IO 리빌 재생.
     Menu/Shop 과 동일한 same-page reentry 정책. */
  useEffect(() => {
    function onReset() {
      window.scrollTo({ top: 0, behavior: 'instant' });
      setResetTick((n) => n + 1);
    }
    window.addEventListener('gtr:gooddays-reset', onReset);
    return () => window.removeEventListener('gtr:gooddays-reset', onReset);
  }, []);

  /* 라이트박스 열기.
     settled 타이머는 ref 로 보관 — 라이트박스를 600ms 안에 닫거나 다시 열 때
     stale setLbSettled(true) 가 발생해 다음 진입의 초기 상태(black) 가 스킵되는
     버그(silent-failure 리뷰 H2) 를 방지. */
  const openLightbox = useCallback((idx: number) => {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    setLightboxIdx(idx);
    setLbSettled(false);
    /* 프로토타입 동일 — open 후 600ms 뒤 settled (black → overlay-lightbox-bg) */
    settleTimerRef.current = setTimeout(() => {
      settleTimerRef.current = null;
      setLbSettled(true);
    }, 600);
  }, []);

  const closeLightbox = useCallback(() => {
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    setLightboxIdx(null);
    setLbSettled(false);
    setLbInstant(false);
    setArrowsHidden(false);
    /* Stage D-2: 다음 동일 ?img= 재진입을 허용하려면 ref 도 리셋 */
    lastHandledImgSrcRef.current = null;
    /* ?img= 파라미터가 남아 있으면 제거 — 새로고침 시 라이트박스 재오픈 방지 */
    if (searchParams.get('img')) {
      router.replace('/gooddays', { scroll: false });
    }
  }, [router, searchParams]);

  /* 언마운트 시 settled 타이머 정리 */
  useEffect(() => {
    return () => {
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
    };
  }, []);

  const navLightbox = useCallback(
    (delta: number) => {
      setLightboxIdx((prev) => {
        if (prev === null) return prev;
        return (prev + delta + ordered.length) % ordered.length;
      });
    },
    [ordered.length],
  );

  /* 라이트박스 오픈 중 키보드 컨트롤 */
  useEffect(() => {
    if (lightboxIdx === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') navLightbox(-1);
      else if (e.key === 'ArrowRight') navLightbox(1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIdx, closeLightbox, navLightbox]);

  /* body overflow lock while lightbox open.
     prev 캡처 패턴(`prev = body.style.overflow` → cleanup 시 `prev` 복원) 을 쓰지 않음 —
     Next.js 라우트 단위에서 이전 페이지의 overflow 가 'hidden' 인 채 진입하면 cleanup 이
     'hidden' 을 되돌려 놓아 영구 잠금이 발생할 수 있음 (silent-failure 리뷰 H3).
     라이트박스가 본인이 lock 을 소유한다고 보고 cleanup 시 빈 문자열로 단순 해제. */
  useEffect(() => {
    if (lightboxIdx === null) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [lightboxIdx]);

  /* 투핑거 핀치 줌 차단 — iOS Safari 는 touch-action: pan-y 만으로 부족.
     viewport maximum-scale=1 / user-scalable=no 로 열린 동안만 줌 비활성화. */
  useEffect(() => {
    if (lightboxIdx === null) return;
    const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!viewport) return;
    const orig = viewport.content;
    viewport.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
    return () => { viewport.content = orig; };
  }, [lightboxIdx]);

  const currentImg = lightboxIdx !== null ? ordered[lightboxIdx] : null;

  /* 라이트박스 — 프로토타입 L4193 처럼 body 직계로 렌더해야
     #gd-page 의 pageEnter transform 이 만드는 stacking context 에 갇히지 않음
     (헤더/어나운스 바 위로 정상 노출). architect M2 권고. */
  const arrowCls = arrowsHidden ? ' gd-lb-arrow--hidden' : '';

  const lightbox = (
    <div
      id="gd-lightbox"
      className={`gd-lightbox${lightboxIdx !== null ? ' open' : ''}${
        lbInstant ? ' gd-lb-instant' : ''
      }${lbSettled ? ' gd-lb-settled' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeLightbox();
      }}
      onPointerMove={() => { if (arrowsHidden) setArrowsHidden(false); }}
    >
      {/* 좌우 탭존 — 이미지 세로 전체 범위에서 prev/next 탭 허용 */}
      <div
        className="gd-lb-zone gd-lb-zone--prev"
        aria-hidden="true"
        onClick={(e) => { e.stopPropagation(); setArrowsHidden(true); navLightbox(-1); }}
      />
      <div
        className="gd-lb-zone gd-lb-zone--next"
        aria-hidden="true"
        onClick={(e) => { e.stopPropagation(); setArrowsHidden(true); navLightbox(1); }}
      />
      <button
        type="button"
        className="gd-lb-close close-btn close-btn-secondary-dark"
        id="gd-lb-close"
        aria-label="닫기"
        onClick={closeLightbox}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19,5l-14,14" />
          <path d="M5,5l14,14" />
        </svg>
      </button>
      <button
        type="button"
        className={`gd-lb-arrow gd-lb-prev arrow-btn arrow-btn-primary arrow-btn-dark${arrowCls}`}
        id="gd-lb-prev"
        aria-label="이전 이미지"
        onClick={(e) => {
          e.stopPropagation();
          setArrowsHidden(true);
          navLightbox(-1);
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      {currentImg && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          id="gd-lb-img"
          src={currentImg}
          alt={`갤러리 이미지 ${(lightboxIdx ?? 0) + 1}`}
        />
      )}
      <button
        type="button"
        className={`gd-lb-arrow gd-lb-next arrow-btn arrow-btn-primary arrow-btn-dark${arrowCls}`}
        id="gd-lb-next"
        aria-label="다음 이미지"
        onClick={(e) => {
          e.stopPropagation();
          setArrowsHidden(true);
          navLightbox(1);
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );

  return (
    <div
      id="gd-page"
      ref={rootRef}
      className={anim ? 'gd-anim' : ''}
      data-header-theme="light"
    >
      <div id="gd-inner">
        <h1 id="gd-title">좋은 순간들</h1>
        <p className="page-subtitle">매장에서 보내는 하루하루를 기록합니다</p>
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
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={cell.src}
                        alt={`갤러리 이미지 ${cell.orderedIdx + 1}`}
                        loading="lazy"
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

      {/* 라이트박스는 portal 로 body 직계 렌더 — 아래 return 끝에서 호출 */}
      {mounted && createPortal(lightbox, document.body)}
    </div>
  );
}
