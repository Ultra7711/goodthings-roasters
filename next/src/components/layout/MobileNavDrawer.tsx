/* ══════════════════════════════════════════
   MobileNavDrawer — Session 41
   모바일(<768) 햄버거 네비 드로어.
   - 우측 슬라이드인 (기존 드로어 패턴 재사용)
   - 상단: 로고 + 장바구니 + X
   - 네비: The Story / Menu / Shop / Good Days
   - 하단: 로그인 / 마이페이지 (텍스트 링크)
   - 장바구니 클릭: 드로어 닫고 카트 드로어 오픈
   - same-path 클릭 시 기존 reset 이벤트 재사용
   ══════════════════════════════════════════ */

'use client';

import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useDrawer } from '@/hooks/useDrawer';
import { useCartDrawer } from '@/contexts/CartDrawerContext';
import { useCartQuery } from '@/hooks/useCart';
import { BUSINESS_INFO } from '@/lib/constants';

const FTC_BIZ_LOOKUP_URL = `https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${BUSINESS_INFO.registrationNumber.replace(/-/g, '')}`;

type Props = {
  open: boolean;
  onClose: () => void;
  isLoggedIn: boolean;
};

type NavItem = {
  label: string;
  href: string;
  resetEvent: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'The Story', href: '/story', resetEvent: 'gtr:story-reset' },
  { label: 'Menu', href: '/menu', resetEvent: 'gtr:menu-reset' },
  { label: 'Shop', href: '/shop', resetEvent: 'gtr:shop-reset' },
  { label: 'Good Days', href: '/gooddays', resetEvent: 'gtr:gooddays-reset' },
];

export default function MobileNavDrawer({ open, onClose, isLoggedIn }: Props) {
  const pathname = usePathname();
  const cartDrawer = useCartDrawer();
  const { totalQty } = useCartQuery();
  const [mounted, setMounted] = useState(false);
  const [bizOpen, setBizOpen] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useDrawer({ open, onClose });

  function handleNavClick(e: React.MouseEvent<HTMLAnchorElement>, item: NavItem) {
    if (pathname === item.href) {
      e.preventDefault();
      window.dispatchEvent(new Event(item.resetEvent));
    }
    onClose();
  }

  function handleCartClick() {
    onClose();
    cartDrawer.open();
  }

  if (!mounted) return null;

  return createPortal(
    <div id="mobile-nav" className={open ? 'open' : ''} aria-hidden={!open}>
      <div
        id="mobile-nav-bg"
        onClick={onClose}
        style={{
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />
      <aside
        id="mobile-nav-panel"
        role="dialog"
        aria-modal="true"
        aria-label="메인 메뉴"
      >
        <div className="mn-header">
          <Link href="/" className="mn-logo" onClick={onClose} aria-label="Good Things Roasters 홈">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 680 142"
              role="img"
              aria-label="good things"
              style={{ height: '30px', width: 'auto', display: 'block', fill: 'currentColor' }}
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
          <div className="mn-header-actions">
            <button
              type="button"
              className="mn-cart"
              aria-label="장바구니"
              onClick={handleCartClick}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="21" r="1" />
                <circle cx="19" cy="21" r="1" />
                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
              </svg>
              {totalQty > 0 && (
                <span className="cart-badge visible">{totalQty}</span>
              )}
            </button>
            <button
              type="button"
              className="mn-close"
              aria-label="메뉴 닫기"
              onClick={onClose}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19,5l-14,14" />
                <path d="M5,5l14,14" />
              </svg>
            </button>
          </div>
        </div>

        <nav className="mn-nav" aria-label="모바일 내비게이션">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="mn-link"
                aria-current={isActive ? 'page' : undefined}
                onClick={(e) => handleNavClick(e, item)}
              >
                <span className="mn-link-text">{item.label}</span>
                <span className="mn-link-arrow" aria-hidden="true">
                  <svg width="24" height="24" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4,24h34"/>
                    <path d="M24,10l14,14-14,14"/>
                  </svg>
                </span>
              </Link>
            );
          })}

          <Link
            href={isLoggedIn ? '/mypage' : '/login'}
            className="mn-account-link"
            onClick={onClose}
          >
            {isLoggedIn ? '마이페이지' : '로그인'}
          </Link>
        </nav>

        <footer className="mn-footer">
          <p className="mn-slogan">good things, simply roasted.</p>
          <span className="mn-f-copyright">© 2026 Good Things Roasters</span>
          <div className="mn-f-row">
            <button
              type="button"
              className="mn-f-biz-toggle"
              aria-expanded={bizOpen}
              onClick={() => setBizOpen((p) => !p)}
            >
              사업자 정보 {bizOpen ? '▴' : '▾'}
            </button>
            <span className="mn-f-sep">·</span>
            <span className="mn-f-legal">이용약관</span>
            <span className="mn-f-sep">·</span>
            <span className="mn-f-legal">개인정보처리방침</span>
          </div>
          <div
            className={`mn-f-biz-detail${bizOpen ? ' open' : ''}`}
            aria-hidden={!bizOpen}
          >
            {BUSINESS_INFO.companyName}<span className="mn-f-biz-sep">·</span>
            대표 {BUSINESS_INFO.ceo}<span className="mn-f-biz-sep">·</span>
            사업자 등록번호 {BUSINESS_INFO.registrationNumber}<span className="mn-f-biz-sep">·</span>
            통신판매업 신고번호 {BUSINESS_INFO.onlineBusinessNumber}{' '}
            <a
              className="mn-f-biz-lookup"
              href={FTC_BIZ_LOOKUP_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              [사업자정보 확인]
            </a>
            <span className="mn-f-biz-sep">·</span>
            주소 {BUSINESS_INFO.address}<span className="mn-f-biz-sep">·</span>
            전화번호 {process.env.NEXT_PUBLIC_CONTACT_PHONE ?? '—'}<span className="mn-f-biz-sep">·</span>
            이메일 {process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? '—'}
          </div>
        </footer>

      </aside>
    </div>,
    document.body
  );
}
