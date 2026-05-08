/* ══════════════════════════════════════════
   LineupSection — V2 §2.3 전체 라인업 (원두 2 + 드립백 4)
   - BeansScrollSection 폐기 후속.
   - 가로 스크롤 + 도트 → 카테고리 분리 2행 그리드.
   - 원두 2-col 5:4 / 드립백 4-col 1:1 (모바일: 원두 1-col / 드립백 2-col).
   - eyebrow = 카테고리 영문명 (D-26 SKU 카운트 폐기 — specialty coffee editorial 톤 부합).
   ══════════════════════════════════════════ */

import { preload } from 'react-dom';
import { PRODUCTS, type Product } from '@/lib/products';
import ShopCard from '@/components/shop/ShopCard';

const BEANS = PRODUCTS.filter((p) => p.category === 'Coffee Bean');
const DRIPS = PRODUCTS.filter((p) => p.category === 'Drip Bag');

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
  /* 메인 페이지 LineupSection 카드 이미지 사전 fetch (S198).
     ShopCard 가 CSS background-image 로 렌더해 next/image priority/fetchpriority 적용 안 됨 →
     SSR 시 <link rel="preload" as="image"> head 등록으로 브라우저 이른 fetch 보장 → 첫 페인트
     시 카드 이미지 미로드 상태 차단. React 가 동일 src 자동 dedupe. */
  for (const p of [...BEANS, ...DRIPS]) {
    const src = p.images[0]?.src;
    if (src) preload(src, { as: 'image' });
  }

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
