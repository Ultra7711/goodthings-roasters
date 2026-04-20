/* ══════════════════════════════════════════
   HeroSection
   프로토타입 #hero-blk (라인 803–815) 이식
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef } from 'react';

export default function HeroSection() {
  const sloganRef = useRef<HTMLSpanElement>(null);
  const mouseRef = useRef<SVGSVGElement>(null);

  /* 프로토타입 라인 5094-5095:
     setTimeout 800ms → slogan hero--visible
     setTimeout 1400ms → mouse hero--visible */
  useEffect(() => {
    const t1 = setTimeout(() => sloganRef.current?.classList.add('hero--visible'), 800);
    const t2 = setTimeout(() => mouseRef.current?.classList.add('hero--visible'), 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <section className="blk" id="hero-blk" data-header-theme="dark">
      <div className="hero">
        <video className="hero-bg" autoPlay muted loop playsInline>
          <source src="/images/hero/hero-video.webm" type="video/webm" />
          <source src="/images/hero/hero-video.mp4" type="video/mp4" />
        </video>
        <div className="hero-bg-overlay" />
        <div className="hero-c">
          <span className="hero-slogan" ref={sloganRef}>
            good things,<br className="hero-slogan-br" /> take time
          </span>
          <svg
            ref={mouseRef}
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
