/* ══════════════════════════════════════════
   LineupSection — V2 §2.3 전체 라인업 (원두 2 + 드립백 4)
   - BeansScrollSection 폐기 후속.
   - 가로 스크롤 + 도트 → 카테고리 분리 2행 그리드.
   - 원두 2-col 5:4 / 드립백 4-col 1:1 (모바일: 원두 1-col / 드립백 2-col).
   - eyebrow = 카테고리 영문명 (D-26 SKU 카운트 폐기 — specialty coffee editorial 톤 부합).
   ══════════════════════════════════════════ */

import { preload } from 'react-dom';
import type { Product } from '@/lib/products';
import { fetchProducts } from '@/lib/productsServer';
import ShopCard from '@/components/shop/ShopCard';


type RowProps = {
  kind: 'bean' | 'drip';
  eyebrow: string;
  heading: string;
  products: Product[];
  aspect: '5:4' | '1:1';
};

function LineupRow({ kind, eyebrow, heading, products, aspect }: RowProps) {
  return (
    <div className={`lineup-row lineup-row--${kind}`}>
      <header className="lineup-header">
        <span className="lineup-eyebrow">{eyebrow}</span>
        <h2 className="lineup-heading">{heading}</h2>
      </header>
      <div className={`lineup-grid lineup-grid--${kind}`}>
        {products.map((p, i) => (
          <ShopCard
            key={p.slug}
            product={p}
            colIndex={i}
            scrollRoot={null}
            aspect={aspect}
            /* 메인 페이지 LineupSection 카드 priority — lazy 끔 + eager fetch.
               next/image fill 의 height 측정 race 회피 + dev 환경 미로드 차단 (S198). */
            imgPriority
          />
        ))}
      </div>
    </div>
  );
}

export default async function LineupSection() {
  /* preload 호출 임시 제거 (S198 진단) — image fetch 미발동 issue 검증용. */
  const products = await fetchProducts();
  const BEANS = products.filter((p) => p.category === 'Coffee Bean');
  const DRIPS = products.filter((p) => p.category === 'Drip Bag');

  return (
    <section className="lineup-blk" data-header-theme="light">
      <LineupRow
        kind="bean"
        eyebrow="Coffee Beans"
        heading="원두"
        products={BEANS}
        aspect="5:4"
      />
      <LineupRow
        kind="drip"
        eyebrow="Drip Bag"
        heading="드립백"
        products={DRIPS}
        aspect="1:1"
      />
    </section>
  );
}
