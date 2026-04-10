/* ══════════════════════════════════════════
   Home Page — P-2
   프로토타입 라인 803–993 홈 섹션 이식
   ══════════════════════════════════════════ */

'use client';

import { useSR } from '@/hooks/useSR';
import HeroSection from '@/components/home/HeroSection';
import CafeMenuSection from '@/components/home/CafeMenuSection';
import PhilSection from '@/components/home/PhilSection';
import BeansScrollSection from '@/components/home/BeansScrollSection';
import TwoColSection from '@/components/home/TwoColSection';
import RoasterySection from '@/components/home/RoasterySection';
import GoodDaysSection from '@/components/home/GoodDaysSection';

export default function HomePage() {
  /* 프로토타입 8978-8991: [data-sr] 전체 페이지 스크롤 리빌 */
  useSR();

  return (
    <>
      {/* #hero-blk margin-top:-96px는 globals.css에서 적용 */}
      <HeroSection />
      <CafeMenuSection />
      <PhilSection />
      <BeansScrollSection />
      <TwoColSection />
      <RoasterySection />
      <GoodDaysSection />
    </>
  );
}
