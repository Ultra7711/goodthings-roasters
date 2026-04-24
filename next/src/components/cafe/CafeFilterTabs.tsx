/* ══════════════════════════════════════════
   CafeFilterTabs (RP-5)
   프로토타입 #cm-filter-tabs + `_cmPositionIndicator()` 이식.
   - ShopFilterTabs 와 동일한 스냅 패턴: 첫 마운트는 animate=false, 이후 탭 변경만 animate=true.
   - 전용 CSS 클래스(`.cm-filter-*`) 로 격리 — ShopFilterTabs 직접 import 금지 원칙 준수.
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef } from 'react';
import { CAFE_FILTER_TABS, type CafeFilterKey } from '@/lib/cafeMenu';

type Props = {
  active: CafeFilterKey;
  onChange: (key: CafeFilterKey) => void;
};

export default function CafeFilterTabs({ active, onChange }: Props) {
  const tabsRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const isMounted = useRef(false);

  function positionIndicator(animate: boolean) {
    const tabs = tabsRef.current;
    const indicator = indicatorRef.current;
    if (!tabs || !indicator) return;

    const activeTab = tabs.querySelector<HTMLButtonElement>('.cm-filter-tab.active');
    if (!activeTab) return;

    /* offsetLeft/Width 는 스크롤 컨테이너의 padding-box(스크롤 콘텐츠) 좌표계 —
       absolute positioned indicator 가 같은 좌표계이므로 스크롤과 무관하게 정확 */
    const left = activeTab.offsetLeft;
    const width = activeTab.offsetWidth;

    if (!animate) {
      indicator.style.transition = 'none';
      indicator.style.left = `${left}px`;
      indicator.style.width = `${width}px`;
      void indicator.offsetHeight;
      indicator.style.transition = '';
    } else {
      indicator.style.left = `${left}px`;
      indicator.style.width = `${width}px`;
    }
  }

  /* 모바일 수평 스크롤 페이드 상태 — start / middle / end */
  function updateScrollState() {
    const tabs = tabsRef.current;
    if (!tabs) return;
    const { scrollLeft, scrollWidth, clientWidth } = tabs;
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll <= 1) {
      tabs.dataset.scroll = 'none';
    } else if (scrollLeft <= 1) {
      tabs.dataset.scroll = 'start';
    } else if (scrollLeft >= maxScroll - 1) {
      tabs.dataset.scroll = 'end';
    } else {
      tabs.dataset.scroll = 'middle';
    }
  }

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      positionIndicator(false);
    } else {
      positionIndicator(true);
    }
    /* 활성 탭을 뷰포트 중앙으로 스크롤 (모바일 수평 스크롤) */
    const tabs = tabsRef.current;
    const activeTab = tabs?.querySelector<HTMLButtonElement>('.cm-filter-tab.active');
    activeTab?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    updateScrollState();
  }, [active]);

  /* 스크롤·리사이즈 → indicator 재배치 + 페이드 상태 갱신 */
  useEffect(() => {
    const tabs = tabsRef.current;
    if (!tabs) return;
    const onScroll = () => {
      updateScrollState();
    };
    tabs.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    updateScrollState();
    return () => {
      tabs.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div id="cm-filter-wrap" className="page-filter-wrap">
      <div id="cm-filter-tabs" ref={tabsRef}>
        <div id="cm-filter-indicator" ref={indicatorRef} />
        {CAFE_FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`cm-filter-tab${active === tab.key ? ' active' : ''}`}
            onClick={() => onChange(tab.key)}
            type="button"
          >
            <span className="cm-tab-label">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
