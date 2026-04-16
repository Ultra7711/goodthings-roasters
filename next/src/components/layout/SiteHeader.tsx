/* ══════════════════════════════════════════
   SiteHeader
   프로토타입 #site-hdr-wrap + #search-drop + #search-dim 이식
   - #site-hdr-wrap: position:sticky (CSS 직접)
   - search-drop, search-dim: createPortal → document.body
   - sticky wrapper div 없음 (stacking context 오염 방지)
   ══════════════════════════════════════════ */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useHeaderTheme } from '@/hooks/useHeaderTheme';
import { getInitialHeaderTheme } from '@/lib/headerThemeConfig';
import { useAuthStore, useCartStore } from '@/lib/store';
import { ClearIcon } from '@/components/ui/InputIcons';

export default function SiteHeader() {
  const headerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* 페이지별 초기 테마 — 플래시 방지 */
  const pathname = usePathname();
  const router = useRouter();
  const initialTheme = getInitialHeaderTheme(pathname);
  const { isDark, skipTransition } = useHeaderTheme(headerRef, initialTheme);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [mounted, setMounted] = useState(false);

  /* SSR 안전: 클라이언트에서만 store 값 사용 */
  const totalQty = useCartStore((s) => s.totalQty());
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const openDrawer = useCartStore((s) => s.openDrawer);

  useEffect(() => {
    // SSR hydration 이후 mount flag 세팅 — 의도적 1회성 setState-in-effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  /* 검색 열기/닫기 */
  /* 검색 패널 실제 렌더 높이 60px + border 0.5px ≈ 60.5px.
     dim-top = headerBottom + 61 로 gap을 최소화 (프로토타입은 +60 사용). */
  const SEARCH_PANEL_HEIGHT = 61;
  /** 헤더 높이 기본값 — getBoundingClientRect 실패 시 fallback (CSS 헤더 높이와 동기화) */
  const HEADER_HEIGHT_FALLBACK = 60;
  /** 검색 패널 렌더 완료 후 포커스 지연 ms */
  const SEARCH_FOCUS_DELAY_MS = 20;

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchValue('');
    document.body.style.overflow = '';
  }, []);

  /* 클리어 버튼: 입력값 초기화 + 포커스 유지.
     onMouseDown 에서 preventDefault 를 호출해 버튼 mousedown 으로 인한
     인풋 blur 를 방지 → 클릭 후에도 포커스 + 캐럿 유지. */
  function handleSearchClear() {
    setSearchValue('');
    searchInputRef.current?.focus();
  }

  /* Enter 제출 → /search?q=<encoded> 네비게이션.
     - 빈 쿼리는 무시 (prototype 동작 일치).
     - closeSearch() 선제 호출로 패널·딤·body.overflow 정리 후 이동. */
  function handleSearchSubmit() {
    const q = searchValue.trim();
    if (!q) return;
    closeSearch();
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearchSubmit();
    }
  }

  /* 로고 클릭 → 홈으로 복귀
     - 홈(`/`)에서: Next.js Link 는 same-path 클릭을 스킵하므로 preventDefault
       후 직접 초기화 수행 (프로토타입의 goHome() 대응).
     - 다른 라우트에서: Link 기본 동작으로 `/` 로 네비게이션 → Next.js 가
       scroll restoration 을 자동 처리. closeSearch 만 선제 호출해 검색 패널이
       열린 채 이동하는 상태를 방지. */
  function handleLogoClick(e: React.MouseEvent<HTMLAnchorElement>) {
    closeSearch();
    if (pathname === '/') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }

  /* Shop 링크 클릭 → 샵 페이지 초기 상태로 복귀
     - /shop 내에서 클릭 시: Next.js Link same-path 스킵 회피를 위해
       preventDefault 후 'gtr:shop-reset' 커스텀 이벤트 발송.
       ShopPage 가 이 이벤트를 수신해 filter='all' / page=1 로 리셋하고
       window 를 top 으로 스크롤한다. 로컬 state 는 컴포넌트 외부에서 직접
       조작할 수 없으므로 이벤트 기반 연결을 사용.
     - 다른 라우트에서 클릭 시: Link 기본 동작 그대로 /shop 네비게이션. */
  function handleShopClick(e: React.MouseEvent<HTMLAnchorElement>) {
    closeSearch();
    if (pathname === '/shop') {
      e.preventDefault();
      window.dispatchEvent(new Event('gtr:shop-reset'));
    }
  }

  /* Menu 링크 클릭 → 카페 메뉴 페이지 초기 상태로 복귀
     - /menu 내에서 클릭 시: preventDefault 후 'gtr:menu-reset' 발송.
       CafeMenuPage 가 수신해 filter='all' / page=1 리셋 + 스크롤 top + 카드
       remount (resetTick 증가) 로 등장 연출 재생.
     - Shop 과 동일한 패턴 (feedback_samepage_reentry_animation.md 참조). */
  function handleMenuClick(e: React.MouseEvent<HTMLAnchorElement>) {
    closeSearch();
    if (pathname === '/menu') {
      e.preventDefault();
      window.dispatchEvent(new Event('gtr:menu-reset'));
    }
  }

  /* Story 링크 클릭 → /story 진입 연출 재트리거
     - /story 내에서 클릭 시: preventDefault 후 'gtr:story-reset' 발송.
       StoryPage 가 수신해 스크롤 top + resetTick 증가 → 히어로 페이드 +
       sr-txt 리빌이 처음부터 재생.
     - Shop/Menu 와 동일한 same-page reentry 패턴
       (feedback_samepage_reentry_animation.md 참조). */
  function handleStoryClick(e: React.MouseEvent<HTMLAnchorElement>) {
    closeSearch();
    if (pathname === '/story') {
      e.preventDefault();
      window.dispatchEvent(new Event('gtr:story-reset'));
    }
  }

  /* Good Days 링크 클릭 → /gooddays 진입 연출 재트리거
     - /gooddays 내에서 클릭 시: preventDefault 후 'gtr:gooddays-reset' 발송.
       GoodDaysPage 가 수신해 스크롤 top + resetTick 증가 → 타이틀 페이드 +
       그리드 IO 리빌이 처음부터 재생. */
  function handleGoodDaysClick(e: React.MouseEvent<HTMLAnchorElement>) {
    closeSearch();
    if (pathname === '/gooddays') {
      e.preventDefault();
      window.dispatchEvent(new Event('gtr:gooddays-reset'));
    }
  }

  function openSearch() {
    const headerBottom = headerRef.current?.getBoundingClientRect().bottom ?? HEADER_HEIGHT_FALLBACK;
    document.documentElement.style.setProperty('--search-drop-top', `${headerBottom}px`);
    document.documentElement.style.setProperty('--dim-top', `${headerBottom + SEARCH_PANEL_HEIGHT}px`);
    document.body.style.overflow = 'hidden';
    setIsSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), SEARCH_FOCUS_DELAY_MS);
  }

  /* 언마운트 시 body.overflow 강제 해제 */
  useEffect(() => {
    return () => { document.body.style.overflow = ''; };
  }, []);

  /* ESC 키로 검색 닫기 */
  useEffect(() => {
    if (!isSearchOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeSearch();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isSearchOpen, closeSearch]);

  return (
    <>
      {/* ── 메인 헤더 바 (position:sticky via CSS) ──
          backdrop-filter는 Tailwind v4 / Lightning CSS가 CSS 파일의 선언을
          drop하는 이슈가 있어 inline style로 우회 적용. */}
      <div
        ref={headerRef}
        id="site-hdr-wrap"
        className={
          (isDark ? 'blk hdr-dark' : 'blk') + (skipTransition ? ' hdr-instant' : '')
        }
        style={{
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        <div className="hdr">
          {/* 로고 */}
          <div className="hdr-left">
            <Link href="/" aria-label="Good Things Roasters 홈" onClick={handleLogoClick}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                id="logo-img"
                src="/images/icons/logo.svg"
                style={{ height: '30px', width: 'auto', display: 'block', cursor: 'pointer' }}
                alt="good things"
              />
            </Link>
          </div>

          {/* 네비게이션 */}
          <nav className="hdr-nav" aria-label="메인 내비게이션">
            <Link href="/story" className="nav-link" onClick={handleStoryClick}>The Story</Link>
            <Link href="/menu" className="nav-link" onClick={handleMenuClick}>Menu</Link>
            <Link href="/shop" className="nav-link" onClick={handleShopClick}>Shop</Link>
            <Link href="/gooddays" className="nav-link" onClick={handleGoodDaysClick}>Good Days</Link>
          </nav>

          {/* 아이콘 버튼 그룹 */}
          <div className="hdr-icons">
            {/* 검색 */}
            <button
              className="hdr-icon-btn"
              id="search-btn"
              type="button"
              aria-label="검색"
              onClick={openSearch}
            >
              <svg className="hi" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10">
                <circle cx="10" cy="10" r="7" />
                <line x1="17" y1="17" x2="21" y2="21" />
              </svg>
            </button>

            {/* 로그인 / 마이페이지 */}
            <Link
              href={mounted && isLoggedIn ? '/mypage' : '/login'}
              className="hdr-icon-btn"
              aria-label={mounted && isLoggedIn ? '마이페이지' : '로그인'}
            >
              {/* 비로그인 아이콘 */}
              <svg
                className="hi hi-login"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeMiterlimit="10"
                style={{ display: mounted && isLoggedIn ? 'none' : 'block' }}
              >
                <circle cx="12" cy="8" r="5" />
                <path d="M19,21c0-2.6-2.3-4-7-4s-7,1.4-7,4" strokeLinecap="round" />
              </svg>
              {/* 로그인 아이콘 */}
              <svg
                className="hi hi-logined"
                viewBox="0 0 24 24"
                fill="currentColor"
                style={{ display: mounted && isLoggedIn ? 'block' : 'none' }}
              >
                <path d="M12,0C5.37,0,0,5.37,0,12s5.37,12,12,12,12-5.37,12-12S18.63,0,12,0ZM11.39,2.03c.2-.01.41-.03.61-.03s.41.02.61.03c3.02.31,5.39,2.87,5.39,5.97,0,3.31-2.69,6-6,6s-6-2.69-6-6c0-3.1,2.37-5.66,5.39-5.97ZM12,22c-2.93,0-5.57-1.28-7.4-3.3.9-1.49,2.98-2.7,7.4-2.7s6.5,1.22,7.4,2.7c-1.83,2.02-4.46,3.3-7.4,3.3Z" />
              </svg>
            </Link>

            {/* 장바구니 */}
            <button
              className="hdr-icon-btn"
              id="main-cart-icon-btn"
              type="button"
              aria-label="장바구니"
              onClick={openDrawer}
            >
              <svg className="hi" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="21" r="1" />
                <circle cx="19" cy="21" r="1" />
                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
              </svg>
              {/* 배지 */}
              {mounted && totalQty > 0 && (
                <span className="cart-badge visible" id="main-cart-badge">
                  {totalQty}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── 검색 드롭 패널 (portal → body) ── */}
      {mounted &&
        createPortal(
          <div
            id="search-drop"
            className={isSearchOpen ? 'open' : ''}
            style={{
              backdropFilter: 'blur(16px) saturate(180%)',
              WebkitBackdropFilter: 'blur(16px) saturate(180%)',
            }}
          >
            <div id="search-drop-inner">
              <span id="search-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10">
                  <circle cx="10" cy="10" r="7" />
                  <line x1="17" y1="17" x2="21" y2="21" />
                </svg>
              </span>
              <input
                ref={searchInputRef}
                id="search-input"
                type="text"
                placeholder="무엇을 찾으시나요?"
                autoComplete="off"
                spellCheck={false}
                aria-label="상품 검색"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
              {searchValue && (
                <button
                  id="search-clear"
                  type="button"
                  aria-label="검색어 지우기"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleSearchClear}
                >
                  <ClearIcon />
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}

      {/* ── 검색 딤 오버레이 (portal → body) ── */}
      {mounted &&
        createPortal(
          <div
            id="search-dim"
            className={isSearchOpen ? 'open' : ''}
            onClick={closeSearch}
            style={{
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
          />,
          document.body,
        )}
    </>
  );
}
