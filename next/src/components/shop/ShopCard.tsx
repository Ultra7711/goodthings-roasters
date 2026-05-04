/* ══════════════════════════════════════════
   ShopCard — GenericCard wrapper (V2 §6.2 통합)
   - GenericCard 가 reveal IO · stagger · highlight · 슬롯 처리
   - 차이: 클릭 → /shop/<slug> · status 뱃지만 (좋아요·온도뱃지 없음)
   ══════════════════════════════════════════ */

'use client';

import { useRouter } from 'next/navigation';
import {
  type Product,
  extractKrName,
  formatStartPrice,
  getStatusBadgeClass,
} from '@/lib/products';
import GenericCard from '@/components/common/GenericCard';

type Props = {
  product: Product;
  colIndex: number;
  scrollRoot: HTMLElement | null;
  baseDelay?: number;
  instant?: boolean;
  isHighlight?: boolean;
  /** V2 §2.3 원두 5:4 / 드립백 1:1. default 1:1 (기존 ShopPage 호환) */
  aspect?: '1:1' | '5:4';
};

export default function ShopCard({
  product: p,
  colIndex,
  scrollRoot,
  baseDelay = 0,
  instant = false,
  isHighlight = false,
  aspect = '1:1',
}: Props) {
  const router = useRouter();

  const img = p.images[0];
  const imgStyle: React.CSSProperties = {
    background: `${img?.bg ?? '#f5f5f3'}${
      img?.src ? ` url('${img.src}') center/contain no-repeat` : ''
    }`,
  };

  const badgeSlot = p.status ? (
    <span className={getStatusBadgeClass(p.status)}>
      {p.status === 'NEW' ? 'NEW' : p.status}
    </span>
  ) : undefined;

  return (
    <GenericCard
      variant="shop"
      onClick={() => router.push(`/shop/${p.slug}`)}
      imgStyle={imgStyle}
      thumbAspect={aspect}
      badgeSlot={badgeSlot}
      name={extractKrName(p.name)}
      price={formatStartPrice(p)}
      scrollRoot={scrollRoot}
      colIndex={colIndex}
      baseDelay={baseDelay}
      instant={instant}
      isHighlight={isHighlight}
      dataSlug={p.slug}
    />
  );
}
