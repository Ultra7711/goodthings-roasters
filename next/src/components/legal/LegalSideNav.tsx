/* ══════════════════════════════════════════
   LegalSideNav — Legal 페이지 좌측 sub-nav (S197)
   MyPageSideNav 패턴 답습:
   - 데스크탑: vertical sub-nav · 좌측 2px gold absolute slide indicator
   - 모바일: horizontal row + sticky + edge fade mask + scrollIntoView nearest
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './LegalSideNav.css';

type Item = {
  slug: string;
  label: string;
};

type Props = {
  items: readonly Item[];
};

const MOBILE_QUERY = '(max-width: 767px)';

export default function LegalSideNav({ items }: Props) {
  const pathname = usePathname();
  const segments = pathname?.split('/') ?? [];
  const activeSlug = segments[2] ?? '';

  const listRef = useRef<HTMLUListElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const isMounted = useRef(false);

  function positionIndicator(animate: boolean): void {
    const list = listRef.current;
    const indicator = indicatorRef.current;
    if (!list || !indicator) return;
    const activeBtn = list.querySelector<HTMLAnchorElement>('.legal-side-link.active');
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
    if (window.matchMedia(MOBILE_QUERY).matches) {
      const list = listRef.current;
      const activeBtn = list?.querySelector<HTMLAnchorElement>('.legal-side-link.active');
      activeBtn?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
    updateScrollState();
  }, [activeSlug]);

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

  /**
   * 모바일에서 탭 클릭 시 즉시 center 위치로 스크롤 보정.
   * Link 라우트 전환은 비동기 → useEffect 의 scrollIntoView 만 의존 시
   * 사용자 인지 시점까지 지연. onClick 시점에 클릭 element 를 직접 호출.
   * dynamic [slug] 마운트/언마운트로 isMounted ref 가 reset 되는 케이스도 커버.
   * inline: 'center' 는 ShopFilterTabs / CafeFilterTabs 와 동일 옵션.
   */
  function handleLinkClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (typeof window === 'undefined') return;
    if (!window.matchMedia(MOBILE_QUERY).matches) return;
    e.currentTarget.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }

  return (
    <aside className="legal-side" aria-label="약관 메뉴">
      <nav>
        <ul className="legal-side-list" ref={listRef}>
          <span className="legal-side-indicator" ref={indicatorRef} aria-hidden="true" />
          {items.map((item) => {
            const active = item.slug === activeSlug;
            return (
              <li key={item.slug}>
                <Link
                  href={`/legal/${item.slug}`}
                  className={`legal-side-link${active ? ' active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                  onClick={handleLinkClick}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
