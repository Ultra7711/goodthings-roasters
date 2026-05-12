/* ══════════════════════════════════════════
   CafeMenuCard — GenericCard wrapper (V2 §6.2 통합)
   - GenericCard 가 reveal IO · stagger · highlight · 슬롯 처리
   - 차이: 클릭 → onOpenNutrition 콜백 · 좋아요(우상단) · 온도뱃지(우하단)
   ══════════════════════════════════════════ */

'use client';

import type { CafeMenuItem, CafeMenuTemp } from '@/lib/cafeMenu';
import { getCafeImageMeta } from '@/lib/cafeMenu';
import MenuLikeButton from './MenuLikeButton';
import MenuCardBadges from './MenuCardBadges';
import GenericCard from '@/components/common/GenericCard';
/* CafeMenuPage.css 의 .cm-card-* 정의 보장 — CafeMenuCard 사용처 어디서든 (S198 fix). */
import '@/components/cafe/CafeMenuPage.css';

/** 프로토타입 tMap — 온도 뱃지 (우하단 원형) */
function getTempBadge(temp: CafeMenuTemp): { cls: string; txt: string } | null {
  if (!temp || temp === 'both') return null;
  switch (temp) {
    case 'ice-only':
      return { cls: 'cm-temp-ice-only', txt: 'ICE\nONLY' };
    case 'hot-only':
      return { cls: 'cm-temp-hot-only', txt: 'HOT\nONLY' };
    case 'warm':
      return { cls: 'cm-temp-warm', txt: 'WARM' };
    default:
      return null;
  }
}

type Props = {
  item: CafeMenuItem;
  colIndex: number;
  scrollRoot: HTMLElement | null;
  isHighlight: boolean;
  baseDelay?: number;
  instant?: boolean;
  onOpenNutrition: (id: string) => void;
};

export default function CafeMenuCard({
  item,
  colIndex,
  scrollRoot,
  isHighlight,
  baseDelay = 0,
  instant = false,
  onOpenNutrition,
}: Props) {
  const tempBadge = getTempBadge(item.temp);
  const imgMeta = getCafeImageMeta(item.img);

  const bottomRightSlot = tempBadge ? (
    <div className="cm-temp-badges">
      <span className={`cm-badge-temp ${tempBadge.cls}`}>{tempBadge.txt}</span>
    </div>
  ) : undefined;

  return (
    <GenericCard
      variant="cafe"
      onClick={() => onOpenNutrition(item.id)}
      asButton
      imgSrc={item.img}
      imgAlt={item.name}
      imgBlurDataURL={imgMeta?.blurDataURL}
      badgeSlot={<MenuCardBadges menuId={item.id} status={item.status} />}
      topRightSlot={<MenuLikeButton menuId={item.id} menuName={item.name} />}
      bottomRightSlot={bottomRightSlot}
      name={item.name}
      price={`${item.price.toLocaleString('ko-KR')}원`}
      scrollRoot={scrollRoot}
      colIndex={colIndex}
      baseDelay={baseDelay}
      instant={instant}
      isHighlight={isHighlight}
      dataCmId={item.id}
    />
  );
}
