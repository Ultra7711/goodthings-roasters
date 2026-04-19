/* ══════════════════════════════════════════
   MobileNavDrawer — Session 41
   모바일(<768) 햄버거 네비 드로어.
   - 우측 슬라이드인 (기존 드로어 패턴 재사용)
   - 링크: The Story / Menu / Shop / Good Days + 로그인 / 장바구니
   - same-path 클릭 시 기존 reset 이벤트 재사용 (SiteHeader 와 동일 시맨틱)
   - 네비게이션 후 자동 닫힘
   ══════════════════════════════════════════ */

'use client';

import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useDrawer } from '@/hooks/useDrawer';

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
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useDrawer({ open, onClose });

  function handleNavClick(e: React.MouseEvent<HTMLAnchorElement>, item: NavItem) {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      e.preventDefault();
      window.dispatchEvent(new Event(item.resetEvent));
    }
    onClose();
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
          <button
            type="button"
            className="mn-close"
            aria-label="메뉴 닫기"
            onClick={onClose}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
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
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mn-footer">
          {isLoggedIn ? (
            <Link href="/mypage" className="mn-sub-link" onClick={onClose}>
              마이페이지
            </Link>
          ) : (
            <>
              <Link href="/login" className="mn-sub-link" onClick={onClose}>
                로그인
              </Link>
              <Link href="/register" className="mn-sub-link" onClick={onClose}>
                회원가입
              </Link>
            </>
          )}
        </div>
      </aside>
    </div>,
    document.body
  );
}
