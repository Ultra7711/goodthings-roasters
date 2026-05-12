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
  getProductImageMeta,
  getStatusBadgeClass,
} from '@/lib/products';
import GenericCard from '@/components/common/GenericCard';
/* ShopPage.css 의 .sp-card-* 정의 (thumb aspect-ratio / position / size) — ShopCard 사용처
   (ShopPage / LineupSection / SearchResult 등) 어디서든 CSS 보장 (S198 fix). */
import '@/components/shop/ShopPage.css';

type Props = {
  product: Product;
  colIndex: number;
  scrollRoot: HTMLElement | null;
  baseDelay?: number;
  instant?: boolean;
  isHighlight?: boolean;
  /** V2 §2.3 원두 5:4 / 드립백 1:1. default 1:1 (기존 ShopPage 호환) */
  aspect?: '1:1' | '5:4';
  /** above-fold 카드 priority 적용 (lazy 끔, LCP 개선) */
  imgPriority?: boolean;
};

export default function ShopCard({
  product: p,
  colIndex,
  scrollRoot,
  baseDelay = 0,
  instant = false,
  isHighlight = false,
  aspect = '1:1',
  imgPriority = false,
}: Props) {
  const router = useRouter();

  const img = p.images[0];
  const imgMeta = img ? getProductImageMeta(img.src) : undefined;

  const badgeSlot = p.status ? (
    <span className={getStatusBadgeClass(p.status)}>
      {p.status === 'NEW' ? 'NEW' : p.status}
    </span>
  ) : undefined;

  return (
    <GenericCard
      variant="shop"
      onClick={() => router.push(`/shop/${p.slug}`)}
      imgSrc={img?.src}
      imgAlt={extractKrName(p.name)}
      imgBlurDataURL={imgMeta?.blurDataURL}
      imgPriority={imgPriority}
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
