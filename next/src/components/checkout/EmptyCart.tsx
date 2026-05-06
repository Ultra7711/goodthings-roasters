/* ══════════════════════════════════════════
   EmptyCart — /checkout 빈 카트 상태
   MiniHeader (cart 없음) + 안내 + 쇼핑 계속하기 CTA.
   ══════════════════════════════════════════ */

'use client';

import Image from 'next/image';
import Link from 'next/link';
import MiniHeader from './MiniHeader';

type EmptyCartProps = {
  atTop: boolean;
};

export default function EmptyCart({ atTop }: EmptyCartProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100svh' }}>
      <MiniHeader atTop={atTop} />
      <div className="chp-empty">
        <Image src="/images/icons/cart_big.svg" alt="" aria-hidden="true" width={64} height={64} className="chp-empty-icon" />
        <p className="chp-empty-msg">장바구니가 비어 있습니다.</p>
        <Link href="/shop" className="chp-empty-cta" data-gtr-tap>쇼핑 계속하기</Link>
      </div>
    </div>
  );
}
