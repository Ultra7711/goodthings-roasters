/* ══════════════════════════════════════════
   SiteHeader
   프로토타입 #site-hdr-wrap + #search-drop + #search-dim 이식
   - #site-hdr-wrap: position:sticky (CSS 직접)
   - search-drop, search-dim: createPortal → document.body
   - sticky wrapper div 없음 (stacking context 오염 방지)
   ══════════════════════════════════════════ */

'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useHeaderTheme } from '@/hooks/useHeaderTheme';
import { getInitialHeaderTheme } from '@/lib/headerThemeConfig';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { useCartQuery } from '@/hooks/useCart';
import { useCartDrawer } from '@/contexts/CartDrawerContext';
import { useDrawer } from '@/hooks/useDrawer';
import { ClearIcon } from '@/components/ui/InputIcons';
import MobileNavDrawer from '@/components/layout/MobileNavDrawer';

/* ── 모듈 스코프 상수 — 렌더마다 재생성 방지 ───────────────
   검색 패널 실제 렌더 높이 60px (border 제거됨 — 공지바/헤더 hairline 일괄 제거와 일관).
   dim-top = headerBottom + 60 로 gap 0 맞춤. */
const SEARCH_PANEL_HEIGHT = 60;
/** 헤더 높이 기본값 — getBoundingClientRect 실패 시 fallback (CSS 헤더 높이와 동기화) */
const HEADER_HEIGHT_FALLBACK = 60;
/** 검색 쿼리 최대 길이 — DoS 가드 (브라우저 메인 스레드 정지 방지) */
const SEARCH_QUERY_MAX_LENGTH = 100;

