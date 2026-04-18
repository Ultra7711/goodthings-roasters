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

    const tabsRect = tabs.getBoundingClientRect();
    const tabRect = activeTab.getBoundingClientRect();
    const left = tabRect.left - tabsRect.left;
    const width = Math.round(tabRect.width);

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

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      positionIndicator(false);
    } else {
      positionIndicator(true);
    }
  }, [active]);

  return (
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
  );
}
