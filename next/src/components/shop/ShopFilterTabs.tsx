'use client';

import { useEffect, useRef } from 'react';
import { FILTER_TABS, type FilterKey } from '@/lib/products';

type Props = {
  active: FilterKey;
  onChange: (key: FilterKey) => void;
};

export default function ShopFilterTabs({ active, onChange }: Props) {
  const tabsRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const isMounted = useRef(false);

  function positionIndicator(animate: boolean) {
    const tabs = tabsRef.current;
    const indicator = indicatorRef.current;
    if (!tabs || !indicator) return;

    const activeTab = tabs.querySelector<HTMLButtonElement>('.sp-filter-tab.active');
    if (!activeTab) return;

    const tabsRect = tabs.getBoundingClientRect();
    const tabRect = activeTab.getBoundingClientRect();
    const left = tabRect.left - tabsRect.left;
    const width = Math.round(tabRect.width);

    if (!animate) {
      indicator.style.transition = 'none';
      indicator.style.left = `${left}px`;
      indicator.style.width = `${width}px`;
      void indicator.offsetHeight; // reflow: transition 즉시 적용
      indicator.style.transition = '';
    } else {
      indicator.style.left = `${left}px`;
      indicator.style.width = `${width}px`;
    }
  }

  useEffect(() => {
    if (!isMounted.current) {
      // 최초 마운트: 애니메이션 없이 즉시 배치
      isMounted.current = true;
      positionIndicator(false);
    } else {
      // 탭 변경: CSS transition으로 슬라이드
      positionIndicator(true);
    }
  }, [active]);

  function handleTabClick(key: FilterKey) {
    if (key === active) return;
    onChange(key);
  }

  return (
    <div id="sp-filter-tabs" ref={tabsRef}>
      <div id="sp-filter-indicator" ref={indicatorRef} />
      {FILTER_TABS.map((tab) => (
        <button
          key={tab.key}
          className={`sp-filter-tab${active === tab.key ? ' active' : ''}`}
          onClick={() => handleTabClick(tab.key)}
          type="button"
        >
          <span className="sp-tab-label">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
