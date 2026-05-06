/* ══════════════════════════════════════════
   MiniHeader — /checkout 미니 헤더
   skeleton / empty / 정상 3개 분기에서 공통 사용.
   cartCount/onCartClick 미전달 시 카트 버튼 자체 미렌더 (skeleton·empty).
   ══════════════════════════════════════════ */

'use client';

import Image from 'next/image';
import Link from 'next/link';

type MiniHeaderProps = {
  atTop: boolean;
  cartCount?: number;
  onCartClick?: () => void;
};

function CartIcon() {
  return (
    <svg className="hi" viewBox="0 1 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 24, height: 24 }}>
      <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  );
}

export default function MiniHeader({ atTop, cartCount, onCartClick }: MiniHeaderProps) {
  /* backdrop-filter는 Lightning CSS가 CSS 파일에서 드롭하므로 inline style 유지 (web/lessons.md §6) */
  const headerBlurStyle = {
    backdropFilter: atTop ? 'none' : 'blur(16px)',
    WebkitBackdropFilter: atTop ? 'none' : 'blur(16px)',
  };

  return (
    <div
      className={`chp-hdr-wrap${atTop ? ' hdr-at-top' : ''}`}
      style={headerBlurStyle}
    >
      <div className="chp-hdr-inner">
        <Link href="/">
          <Image src="/images/icons/logo.svg" alt="GOOD THINGS" width={150} height={30} className="chp-logo-img" />
        </Link>
        {onCartClick && (
          <button
            type="button"
            className="hdr-icon-btn"
            style={{ position: 'relative' }}
            aria-label="장바구니"
            onClick={onCartClick}
          >
            <CartIcon />
            {cartCount !== undefined && cartCount > 0 && (
              <span className="cart-badge visible">{cartCount}</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
