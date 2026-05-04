/* ══════════════════════════════════════════
   LineupSection — V2 §2.3 전체 라인업 (원두 2 + 드립백 4)
   - BeansScrollSection 폐기 후속.
   - 가로 스크롤 + 도트 → 카테고리 분리 2행 그리드.
   - 원두 2-col 5:4 / 드립백 4-col 1:1 (모바일: 원두 1-col / 드립백 2-col).
   - eyebrow 에 SKU 카운트 명시 (`Coffee Beans · 02` · `Drip Bag · 04`).
   ══════════════════════════════════════════ */

import { PRODUCTS, type Product } from '@/lib/products';
import ShopCard from '@/components/shop/ShopCard';

const BEANS = PRODUCTS.filter((p) => p.category === 'Coffee Bean');
const DRIPS = PRODUCTS.filter((p) => p.category === 'Drip Bag');

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

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
          />
        ))}
      </div>
    </div>
  );
}

export default function LineupSection() {
  return (
    <section className="lineup-blk" data-header-theme="light">
      <LineupRow
        kind="bean"
        eyebrow={`Coffee Beans · ${pad2(BEANS.length)}`}
        heading="원두"
        products={BEANS}
        aspect="5:4"
      />
      <LineupRow
        kind="drip"
        eyebrow={`Drip Bag · ${pad2(DRIPS.length)}`}
        heading="드립백 — 한 잔의 여행"
        products={DRIPS}
        aspect="1:1"
      />
    </section>
  );
}
