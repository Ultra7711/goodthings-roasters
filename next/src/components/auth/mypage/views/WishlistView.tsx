/* ══════════════════════════════════════════
   WishlistView — 찜 view (S197 PR-1.3.B placeholder)
   상품 wishlist 도메인 미구현 (현재는 카페 메뉴 좋아요만 존재).
   후속 sprint 등록 — 데이터 hook + RLS + UI 필요.
   ══════════════════════════════════════════ */

'use client';

import Link from 'next/link';
import './WishlistView.css';

export default function WishlistView() {
  return (
    <div className="mp-wishlist-empty">
      <p className="mp-wishlist-empty-title">찜한 상품이 없어요.</p>
      <p className="mp-wishlist-empty-desc">
        마음에 드는 원두·드립백을 찜하면 여기 모여요.
      </p>
      <Link href="/shop" className="mp-wishlist-empty-cta" data-gtr-tap>
        샵 둘러보기 →
      </Link>
    </div>
  );
}
