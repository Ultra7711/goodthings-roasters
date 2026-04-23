/* ══════════════════════════════════════════
   HeroSection
   프로토타입 #hero-blk (라인 803–815) 이식

   BUG-006 Stage D-3 (2026-04-24):
   - cacheComponents 활성화로 Activity hidden 시에도 <video> 가 계속 재생되어
     모바일 배터리·데이터 소모 지속. useEffect cleanup 으로 pause,
     visible 복귀 시 자동 재개. SSR 유지 위해 video 태그는 그대로 두고
     client directive 만 추가 (hydration cost 미미 — 단일 ref + effect).
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef } from 'react';

export default function HeroSection() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    /* Activity visible 복귀 시 재생 보장 — autoplay 정책은 muted 속성으로 충족 */
    void video.play().catch(() => {
      /* 일부 브라우저 autoplay 정책으로 거부될 수 있음 — 사용자 제스처 후 재시도 */
    });
    return () => {
      /* Activity hidden / unmount 시 일시정지 — currentTime 은 유지되어 복귀 시 이어재생 */
      video.pause();
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
