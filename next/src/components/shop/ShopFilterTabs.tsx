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

    /* offsetLeft/Width 는 스크롤 컨테이너 padding-box(스크롤 콘텐츠) 좌표계 —
       absolute positioned indicator 와 동일 좌표계이므로 스크롤과 무관하게 정확 */
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

  /* 모바일 수평 스크롤 페이드 상태 — start / middle / end / none */
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
    /* 활성 탭을 가로 중앙으로 스크롤 (모바일 수평 스크롤).
       S334: scrollIntoView 는 block:'nearest' 라도 window 세로축을 건드릴 수 있어
       모바일에서 ?item= 진입 카드 smooth scroll(GenericCard)과 세로축 경합 → 역방향
       떨림 유발. 가로 컨테이너의 scrollLeft 만 직접 조정해 window 세로 누수 원천 차단.
       offsetLeft 는 스크롤 콘텐츠 좌표계이므로 scrollLeft 타깃으로 그대로 사용. */
    const tabs = tabsRef.current;
    const activeTab = tabs?.querySelector<HTMLButtonElement>('.sp-filter-tab.active');
    if (tabs && activeTab) {
      const target = activeTab.offsetLeft - (tabs.clientWidth - activeTab.offsetWidth) / 2;
      tabs.scrollTo({ left: target, behavior: 'smooth' });
    }
    updateScrollState();
  }, [active]);

  useEffect(() => {
    const tabs = tabsRef.current;
    if (!tabs) return;
    const onScroll = () => updateScrollState();
    tabs.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    updateScrollState();
    return () => {
      tabs.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  function handleTabClick(key: FilterKey) {
    if (key === active) return;
    onChange(key);
  }

  return (
    <div id="sp-filter-wrap" className="page-filter-wrap">
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
    </div>
  );
}
