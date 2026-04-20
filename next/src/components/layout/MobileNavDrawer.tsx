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
            <img src="/images/icons/logo.svg" alt="good things" />
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
                className={'mn-link' + (isActive ? ' is-active' : '')}
                aria-current={isActive ? 'page' : undefined}
                onClick={(e) => handleNavClick(e, item)}
              >
                <span className="mn-link-text">{item.label}</span>
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

      </aside>
    </div>,
    document.body
  );
}