export default function SiteHeader() {
  const headerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* 페이지별 초기 테마 — 플래시 방지 */
  const pathname = usePathname();
  const router = useRouter();

  /* BUG-130 Prototype A (S73): 헤더 테마 전환 타이밍을 본문 visibility 복원과 동기화.
     기존에는 pathname 변경 즉시 initialTheme 재계산 → useHeaderTheme 의 useLayoutEffect
     가 즉시 발화 → 헤더 색이 new theme 으로 전환. 그러나 NavigationVisibilityGate 가
     본문 visibility 를 복원하기 전이라 "헤더만 먼저 색 반전 → 본문 뒤따라 전환" 의
     시각 순서 불일치가 사용자에게 깜빡임으로 체감 (§11-H1 측정 case 1 에서 14ms gap).

     해결: NavigationVisibilityGate 의 useLayoutEffect 에서 dispatch 하는 'gtr:route-change'
     이벤트 (기존 자산) 를 수신하여 effectivePath 갱신. gate-LE 와 동일 tick 에 테마 전환
     → 본문-헤더 동시 snap.

     주의: effectivePath 는 테마 계산에만 사용. pathname 자체는 aria-current 표시·
     same-path 클릭 판정 등에서 즉시 반영 필요하므로 그대로 유지. */
  const [effectivePath, setEffectivePath] = useState(pathname);
  useEffect(() => {
    function onRouteChange(e: Event) {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === 'string') setEffectivePath(detail);
    }
    window.addEventListener('gtr:route-change', onRouteChange);
    return () => window.removeEventListener('gtr:route-change', onRouteChange);
  }, []);

  const initialTheme = getInitialHeaderTheme(effectivePath);
  const { isDark, skipTransition, atTop } = useHeaderTheme(headerRef, initialTheme, effectivePath);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [mounted, setMounted] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  /* SSR 안전: 클라이언트에서만 store 값 사용 */
  const { totalQty } = useCartQuery();
  const { isLoggedIn, isLoading: sessionLoading } = useSupabaseSession();
  const { open: openDrawer } = useCartDrawer();

  useLayoutEffect(() => {
    // SSR hydration 이후 mount flag 세팅 — 페인트 전 동기 실행으로 헤더 flash 방지.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  /* BUG-006 Stage D-4 (2026-04-24): pathname 변경 시 모바일 네비 드로어 자동 close.
     Activity stale 방어용 — history API 기반 close (아래) 와 중복이지만
     라우트 전환 시 drawer 가 남는 edge case 방지. */
  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  const closeSearch = useCallback(() => {
    searchInputRef.current?.blur();
    setIsSearchOpen(false);
    setSearchValue('');
  }, []);

  /* S74 DB-03: 검색 패널 scroll lock 을 useDrawer 훅으로 통일.
     - body.overflow 단독 토글은 iOS Safari 에서 touch scroll 관통 발생 →
       useDrawer 의 scrollbar-gutter + paddingRight + overflow 조합으로 강화
     - ESC 리스너도 훅 내부에서 처리 (중복 제거)
     - restoreFocus=false: openSearch 가 input 에 focus 를 이동시키므로 trigger 저장
       시점 activeElement=input → close 시 input 재-focus 로 가상 키보드 재호출 방지 */
  useDrawer({ open: isSearchOpen, onClose: closeSearch, restoreFocus: false });

  /* BUG-006 Stage D-4 2단계 (2026-04-24): history API 기반 drawer close.
     모바일 네이티브 UX — drawer 열기 시 history entry 추가, 브라우저 back 으로
     drawer 만 닫고 페이지는 유지.

     경로 구분:
     - openMobileNav: pushState({gtrMobileNav:true}) → back 버튼으로 close 가능
     - closeMobileNav: X/ESC/backdrop/same-path 용 — history.back() 으로 marker 제거
     - closeMobileNavForNavigation: Link 클릭 전용 — state 만 false (Link 가 router.push 할 예정) */
  const openMobileNav = useCallback(() => {
    closeSearch();
    if (typeof window !== 'undefined') {
      window.history.pushState({ gtrMobileNav: true }, '', window.location.href);
    }
    setIsMobileNavOpen(true);
  }, [closeSearch]);

  const closeMobileNav = useCallback(() => {
    const state = (typeof window !== 'undefined'
      ? (window.history.state as { gtrMobileNav?: boolean } | null)
      : null);
    if (state?.gtrMobileNav) {
      /* marker entry 가 있으면 back 으로 제거 → popstate 에서 state 업데이트 */
      window.history.back();
    } else {
      setIsMobileNavOpen(false);
    }
  }, []);

  const closeMobileNavForNavigation = useCallback(() => {
    setIsMobileNavOpen(false);
  }, []);

  /* popstate — 브라우저 back 버튼으로 drawer marker entry 벗어날 때 state 정리.
     이미 false 여도 noop. */
  useEffect(() => {
    function onPopState() {
      setIsMobileNavOpen(false);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
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
    /* S74 DB-03 2단계: 딤을 헤더 바로 아래부터 시작 (이전: headerBottom + SEARCH_PANEL_HEIGHT).
       검색 패널 z-index(var(--z-modal)=300) > 딤(40) 이라 패널은 딤 위에 떠있음.
       효과: 검색 패널 좌우 빈 공간·패널과 헤더 사이 영역도 딤으로 덮여 outside tap close +
       iOS touch scroll 관통 차단 (#search-dim touch-action:none 와 결합). */
    document.documentElement.style.setProperty('--dim-top', `${headerBottom}px`);
    /* body.overflow 토글은 useDrawer(isSearchOpen) useLayoutEffect 가 담당 (S74 DB-03) */
    setIsSearchOpen(true);
    // 모바일 가상 키보드 활성화: focus()는 사용자 제스처 컨텍스트(click 핸들러) 내에서
    // 동기 호출해야 iOS/Android가 키보드를 띄운다. setTimeout으로 감싸면 체인이 끊김.
    searchInputRef.current?.focus();
  }

  return (
    <>
      {/* ── 메인 헤더 바 (position:sticky via CSS) ──
          backdrop-filter는 Tailwind v4 / Lightning CSS가 CSS 파일의 선언을
          drop하는 이슈가 있어 inline style로 우회 적용. */}
      <div
        ref={headerRef}
        id="site-hdr-wrap"
        className={
          (isDark ? 'blk hdr-dark' : 'blk') +
          (skipTransition ? ' hdr-instant' : '') +
          /* hdr-on-secondary 도 테마 계열이므로 effectivePath 로 동기화
             (BUG-130 Prototype A — 테마 클래스 일괄 같은 tick 전환) */
          (effectivePath === '/shop' && !isDark ? ' hdr-on-secondary' : '') +
          (atTop && !isDark ? ' hdr-at-top' : '')
        }
        style={{
          backdropFilter: atTop && !isDark ? 'none' : 'blur(16px)',
          WebkitBackdropFilter: atTop && !isDark ? 'none' : 'blur(16px)',
        }}
      >
        <div className="hdr">
          {/* 로고 */}
          <div className="hdr-left">
            <Link
              href="/"
              aria-label="Good Things Roasters 홈"
              onClick={handleLogoClick}
              /* Session 43 — 로고 anchor tap-area 30h → 40h (padding 5 * 2), 레이아웃 영향 없음 */
              style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 0', margin: '-5px 0' }}
            >
              <svg
                id="logo-img"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 680 142"
                role="img"
                aria-label="good things"
                style={{ height: '30px', width: 'auto', display: 'block', cursor: 'pointer', fill: 'currentColor' }}
              >
                <polygon points="357.6493 27.2046 339.6493 27.2046 339.6493 44.0773 328.9311 44.0773 328.9311 59.1319 339.6493 59.1319 339.6493 101.2046 357.6493 101.2046 357.6493 59.1319 368.3675 59.1319 368.3675 44.0773 357.6493 44.0773 357.6493 27.2046" />
                <path d="M267.5625,47.602c-4.5569-3.3784-10.093-5.3652-16.0682-5.3652-15.5443,0-28.1454,13.407-28.1454,29.9454s12.6012,29.9455,28.1454,29.9455c5.9752,0,11.5113-1.9868,16.0682-5.3652v4.4562h18V19.1095h-18v28.4925ZM254.758,86.7459c-7.3655,0-13.3364-6.5204-13.3364-14.5637s5.9709-14.5637,13.3364-14.5637c6.0793,0,11.1985,4.4464,12.8045,10.5203v8.0867c-1.606,6.0739-6.7252,10.5203-12.8045,10.5203Z" />
                <rect x="441.922" y="44.0773" width="18" height="57.1273" />
                <circle cx="451.0902" cy="27.3409" r="11" />
                <path d="M578.3129,43.4318l.0443,4.4272c-3.1327-2.7106-8.2188-5.6545-15.5489-5.6545-11.6182,0-27.6545,6.5454-27.6545,28.3091,0,6.3818,1.3091,29.6182,26.8364,29.6182,8.801,0,13.9335-2.7527,16.8364-5.3906l.0591,5.8997s-.9205,9.3091-11.8227,9.3091c-8.3455,0-10.9637-5.5636-10.9637-5.5636h-17.0182s4.0909,21.2727,28.1455,21.2727,29.6591-20.4182,29.6591-25.0182l-.5727-57.2091h-18ZM565.6629,85.8955c-7.3655,0-13.3364-6.5204-13.3364-14.5637s5.9709-14.5637,13.3364-14.5637,13.3364,6.5204,13.3364,14.5637-5.9709,14.5637-13.3364,14.5637Z" />
                <path d="M63.8171,43.3818l.0443,4.4272c-3.1327-2.7106-8.2188-5.6545-15.5489-5.6545-11.6182,0-27.6545,6.5454-27.6545,28.3091,0,6.3818,1.3091,29.6182,26.8364,29.6182,8.801,0,13.9335-2.7527,16.8364-5.3906l.0591,5.8997s-.9205,9.3091-11.8227,9.3091c-8.3455,0-10.9637-5.5636-10.9637-5.5636h-17.0182s4.0909,21.2727,28.1455,21.2727,29.6591-20.4182,29.6591-25.0182l-.5727-57.2091h-18ZM51.1671,85.8455c-7.3655,0-13.3364-6.5204-13.3364-14.5637s5.9709-14.5637,13.3364-14.5637,13.3364,6.5204,13.3364,14.5637-5.9709,14.5637-13.3364,14.5637Z" />
                <path d="M505.2084,42.7682c-7.9653,0-12.7753,3.2297-15.0136,5.261v-3.952h-18v57.1273h18v-33.4c0-4.0909,2.5773-10.4728,10.5954-10.4728s9.2046,9.3273,9.2046,9.3273v34.5455h18v-34.5455c0-17.6727-12.6409-23.8909-22.7864-23.8909Z" />
                <path d="M408.9902,42.7682c-7.7888,0-12.5494,3.0837-14.85,5.1199v-28.6835h-18v82h18v-35.2197c.6652-3.926,3.5295-8.6531,10.4318-8.6531,8.0182,0,9.2045,9.3273,9.2045,9.3273v34.5455h18v-34.5455c0-17.6727-12.6409-23.8909-22.7864-23.8909Z" />
                <path d="M654.977,72.1798c-3.3117-3.0418-8.434-4.4457-15.5883-6.2494-9.0935-2.2925-16.1961-2.7531-16.1961-6.4971,0-3.1037,4.8378-4.2306,9.1287-4.2306,9.1708,0,8.9838,5.1982,8.9838,5.1982h17.1823c0-9.2549-9.2549-18.6781-25.2406-18.6781s-27.0916,7.7405-27.0916,19.3512c0,4.3683,1.6161,8.1512,4.365,11.1059,3.3117,3.0418,8.434,4.4457,15.5883,6.2494,9.0935,2.2925,16.1961,2.7531,16.1961,6.4971,0,3.1037-4.8378,4.2306-9.1287,4.2306-9.1708,0-10.2178-5.7123-10.2178-5.7123h-17.1823c0,9.2549,10.4889,19.1922,26.4746,19.1922s27.0916-7.7405,27.0916-19.3512c0-4.3683-1.6161-8.1512-4.365-11.1059Z" />
                <path d="M120.858,42.2368c-16.8999,0-30.6,13.407-30.6,29.9455s13.7001,29.9454,30.6,29.9454,30.6-13.407,30.6-29.9454-13.7001-29.9455-30.6-29.9455ZM120.858,86.7459c-7.3655,0-13.3364-6.5204-13.3364-14.5637s5.9709-14.5637,13.3364-14.5637,13.3364,6.5204,13.3364,14.5637-5.9709,14.5637-13.3364,14.5637Z" />
                <path d="M187.6216,42.2368c-16.9,0-30.6,13.407-30.6,29.9455s13.7001,29.9454,30.6,29.9454,30.6-13.407,30.6-29.9454-13.7001-29.9455-30.6-29.9455ZM187.6216,86.7459c-7.3655,0-13.3364-6.5204-13.3364-14.5637s5.9709-14.5637,13.3364-14.5637,13.3364,6.5204,13.3364,14.5637-5.9709,14.5637-13.3364,14.5637Z" />
              </svg>
            </Link>
          </div>

          {/* 네비게이션 */}
          <nav className="hdr-nav" aria-label="메인 내비게이션">
            <Link
              href="/story"
              className="nav-link"
              aria-current={pathname.startsWith('/story') ? 'page' : undefined}
              onClick={handleStoryClick}
            >
              The Story
            </Link>
            <Link
              href="/menu"
              className="nav-link"
              aria-current={pathname.startsWith('/menu') ? 'page' : undefined}
              onClick={handleMenuClick}
            >
              Menu
            </Link>
            <Link
              href="/shop"
              className="nav-link"
              aria-current={pathname.startsWith('/shop') ? 'page' : undefined}
              onClick={handleShopClick}
            >
              Shop
            </Link>
            <Link
              href="/gooddays"
              className="nav-link"
              aria-current={pathname.startsWith('/gooddays') ? 'page' : undefined}
              onClick={handleGoodDaysClick}
            >
              Good Days
            </Link>
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

            {/* 로그인 / 마이페이지 — 데스크탑 전용 (<768 에서는 햄버거 메뉴 내장)
                sessionLoading 중엔 visibility:hidden 으로 레이아웃 유지 + 아이콘 미표시
                → INITIAL_SESSION 이전 '비로그인' 플리커 방지 */}
            <Link
              href={mounted && !sessionLoading && isLoggedIn ? '/mypage' : '/login'}
              className="hdr-icon-btn hdr-icon-user"
              aria-label={mounted && !sessionLoading && isLoggedIn ? '마이페이지' : '로그인'}
              style={{ visibility: mounted && sessionLoading ? 'hidden' : 'visible' }}
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
              onClick={() => { closeSearch(); openDrawer(); }}
            >
              <svg className="hi" viewBox="0 1 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

            {/* 모바일 햄버거 — <768 전용 */}
            <button
              type="button"
              className="hdr-menu-toggle"
              aria-label="메뉴 열기"
              aria-expanded={isMobileNavOpen}
              aria-controls="mobile-nav-panel"
              onClick={openMobileNav}
            >
              <svg className="hi" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4,5h16" />
                <path d="M4,12h16" />
                <path d="M4,19h16" />
              </svg>
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
                maxLength={SEARCH_QUERY_MAX_LENGTH}
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

      {/* ── 모바일 네비 드로어 ── */}
      <MobileNavDrawer
        open={isMobileNavOpen}
        onClose={closeMobileNav}
        onNavigate={closeMobileNavForNavigation}
        isLoggedIn={mounted && !sessionLoading && isLoggedIn}
      />

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
