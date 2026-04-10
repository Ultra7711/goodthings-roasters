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
      {/* 프로토타입 #hero-blk margin-top:-96px
          → 어나운스(36px) + 헤더(60px) 뒤로 섹션 확장 */}
      <div style={{ marginTop: '-96px' }}>
        <HeroSection />
      </div>
      <CafeMenuSection />
      <PhilSection />
      <BeansScrollSection />
      <TwoColSection />
      <RoasterySection />
      <GoodDaysSection />
    </>
  );
}
