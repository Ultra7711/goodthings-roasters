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
    /* 모바일에서 활성 탭을 가로 중앙으로 — list 내부 가로 scrollLeft 만 조정.
       S299-B: scrollIntoView({block:'nearest'}) 폐기 — window 세로 스크롤도 건드려
       MyPagePage 의 handleNavWithScroll(window.scrollTo) 와 세로 경쟁 → 탭 전환마다
       세로 미세 이동 누적(슬금슬금 top). list.scrollTo({left}) 로 가로만 → 세로 무영향. */
    if (window.matchMedia(MOBILE_QUERY).matches) {
      const list = listRef.current;
      const activeBtn = list?.querySelector<HTMLButtonElement>('.mp-side-nav-item.is-active');
      if (list && activeBtn) {
        const targetLeft =
          activeBtn.offsetLeft - (list.clientWidth - activeBtn.offsetWidth) / 2;
        list.scrollTo({ left: Math.max(targetLeft, 0), behavior: 'smooth' });
      }
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
      {/* S263 B-1 v5 — iOS 26 Safari Liquid Glass toolbar tinting fix.
          Safari 26 가 viewport edge 근처의 sticky element 의 background-color 를
          toolbar tint sampling 대상으로 사용. mp-side-nav 가 모바일 sticky +
          warm white bg → top toolbar tint 가 warm white 로 추출 (mypage 만 발생
          사용자 보고 증상). fix 가이드: "sticky element 자체에 background-color
          금지, absolute child 로 visual bg 분리". */}
      <div className="mp-side-nav-bg" aria-hidden />
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
