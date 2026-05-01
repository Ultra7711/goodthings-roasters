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

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { buildGoodDaysGrid } from '@/lib/gooddays';

export default function GoodDaysPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  /* 그리드 데이터는 렌더링 순수 함수 — useMemo 로 한 번만 계산 */
  const grid = useMemo(() => buildGoodDaysGrid(), []);
  const { rows, ordered } = grid;

  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const ioRef = useRef<IntersectionObserver | null>(null);

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
  /* 클릭 방향 피드백 — null=숨김, 'prev'/'next'=해당 화살표 600ms 표시 후 fade-out */
  const [flashDir, setFlashDir] = useState<'prev' | 'next' | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* 제스처 변환 — 핀치 줌 · 팬 · 더블탭 */
  const [xform, setXform] = useState({ scale: 1, tx: 0, ty: 0 });
  const [xformAnim, setXformAnim] = useState(false);
  const xformRef = useRef({ scale: 1, tx: 0, ty: 0 });
  /* 3-slide carousel track ref — swipe peek 시 DOM 직접 transform 조작 */
  const trackRef = useRef<HTMLDivElement | null>(null);
  /* 확대 시 컨트롤(닫기 버튼) auto-hide. scale>1 단일 탭으로 toggle. */
  const [controlsHidden, setControlsHidden] = useState(false);
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
    const idx = ordered.findIndex((item) => item.src === imgSrc);
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
     data-transitioning 제거 전에 셀 opacity:0 도달 → 플래시 없음.
     (DB-11 S72 측정 기반; resetTick 비동기 방식에서 동기 DOM 조작으로 전환) */
  useEffect(() => {
    function onRouteChange(e: Event) {
      if ((e as CustomEvent<string>).detail !== '/gooddays') return;
      setupCells();
      triggerTitleAnim();
    }
    window.addEventListener('gtr:route-change', onRouteChange);
    return () => window.removeEventListener('gtr:route-change', onRouteChange);
  }, [setupCells, triggerTitleAnim]);

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
    if (flashTimerRef.current) {
      clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
    }
    setLightboxIdx(null);
    setLbSettled(false);
    setLbInstant(false);
    setFlashDir(null);
    const zeroXform = { scale: 1, tx: 0, ty: 0 };
    xformRef.current = zeroXform;
    setXform(zeroXform);
    setXformAnim(false);
    setControlsHidden(false);
    /* Stage D-2: 다음 동일 ?img= 재진입을 허용하려면 ref 도 리셋 */
    lastHandledImgSrcRef.current = null;
    /* ?img= 파라미터가 남아 있으면 제거 — 새로고침 시 라이트박스 재오픈 방지 */
    if (searchParams.get('img')) {
      router.replace('/gooddays', { scroll: false });
    }
  }, [router, searchParams]);

  /* 언마운트 시 타이머 정리 */
  useEffect(() => {
    return () => {
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
      if (flashTimerRef.current) {
        clearTimeout(flashTimerRef.current);
        flashTimerRef.current = null;
      }
    };
  }, []);

  const navLightbox = useCallback(
    (delta: number) => {
      /* 이미지 전환 시 변환 + 컨트롤 상태 초기화 */
      const zeroXform = { scale: 1, tx: 0, ty: 0 };
      xformRef.current = zeroXform;
      setXform(zeroXform);
      setXformAnim(false);
      setControlsHidden(false);
      setLightboxIdx((prev) => {
        if (prev === null) return prev;
        return (prev + delta + ordered.length) % ordered.length;
      });
    },
    [ordered.length],
  );

  /* 방향 피드백 flash — 클릭한 방향 화살표를 600ms 표시 후 fade-out */
  const flashArrow = useCallback((dir: 'prev' | 'next') => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlashDir(dir);
    flashTimerRef.current = setTimeout(() => {
      setFlashDir(null);
      flashTimerRef.current = null;
    }, 600);
  }, []);

  /* stable refs — 제스처 핸들러의 stale closure 방지 */
  const navLightboxRef = useRef(navLightbox);
  navLightboxRef.current = navLightbox;
  const flashArrowRef = useRef(flashArrow);
  flashArrowRef.current = flashArrow;

  /* 라이트박스 제스처 — 핀치 줌(rubber band) · 팬 · 더블탭 · swipe(carousel peek) · 컨트롤 토글
     gd-lightbox 컨테이너에 등록. passive:false → touchmove/touchend 에서 preventDefault 허용.

     swipe(scale===1, 한 손가락 horizontal drag) 는 trackRef 의 transform 을 DOM 직접 조작 —
     React state sync 이슈 회피 + 60fps 부드러운 peek. 종료 시 임계 초과면 navLightbox 호출하고
     transform 즉시 -100vw 로 점프 (transition:none + rAF) → 새 current 가 가운데. */
  useEffect(() => {
    if (lightboxIdx === null) return;
    const lb = document.getElementById('gd-lightbox') as HTMLElement | null;
    if (!lb) return;
    const container = lb;

    /* effect-local 제스처 상태 */
    let isPinching = false;
    let pinchStartDist = 0;
    let pinchStartScale = 1;
    let pinchCenterX = 0; // 컨테이너 중심 기준
    let pinchCenterY = 0;
    let pinchStartTx = 0;
    let pinchStartTy = 0;

    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;
    let panStartTx = 0;
    let panStartTy = 0;

    /* swipe 상태 (scale === 1 carousel) */
    let isSwiping = false;
    let swipeStartX = 0;
    let swipeStartT = 0;
    let swipeDx = 0;

    let lastTapTime = 0;
    let lastTapX = 0;
    let lastTapY = 0;
    let touchMoved = false;

    function twoFingerDist(t: TouchList) {
      return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    }

    /* 이동 범위 클램핑 — 이미지가 컨테이너 밖으로 나가지 않도록 (scale ≤ 4 상정) */
    function clamp(t: { scale: number; tx: number; ty: number }) {
      const { scale, tx, ty } = t;
      const effectiveScale = Math.max(1, Math.min(4, scale));
      const maxTx = Math.max(0, (container.offsetWidth * (effectiveScale - 1)) / 2);
      const maxTy = Math.max(0, (container.offsetHeight * (effectiveScale - 1)) / 2);
      return {
        scale,
        tx: Math.min(maxTx, Math.max(-maxTx, tx)),
        ty: Math.min(maxTy, Math.max(-maxTy, ty)),
      };
    }

    /* rubber band: scale 이 [1,4] 를 벗어나면 저항 0.3 으로 over-scale 허용 */
    function softScaleClamp(raw: number): number {
      if (raw > 4) return 4 + (raw - 4) * 0.3;
      if (raw < 1) return Math.max(0.5, 1 - (1 - raw) * 0.3);
      return raw;
    }

    function apply(t: { scale: number; tx: number; ty: number }, anim = false) {
      xformRef.current = t;
      setXformAnim(anim);
      setXform({ ...t });
    }

    /* track DOM 직접 조작 — swipe peek 부드러움 우선 */
    function setTrackDx(dx: number, anim: boolean) {
      const track = trackRef.current;
      if (!track) return;
      track.style.transition = anim ? 'transform 0.25s ease-out' : 'none';
      track.style.transform = `translateX(calc(-100vw + ${dx}px))`;
    }

    function commitSwipe(dir: -1 | 1) {
      const track = trackRef.current;
      const winW = window.innerWidth;
      if (!track) {
        navLightboxRef.current(dir);
        return;
      }
      track.style.transition = 'transform 0.25s ease-out';
      track.style.transform = `translateX(${dir === -1 ? 0 : -2 * winW}px)`;
      window.setTimeout(() => {
        if (!trackRef.current) return;
        trackRef.current.style.transition = 'none';
        trackRef.current.style.transform = 'translateX(-100vw)';
        navLightboxRef.current(dir);
      }, 260);
    }

    function springBackTrack() {
      setTrackDx(0, true);
    }

    function onStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        isPinching = true;
        isPanning = false;
        isSwiping = false;
        const curr = xformRef.current;
        pinchStartDist = twoFingerDist(e.touches);
        pinchStartScale = curr.scale;
        pinchStartTx = curr.tx;
        pinchStartTy = curr.ty;
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const rect = container.getBoundingClientRect();
        pinchCenterX = midX - rect.left - rect.width / 2;
        pinchCenterY = midY - rect.top - rect.height / 2;
        setXformAnim(false);
      } else if (e.touches.length === 1 && !isPinching) {
        touchMoved = false;
        panStartX = e.touches[0].clientX;
        panStartY = e.touches[0].clientY;
        panStartTx = xformRef.current.tx;
        panStartTy = xformRef.current.ty;
        swipeStartX = e.touches[0].clientX;
        swipeStartT = Date.now();
        swipeDx = 0;
        isSwiping = false;
        setXformAnim(false);
      }
    }

    function onMove(e: TouchEvent) {
      if (e.touches.length === 2 && isPinching) {
        e.preventDefault();
        const currDist = twoFingerDist(e.touches);
        const rawScale = pinchStartScale * (currDist / pinchStartDist);
        const newScale = softScaleClamp(rawScale);
        const scaleChange = newScale / pinchStartScale;
        /* 핀치 중심 고정 공식: tx' = pcx + scaleChange * (startTx - pcx) */
        const newTx = pinchCenterX + scaleChange * (pinchStartTx - pinchCenterX);
        const newTy = pinchCenterY + scaleChange * (pinchStartTy - pinchCenterY);
        /* 1~4 범위 내에서만 tx/ty clamp, over-scale 시 raw 유지 (release 시 spring back) */
        if (newScale >= 1 && newScale <= 4) {
          apply(clamp({ scale: newScale, tx: newTx, ty: newTy }));
        } else {
          apply({ scale: newScale, tx: newTx, ty: newTy });
        }
      } else if (e.touches.length === 1 && !isPinching) {
        const dx = e.touches[0].clientX - panStartX;
        const dy = e.touches[0].clientY - panStartY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          touchMoved = true;
          if (xformRef.current.scale > 1) {
            /* 확대 상태 — 기존 pan */
            e.preventDefault();
            isPanning = true;
            apply(clamp({ scale: xformRef.current.scale, tx: panStartTx + dx, ty: panStartTy + dy }));
          } else if (Math.abs(dx) > Math.abs(dy)) {
            /* scale===1 + horizontal-dominant — swipe carousel */
            e.preventDefault();
            isSwiping = true;
            swipeDx = dx;
            setTrackDx(dx, false);
          }
        }
      }
    }

    function onEnd(e: TouchEvent) {
      /* 핀치 종료 */
      if (isPinching && e.touches.length < 2) {
        isPinching = false;
        const curr = xformRef.current;
        if (curr.scale > 4) {
          /* over-scale — 4 까지 spring back, tx/ty 도 clamp 한 값으로 */
          apply(clamp({ scale: 4, tx: curr.tx, ty: curr.ty }), true);
          isPanning = false;
        } else if (curr.scale < 1.1) {
          apply({ scale: 1, tx: 0, ty: 0 }, true);
          isPanning = false;
        } else if (e.touches.length === 1) {
          /* 핀치 → 1손가락 전환: 잔류 손가락 기준으로 panStart 재설정.
             미리 갱신하지 않으면 onMove 에서 stale panStart 로 이미지가 튐. */
          panStartX = e.touches[0].clientX;
          panStartY = e.touches[0].clientY;
          panStartTx = xformRef.current.tx;
          panStartTy = xformRef.current.ty;
          isPanning = false;
        } else {
          isPanning = false;
        }
        return;
      }

      /* swipe 종료 — 임계 초과 시 carousel 전환, 미달 시 spring back */
      if (isSwiping && e.touches.length === 0) {
        isSwiping = false;
        const dt = Math.max(1, Date.now() - swipeStartT);
        const velocity = Math.abs(swipeDx) / dt; // px/ms
        const winW = window.innerWidth;
        const dragThreshold = winW * 0.15;
        const velocityThreshold = 0.5;
        const passed = Math.abs(swipeDx) > dragThreshold || velocity > velocityThreshold;
        if (passed && swipeDx < 0) {
          flashArrowRef.current('next');
          commitSwipe(1);
        } else if (passed && swipeDx > 0) {
          flashArrowRef.current('prev');
          commitSwipe(-1);
        } else {
          springBackTrack();
        }
        return;
      }

      /* 탭 감지 — 손가락이 모두 떼어지고 이동 없을 때 */
      if (e.touches.length === 0 && !isPanning && !touchMoved) {
        /* 버튼(닫기·화살표) 탭은 네이티브 click 에 위임 — preventDefault 스킵.
           JS 탭 핸들러가 preventDefault 로 합성 click 을 억제하면 close 버튼이
           동작하지 않고 위치 기반 분기에서 next 로 오인되는 버그 방지. */
        const tgt = e.changedTouches[0].target as HTMLElement;
        if (tgt.closest('button')) return;
        e.preventDefault(); // 합성 click 이벤트 억제 (버튼 외 영역)
        const now = Date.now();
        const tapX = e.changedTouches[0].clientX;
        const tapY = e.changedTouches[0].clientY;
        const isDouble =
          now - lastTapTime < 300 &&
          Math.abs(tapX - lastTapX) < 40 &&
          Math.abs(tapY - lastTapY) < 40;

        if (isDouble) {
          lastTapTime = 0;
          if (xformRef.current.scale > 1) {
            /* 더블탭 → 원래 크기 복귀 */
            apply({ scale: 1, tx: 0, ty: 0 }, true);
            setControlsHidden(false);
          } else {
            /* 더블탭 → 탭 위치 기준 2배 확대
               공식 유도: 이미지 공간의 탭 위치 imgP = (pcx - tx) / s = pcx (s=1, tx=0)
               확대 후 pcx 를 고정: newTx = pcx - imgP * 2 = -pcx */
            const rect = container.getBoundingClientRect();
            const pcx = tapX - rect.left - rect.width / 2;
            const pcy = tapY - rect.top - rect.height / 2;
            apply(clamp({ scale: 2, tx: -pcx, ty: -pcy }), true);
          }
        } else {
          lastTapTime = now;
          lastTapX = tapX;
          lastTapY = tapY;
          if (xformRef.current.scale > 1) {
            /* 확대 상태 — 단일 탭으로 컨트롤(닫기 버튼) toggle */
            setControlsHidden((v) => !v);
          } else {
            /* scale===1 — 좌/우 35% 영역 탭으로 prev/next (기존) */
            const rect = container.getBoundingClientRect();
            const relX = tapX - rect.left;
            if (relX < rect.width * 0.35) {
              flashArrowRef.current('prev');
              navLightboxRef.current(-1);
            } else if (relX > rect.width * 0.65) {
              flashArrowRef.current('next');
              navLightboxRef.current(1);
            }
          }
        }
      }

      if (e.touches.length === 0) {
        isPanning = false;
      }
    }

    lb.addEventListener('touchstart', onStart, { passive: true });
    lb.addEventListener('touchmove', onMove, { passive: false });
    lb.addEventListener('touchend', onEnd, { passive: false });
    return () => {
      lb.removeEventListener('touchstart', onStart);
      lb.removeEventListener('touchmove', onMove);
      lb.removeEventListener('touchend', onEnd);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxIdx]);

  /* 확대 시 컨트롤 자동 hide — scale 변동에 따라 자동 sync.
     단일 탭 토글로 사용자가 수동으로 다시 띄울 수 있다 (제스처 핸들러 참조). */
  useEffect(() => {
    if (xform.scale > 1) {
      setControlsHidden(true);
    } else {
      setControlsHidden(false);
    }
  }, [xform.scale]);

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

  const currentImg = lightboxIdx !== null ? ordered[lightboxIdx] : null;
  const prevImg =
    lightboxIdx !== null && ordered.length > 0
      ? ordered[(lightboxIdx - 1 + ordered.length) % ordered.length]
      : null;
  const nextImg =
    lightboxIdx !== null && ordered.length > 0
      ? ordered[(lightboxIdx + 1) % ordered.length]
      : null;

  /* 라이트박스 — 프로토타입 L4193 처럼 body 직계로 렌더해야
     #gd-page 의 pageEnter transform 이 만드는 stacking context 에 갇히지 않음
     (헤더/어나운스 바 위로 정상 노출). architect M2 권고. */
  const prevArrowCls = flashDir === 'prev' ? ' gd-lb-arrow--flash' : '';
  const nextArrowCls = flashDir === 'next' ? ' gd-lb-arrow--flash' : '';

  const lightbox = (
    <div
      id="gd-lightbox"
      className={`gd-lightbox${lightboxIdx !== null ? ' open' : ''}${
        lbInstant ? ' gd-lb-instant' : ''
      }${lbSettled ? ' gd-lb-settled' : ''}${controlsHidden ? ' controls-hidden' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeLightbox();
      }}
    >
      {/* 좌우 탭존 — 이미지 세로 전체 범위에서 prev/next 탭 허용 */}
      <div
        className="gd-lb-zone gd-lb-zone--prev"
        aria-hidden="true"
        onClick={(e) => { e.stopPropagation(); flashArrow('prev'); navLightbox(-1); }}
      />
      <div
        className="gd-lb-zone gd-lb-zone--next"
        aria-hidden="true"
        onClick={(e) => { e.stopPropagation(); flashArrow('next'); navLightbox(1); }}
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
        className={`gd-lb-arrow gd-lb-prev arrow-btn arrow-btn-primary arrow-btn-dark${prevArrowCls}`}
        id="gd-lb-prev"
        aria-label="이전 이미지"
        onClick={(e) => {
          e.stopPropagation();
          flashArrow('prev');
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
        <div className="gd-lb-track" ref={trackRef}>
          {/* prev slide — 좌 swipe peek */}
          <div className="gd-lb-slide" aria-hidden="true">
            {prevImg && (
              <Image
                key={prevImg.src}
                src={prevImg.src}
                alt=""
                fill
                sizes="100vw"
                quality={85}
                placeholder="blur"
                blurDataURL={prevImg.blurDataURL}
                style={{ objectFit: 'contain' }}
              />
            )}
          </div>
          {/* current slide — 핀치/팬 변환은 이 안의 wrap 에만 적용 */}
          <div className="gd-lb-slide">
            <div
              id="gd-lb-img-wrap"
              style={{
                transform: `translate(${xform.tx}px, ${xform.ty}px) scale(${xform.scale})`,
                transformOrigin: 'center center',
                transition: xformAnim ? 'transform 0.25s ease-out' : 'none',
              }}
            >
              <Image
                key={currentImg.src}
                src={currentImg.src}
                alt={`갤러리 이미지 ${(lightboxIdx ?? 0) + 1}`}
                fill
                sizes="100vw"
                quality={85}
                placeholder="blur"
                blurDataURL={currentImg.blurDataURL}
                style={{ objectFit: 'contain' }}
              />
            </div>
          </div>
          {/* next slide — 우 swipe peek */}
          <div className="gd-lb-slide" aria-hidden="true">
            {nextImg && (
              <Image
                key={nextImg.src}
                src={nextImg.src}
                alt=""
                fill
                sizes="100vw"
                quality={85}
                placeholder="blur"
                blurDataURL={nextImg.blurDataURL}
                style={{ objectFit: 'contain' }}
              />
            )}
          </div>
        </div>
      )}
      <button
        type="button"
        className={`gd-lb-arrow gd-lb-next arrow-btn arrow-btn-primary arrow-btn-dark${nextArrowCls}`}
        id="gd-lb-next"
        aria-label="다음 이미지"
        onClick={(e) => {
          e.stopPropagation();
          flashArrow('next');
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

      {/* 라이트박스는 portal 로 body 직계 렌더 — 아래 return 끝에서 호출 */}
      {mounted && createPortal(lightbox, document.body)}
    </div>
  );
}
