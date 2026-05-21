/* ══════════════════════════════════════════
   CafeMenuCard — GenericCard wrapper (S245-P20 재설계)

   슬롯 단순화 (사용자 spec):
   - 좌상: 메타 (단일 · 시그니처 제외)
   - 우상: 좋아요 read-only (기존 위치 복원)
   - 좌하/우하: 비움 (온도/시그니처 시트에서만)

   시그니처 메뉴: getMenuDisplayName 로 메뉴명 prefix '★' 처리.
   ══════════════════════════════════════════ */

'use client';

import type { CafeMenuItem } from '@/lib/cafeMenu';
import { getCafeImageMeta, getMenuDisplayName } from '@/lib/cafeMenu';
import MenuLikeCount from './MenuLikeCount';
import MenuCardBadges from './MenuCardBadges';
import GenericCard from '@/components/common/GenericCard';
/* CafeMenuPage.css 의 .cm-card-* 정의 보장 — CafeMenuCard 사용처 어디서든 (S198 fix). */
import '@/components/cafe/CafeMenuPage.css';

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
  const imgMeta = getCafeImageMeta(item.img);

  return (
    <GenericCard
      variant="cafe"
      onClick={() => onOpenNutrition(item.id)}
      asButton
      imgSrc={item.img}
      imgAlt={item.name}
      imgBlurDataURL={imgMeta?.blurDataURL}
      badgeSlot={<MenuCardBadges menuId={item.id} status={item.status} />}
      topRightSlot={<MenuLikeCount menuId={item.id} />}
      name={getMenuDisplayName(item)}
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
