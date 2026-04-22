'use client';

/* ══════════════════════════════════════════
   RoasterySection (Visit)
   프로토타입 .roastery (라인 932–942) 이식
   - 영업 시간은 useShopStatus 훅으로 현재 상태 동적 표시
   - "VISIT" 섹션 의도(방문 유도)에 맞춰 4-state 라벨링
   ══════════════════════════════════════════ */

import Link from 'next/link';
import { useShopStatus } from '@/hooks/useShopStatus';
import { emphasizeHours } from '@/lib/emphasizeHours';

function HoursLabel() {
  const status = useShopStatus();
  // SSR/첫 렌더링: 공백 placeholder (hydration 안전, 레이아웃 흔들림 방지)
  return (
    <span className="roastery-hours">
      {status?.label ? emphasizeHours(status.label) : '\u00A0'}
    </span>
  );
}

export default function RoasterySection() {
  return (
    <section className="blk" data-header-theme="dark" data-sr-toggle>
      <div className="roastery">
        <div className="roastery-bg sr-img">
          <div className="grain-overlay" aria-hidden="true" />
        </div>
        <div className="roastery-c">
          <span className="roastery-lbl sr-txt sr-txt--d1">VISIT</span>
          <span className="roastery-h ed-h2 sr-txt sr-txt--d2 vfw">느긋한 한 잔, 가까이에.</span>
          <span className="roastery-body sr-txt sr-txt--d3">
            경북 구미시 인동21길 22-11
            <HoursLabel />
          </span>
          <Link
            className="roastery-cta-btn sr-txt sr-txt--d4"
            href="/story#location"
          >
            매장 정보
          </Link>
        </div>
      </div>
    </section>
  );
}
