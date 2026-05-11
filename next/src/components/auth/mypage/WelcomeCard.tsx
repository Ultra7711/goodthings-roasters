/* ══════════════════════════════════════════
   WelcomeCard — 신규 사용자 (주문·정기 모두 X) sand 패널 (V2 §3.2 · S197 PR-2 §2.3 상태 D)
   환영 카피 + "원두 둘러보기 →" CTA. sand 패널 layout 은 NextDeliveryCard.css 와 공유.
   S198: 빈 image 영역 → PRODUCTS 풀에서 랜덤 상품 1종 푸시.
   ══════════════════════════════════════════ */

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import type { Product } from '@/lib/products';
import './NextDeliveryCard.css';
import './WelcomeCard.css';

type Props = {
  /** 사용자 표시명 (인사 카피 활용) */
  userName: string;
  /** 장식용 랜덤 상품 이미지 풀 — server prefetch 에서 전달 */
  products: Product[];
};

export default function WelcomeCard({ userName, products }: Props) {
  const pool = useMemo(
    () => products.filter((p) => p.status !== '품절' && p.images.length > 0),
    [products],
  );
  /* SSR/CSR hydration mismatch 회피 — 클라이언트 mount 후 랜덤 결정.
     첫 frame 은 placeholder 노출 후 이미지로 swap. */
  const [pick, setPick] = useState<Product | null>(null);

  useEffect(() => {
    if (pool.length === 0) return;
    const idx = Math.floor(Math.random() * pool.length);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPick(pool[idx]);
  }, [pool]);

  return (
    <section className="mp-next-card mp-next-card--welcome" aria-label="환영합니다">
      <div className="mp-next-info">
        <h2 className="mp-next-name">
          {userName} 님, 어서오세요.
        </h2>
        <p className="mp-next-meta">원두를 둘러보면서 좋아하는 맛을 찾아보세요.</p>
        <Link href="/shop" className="mp-hero-cta" data-gtr-tap>
          원두 둘러보기 →
        </Link>
      </div>
      <div className="mp-next-image" aria-hidden="true">
        {pick ? (
          <Image
            src={pick.images[0].src}
            alt=""
            fill
            sizes="240px"
            className="mp-next-image-img"
          />
        ) : (
          <div className="mp-next-image-placeholder" />
        )}
      </div>
    </section>
  );
}
