/* ══════════════════════════════════════════
   Home Page — V2 §2 메인 5섹션 통합 (S153 §2.6)
   1) Hero · 2) Signature · 3) Lineup · 4) CafeMenu · 5) StoryChapter (cream→dark)
   ══════════════════════════════════════════ */

import { preload } from 'react-dom';
import '@/components/home/HomePage.css';
import HeroSection from '@/components/home/HeroSection';
import OverscrollTop from '@/components/ui/OverscrollTop';
import SignatureChapter from '@/components/home/SignatureChapter';
import CafeMenuSection from '@/components/home/CafeMenuSection';
import LineupSection from '@/components/home/LineupSection';
import StoryChapter from '@/components/home/StoryChapter';
import NewsletterSection from '@/components/home/NewsletterSection';

export const metadata = {
  alternates: { canonical: '/' },
};

export default function HomePage() {
  /* S-PND-5: hero MP4 page-scoped preload. layout.tsx 박힘 = 모든 페이지 비용 회피 — home 진입 시에만 fetch 시작. */
  preload('/images/hero/hero-video.mp4', { as: 'video', fetchPriority: 'high' });

  return (
    <div id="home-body">
      <OverscrollTop top="#1E1B16" bottom="#4A4845" />
      {/* #hero-blk margin-top:-96px는 globals.css에서 적용 */}
      <HeroSection />
      <SignatureChapter />
      <LineupSection />
      <CafeMenuSection />
      <StoryChapter />
      <NewsletterSection />
    </div>
  );
}
