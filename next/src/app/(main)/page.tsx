/* ══════════════════════════════════════════
   Home Page — P-2
   프로토타입 라인 803–993 홈 섹션 이식
   ══════════════════════════════════════════ */

import HeroSection from '@/components/home/HeroSection';
import CafeMenuSection from '@/components/home/CafeMenuSection';
import PhilSection from '@/components/home/PhilSection';
import BeansScrollSection from '@/components/home/BeansScrollSection';
import TwoColSection from '@/components/home/TwoColSection';
import RoasterySection from '@/components/home/RoasterySection';
import GoodDaysSection from '@/components/home/GoodDaysSection';
export default function HomePage() {
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
