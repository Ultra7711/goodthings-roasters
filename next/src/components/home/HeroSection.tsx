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

import { useEffect, useRef, useState } from 'react';

export default function HeroSection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const posterElRef = useRef<HTMLDivElement>(null);
  /* S-PND-5: poster 별도 layer 가시성 — video 가 실제 첫 frame 표시 가능 시점에 fade out. */
  const [posterHidden, setPosterHidden] = useState(false);
  /* S-PND-5 P0a: cleanup 직전 video 의 현재 frame 을 dataURL 로 capture 해 보관.
     재진입 시 .hero-bg-poster background 동적 갱신 + Web Animations API 로 fade-in.
     useRef = Activity hidden 동안에도 mount 유지로 값 보존. */
  const capturedFrameRef = useRef<string | null>(null);

  /* S-PND-5 P0a: Activity visible 복귀 시 captured frame fade-in (/story 패턴 일관).
     Web Animations API 사용 — keyframes 명시 (0 → 1) 로 시작점 보장.
     React state/className/CSS transition timing 의존 회피.
     cleanup 시 captured frame 이 .hero-bg-poster 의 backgroundImage 로 적용된 상태. */
  useEffect(() => {
    const posterEl = posterElRef.current;
    if (!posterEl || !capturedFrameRef.current) return;
    const anim = posterEl.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: 400, easing: 'ease-out', fill: 'forwards' },
    );
    setPosterHidden(false);
    return () => anim.cancel();
  }, []);

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

    /* S-PND-5 P0a: 자동 재생 — /story 패턴 일관.
       cold load (capturedFrame null) = 즉시 play (기존 동작).
       재진입 (capturedFrame 있음) = 400ms 지연 후 play → captured frame fade-in 완료 후 video paint. */
    if (!capturedFrameRef.current) {
      void video.play().catch(() => {});
    } else {
      timers.push(setTimeout(() => {
        void video.play().catch(() => {});
      }, 400));
    }

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

      /* S-PND-5 P0a: cleanup 시점에 video 의 현재 frame 을 dataURL 로 capture →
         다음 visible cycle 의 fade-in 시작점 (captured frame backgroundImage) 으로 활용.
         readyState >= 2 (HAVE_CURRENT_DATA) + videoWidth > 0 = paint 가능 frame 존재.
         4 sample pixel 평균 brightness < 5 = iOS Safari GPU issue (WebKit Bug 237424) 또는
         검은 scene → 폐기 (capturedFrameRef 갱신 안 함 = 기존 동작 fallback). */
      try {
        if (video.readyState >= 2 && video.videoWidth > 0) {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const samples = [
              ctx.getImageData(canvas.width >> 2, canvas.height >> 2, 1, 1).data,
              ctx.getImageData((canvas.width * 3) >> 2, canvas.height >> 2, 1, 1).data,
              ctx.getImageData(canvas.width >> 2, (canvas.height * 3) >> 2, 1, 1).data,
              ctx.getImageData((canvas.width * 3) >> 2, (canvas.height * 3) >> 2, 1, 1).data,
            ];
            const avgBrightness =
              samples.reduce((s, px) => s + px[0] + px[1] + px[2], 0) / (samples.length * 3);
            if (avgBrightness >= 5) {
              capturedFrameRef.current = canvas.toDataURL('image/jpeg', 0.75);
              /* cleanup 시점에 .hero-bg-poster backgroundImage 적용 → 다음 visible cycle
                 first paint 시 captured frame 이 이미 적용된 상태에서 fade-in 시작. */
              const posterEl = document.querySelector('.hero-bg-poster') as HTMLElement | null;
              if (posterEl) {
                posterEl.style.backgroundImage = `url(${capturedFrameRef.current})`;
              }
              /* video element 자체 invisible 처리 → visible 복귀 first paint 시 video element
                 (z:1) 의 last frame buffer paint 가 .hero-bg-poster (z:0) 의 fade-in animation
                 을 가리는 issue 차단. onPlaying 시 복원. */
              const videoEl = document.querySelector('video.hero-bg') as HTMLVideoElement | null;
              if (videoEl) {
                videoEl.style.visibility = 'hidden';
              }
            }
          }
        }
      } catch {
        /* swallow — cross-origin tainted · iOS GPU access denied 등 */
      }

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
        {/* 포스터 로드 전 gradient placeholder — 순수 다크에서 이미지로 전환 시 충격 완화. */}
        <div className="hero-bg-placeholder" aria-hidden="true" />
        {/* S-PND-5: poster 별도 layer — video preload 대기 없이 즉시 표시. video playing 시 fade out.
            P0a: 재진입 시 captured frame 이 cleanup 에서 backgroundImage 로 적용된 후 useEffect 에서 Web Animations API fade-in. */}
        <div
          ref={posterElRef}
          className={`hero-bg-poster${posterHidden ? ' is-hidden' : ''}`}
          aria-hidden="true"
        />
        <video
          ref={videoRef}
          className="hero-bg"
          autoPlay muted loop playsInline
          preload="auto"
          // @ts-expect-error — React 19 VideoHTMLAttributes 에 fetchPriority 미정의 (HTML 표준은 허용)
          fetchPriority="high"
          /* S-PND-5 P0a: poster attribute 폐기 — paused 상태의 video element (z:1) 가 poster
             이미지를 위 paint 하여 .hero-bg-poster (z:0) 의 fade-in animation 을 가리는 issue 차단.
             Cold load fallback = .hero-bg-poster 의 CSS background-image (hero-poster.jpg). */
          onPlaying={() => {
            setPosterHidden(true);
            /* S-PND-5 P0a: video element visibility 복원 (cleanup 시 hidden 처리한 것 reset). */
            const v = videoRef.current;
            if (v) v.style.visibility = '';
          }}
        >
          {/* S-PND-5: source 순서 = MP4 1순위 (모든 환경 HW 가속 H.264) + AV1 2순위 fallback.
              S-PND-4 의 AV1 1순위 → 디코딩 대기 + 빈 화면 길어짐 회귀 해소. WebM 자산 폐기.
              MP4 (6.8MB · H.264 High · 720kbps 원본) / AV1 (7.45MB · CRF28 preset4 · 거의 미사용). */}
          <source src="/images/hero/hero-video.mp4" type="video/mp4" />
          <source src="/images/hero/hero-video.av1.mp4" type='video/mp4; codecs="av01"' />
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
