/* ══════════════════════════════════════════
   HeroSection
   프로토타입 #hero-blk (라인 803–815) 이식

   BUG-006 Stage D-3 (2026-04-24):
   - cacheComponents 활성화로 Activity hidden 시에도 <video> 가 계속 재생되어
     모바일 배터리·데이터 소모 지속. useEffect cleanup 으로 pause,
     visible 복귀 시 자동 재개.

   BUG-008 (S208 진단):
   - iOS Safari 에서 다른 페이지에 한참 머물다 홈 복귀 시 frame freeze.
     hidden 동안 iOS Safari 가 video frame 진행을 suspend → visible 복귀 시
     paused === false 지만 currentTime 정지. play() 는 already-playing 으로
     resolve 되지만 frame 안 움직임 → 단순 tryPlay() 무효.
   - 이전 커밋 메시지 ("터치·스크롤에서 재시도") 와 달리 실제 코드엔 scroll
     listener 가 없었던 의도/구현 gap → scroll listener 보충.
   - 3-tier 회복: ① play() ② currentTime nudge ③ load() + 재시도.
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef } from 'react';

export default function HeroSection() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    /* 단일 회복 진입점 — 모든 트리거가 이 함수만 호출.
       정상 재생 중이면 currentTime 진행 검사로 no-op (가벼운 가드). */
    let recoveryInProgress = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const clearTimers = () => {
      while (timers.length) {
        const t = timers.shift();
        if (t) clearTimeout(t);
      }
    };

    const recover = () => {
      if (document.hidden || recoveryInProgress) return;
      recoveryInProgress = true;
      const before = video.currentTime;

      /* Tier 1: 단순 play. 대부분의 케이스 (autoplay 차단·일반 pause) 해소. */
      void video.play().catch(() => {});

      timers.push(setTimeout(() => {
        if (document.hidden) { recoveryInProgress = false; return; }
        if (video.currentTime > before + 0.05) { recoveryInProgress = false; return; }

        /* Tier 2: currentTime nudge — iOS Safari frame advance 강제.
           hidden→visible 복귀 시 디코더 시간 동기 깨진 케이스 회복. */
        try {
          video.currentTime += 0.001;
          void video.play().catch(() => {});
        } catch { /* swallow */ }

        timers.push(setTimeout(() => {
          if (document.hidden) { recoveryInProgress = false; return; }
          if (video.currentTime > before + 0.05) { recoveryInProgress = false; return; }

          /* Tier 3: load() — 디코더 컨텍스트 reset. 6.5MB 재요청 비용 있지만
             브라우저 캐시 hit 면 즉시. nudge 도 안 풀리는 케이스의 last resort. */
          try {
            const onCanPlay = () => {
              video.removeEventListener('canplay', onCanPlay);
              void video.play().catch(() => {});
              recoveryInProgress = false;
            };
            video.addEventListener('canplay', onCanPlay);
            video.load();
          } catch {
            recoveryInProgress = false;
          }
        }, 500));
      }, 300));
    };

    /* 최초 autoplay 시도 */
    void video.play().catch(() => {});

    /* 트리거 — 사용자/시스템 이벤트 모두 recover() 호출.
       recoveryInProgress 가드 + currentTime 진행 검사로 정상 재생 시 no-op. */
    const onVisibilityChange = () => { if (!document.hidden) recover(); };
    const onPause = () => { if (!document.hidden) recover(); };
    const onWaiting = () => { if (!document.hidden) recover(); };
    const onRouteChange = (e: Event) => {
      if ((e as CustomEvent<string>).detail === '/') recover();
    };
    /* 사용자 누락 보고 보충 — 스크롤 입력 시 재개.
       iOS momentum scroll 도 발화하므로 멈춘 hero 가 스크롤만으로 회복.
       passive: true 로 스크롤 성능 영향 X. */
    const onScroll = () => recover();

    document.addEventListener('touchstart', recover, { passive: true });
    document.addEventListener('click', recover);
    document.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('stalled', onWaiting);
    window.addEventListener('gtr:route-change', onRouteChange);

    return () => {
      clearTimers();
      video.pause();
      document.removeEventListener('touchstart', recover);
      document.removeEventListener('click', recover);
      document.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('stalled', onWaiting);
      window.removeEventListener('gtr:route-change', onRouteChange);
    };
  }, []);

  return (
    <section className="blk" id="hero-blk" data-header-theme="dark">
      <div className="hero">
        {/* 포스터 로드 전 gradient placeholder — 순수 다크에서 이미지로 전환 시 충격 완화 */}
        <div className="hero-bg-placeholder" aria-hidden="true" />
        <video
          ref={videoRef}
          className="hero-bg"
          autoPlay muted loop playsInline
          preload="auto"
          poster="/images/hero/hero-poster.jpg"
        >
          <source src="/images/hero/hero-video.webm" type="video/webm" />
          <source src="/images/hero/hero-video.mp4" type="video/mp4" />
        </video>
        <div className="hero-bg-overlay" />
        <div className="grain-overlay" aria-hidden="true" />
        <div className="hero-c">
          <span className="hero-slogan">
            <span className="hero-slogan-line hero-slogan-line--1">good things,</span>
            <span className="hero-slogan-line hero-slogan-line--2">take time</span>
          </span>
          <svg
            className="hero-scroll-mouse"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="5" y="2" width="14" height="20" rx="7" />
            <path className="mouse-wheel" d="M12 6v4" />
          </svg>
        </div>
      </div>
    </section>
  );
}
