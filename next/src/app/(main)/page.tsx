/* ══════════════════════════════════════════
   Home Page — V2 §2 메인 5섹션 통합 (S153 §2.6)
   1) Hero · 2) Signature · 3) Lineup · 4) CafeMenu · 5) StoryChapter (cream→dark)
   ══════════════════════════════════════════ */

import '@/components/home/HomePage.css';
import HeroSection from '@/components/home/HeroSection';
import OverscrollTop from '@/components/ui/OverscrollTop';
import SignatureChapter from '@/components/home/SignatureChapter';
import CafeMenuSection from '@/components/home/CafeMenuSection';
import LineupSection from '@/components/home/LineupSection';
import StoryChapter from '@/components/home/StoryChapter';
import NewsletterSection from '@/components/home/NewsletterSection';

export default function HomePage() {
  return (
    <div id="home-body">
      <OverscrollTop top="#1E1B16" />
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
