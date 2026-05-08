/* ══════════════════════════════════════════
   MyPageSideNav — V2 §3.2 좌측 sub-nav (S197 PR-2 §2.12)
   Shop/Menu 페이지 탭바 답습 — 2px gold absolute slide indicator + body-l 폰트.
   - 4 항목: orders / subscription / profile / account
   - 데스크탑: vertical (top/height slide) · 사이드 폭 var(--mp-nav-width) sticky
   - 모바일: horizontal (left/width slide) + sticky + edge fade mask + scrollIntoView
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef } from 'react';
import './MyPageSideNav.css';

export type MyPageNavId =
  | 'orders'
  | 'subscription'
  | 'profile'
  | 'account';

type Item = {
  id: MyPageNavId;
  label: string;
  count?: number;
};

type Props = {
  activeId: MyPageNavId;
  counts?: Partial<Record<MyPageNavId, number>>;
  onChange: (id: MyPageNavId) => void;
};

const ITEMS: Omit<Item, 'count'>[] = [
  { id: 'orders', label: '주문내역' },
  { id: 'subscription', label: '정기배송' },
  { id: 'profile', label: '프로필' },
  { id: 'account', label: '계정관리' },
];

const MOBILE_QUERY = '(max-width: 767px)';

export default function MyPageSideNav({ activeId, counts, onChange }: Props) {
  const listRef = useRef<HTMLUListElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const isMounted = useRef(false);

  function positionIndicator(animate: boolean) {
    const list = listRef.current;
    const indicator = indicatorRef.current;
    if (!list || !indicator) return;

    const activeBtn = list.querySelector<HTMLButtonElement>('.mp-side-nav-item.is-active');
    if (!activeBtn) return;

    const isMobile = window.matchMedia(MOBILE_QUERY).matches;

    const apply = () => {
      if (isMobile) {
        indicator.style.left = `${activeBtn.offsetLeft}px`;
        indicator.style.width = `${activeBtn.offsetWidth}px`;
        indicator.style.top = '';
        indicator.style.height = '';
      } else {
        indicator.style.top = `${activeBtn.offsetTop}px`;
        indicator.style.height = `${activeBtn.offsetHeight}px`;
        indicator.style.left = '';
        indicator.style.width = '';
      }
    };

    if (!animate) {
      indicator.style.transition = 'none';
      apply();
      void indicator.offsetHeight;
      indicator.style.transition = '';
    } else {
      apply();
    }
  }

  /* 모바일 수평 스크롤 fade mask 상태 */
  function updateScrollState() {
    const list = listRef.current;
    if (!list) return;
    const { scrollLeft, scrollWidth, clientWidth } = list;
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll <= 1) list.dataset.scroll = 'none';
    else if (scrollLeft <= 1) list.dataset.scroll = 'start';
    else if (scrollLeft >= maxScroll - 1) list.dataset.scroll = 'end';
    else list.dataset.scroll = 'middle';
  }

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      positionIndicator(false);
    } else {
      positionIndicator(true);
    }
    /* 모바일에서 활성 탭이 화면 밖이면 가로 스크롤 진입.
       inline: 'center' — Shop / Cafe / LegalSideNav 와 통일 (S198).
       과거 root viewport 가로 scroll 부작용으로 'nearest' 다운그레이드 했으나,
       이후 모바일 .root { overflow-x: hidden } 도입으로 부작용 차단 완료. */
    if (window.matchMedia(MOBILE_QUERY).matches) {
      const list = listRef.current;
      const activeBtn = list?.querySelector<HTMLButtonElement>('.mp-side-nav-item.is-active');
      activeBtn?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
    updateScrollState();
  }, [activeId]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const onScroll = () => updateScrollState();
    const onResize = () => {
      positionIndicator(false);
      updateScrollState();
    };
    list.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    updateScrollState();
    return () => {
      list.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <nav className="mp-side-nav" aria-label="마이페이지 내비게이션">
      <ul className="mp-side-nav-list" ref={listRef}>
        <span className="mp-side-nav-indicator" ref={indicatorRef} aria-hidden="true" />
        {ITEMS.map((item) => {
          const count = counts?.[item.id];
          const isActive = activeId === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`mp-side-nav-item${isActive ? ' is-active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onChange(item.id)}
                data-gtr-tap
              >
                <span className="mp-side-nav-label">{item.label}</span>
                {typeof count === 'number' && count > 0 && (
                  <span className="mp-side-nav-count">{count}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
