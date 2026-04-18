'use client';

/* ══════════════════════════════════════════
   RoasterySection (Visit)
   프로토타입 .roastery (라인 932–942) 이식
   - 영업 시간은 useShopStatus 훅으로 현재 상태 동적 표시
   - "VISIT" 섹션 의도(방문 유도)에 맞춰 4-state 라벨링
   ══════════════════════════════════════════ */

import { useShopStatus } from '@/hooks/useShopStatus';

function HoursLabel() {
  const status = useShopStatus();
  // SSR/첫 렌더링: 공백 placeholder (hydration 안전, 레이아웃 흔들림 방지)
  return (
    <span className="roastery-hours">{status?.label ?? '\u00A0'}</span>
  );
}

export default function RoasterySection() {
  return (
    <section className="blk" data-header-theme="dark" data-sr-toggle>
      <div className="roastery">
        <div className="roastery-bg sr-img" />
        <div className="roastery-c">
          <span className="roastery-lbl sr-txt sr-txt--d1">VISIT</span>
          <span className="roastery-h sr-txt sr-txt--d2">직접 만나보세요.</span>
          <span className="roastery-body sr-txt sr-txt--d3">
            경북 구미시 인동21길 22-11
            <HoursLabel />
          </span>
          <a
            className="roastery-cta-btn sr-txt sr-txt--d4"
            href="https://www.google.com/maps/place/%EA%B5%B3%EB%9D%B5%EC%A6%88/data=!3m1!4b1!4m6!3m5!1s0x3565c50004149c59:0x773edd85861bb816!8m2!3d36.0981256!4d128.4306089!16s%2Fg%2F11m6zd9r28!5m1!1e1?entry=ttu&g_ep=EgoyMDI2MDQwMS4wIKXMDSoASAFQAw%3D%3D"
            target="_blank"
            rel="noopener noreferrer"
          >
            오시는 길
          </a>
        </div>
      </div>
    </section>
  );
}
