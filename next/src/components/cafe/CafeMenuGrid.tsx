/* ══════════════════════════════════════════
   CafeMenuGrid (RP-5)
   프로토타입 #cm-grid + `renderCmGrid` 구조 이식.
   - IntersectionObserver 는 CafeMenuCard 내부에서 처리 (RP-5d).
   - 필터/페이지 변경 시 카드 key 에 `filterKey`+`pageKey` 를 포함해 remount →
     `.cm-visible` 클래스가 초기화되어 등장 연출을 재생한다.
   - 동일 filter 에서 헤더 Menu 재클릭 시에는 remount 를 강제하지 않아
     플리커를 피한다 (ShopPage 와 동일 패턴).
   ══════════════════════════════════════════ */

'use client';

import CafeMenuCard from './CafeMenuCard';
import type { CafeFilterKey, CafeMenuItem } from '@/lib/cafeMenu';

type Props = {
  items: CafeMenuItem[];
  filterKey: CafeFilterKey;
  pageKey: number;
  highlightId: string | null;
  scrollRoot: HTMLElement | null;
  baseDelay?: number;
  instant?: boolean;
  onOpenNutrition: (id: string) => void;
};

export default function CafeMenuGrid({
  items,
  /* filterKey/pageKey 는 부모(CafeMenuPage)가 key 조립에 사용 — 이 컴포넌트
     본문에서는 직접 참조하지 않으나 Props 시그니처는 호출 계약상 유지한다. */
  highlightId,
  scrollRoot,
  baseDelay = 0,
  instant = false,
  onOpenNutrition,
}: Props) {
  return (
    <div id="cm-grid">
      {items.map((item, i) => (
        // key 는 item.id — 공통 아이템은 persist. 새로 mount 되는 카드는 instant=true 일 때 애니 스킵.
        <CafeMenuCard
          key={item.id}
          item={item}
          colIndex={i % 3}
          scrollRoot={scrollRoot}
          isHighlight={highlightId === item.id}
          baseDelay={baseDelay}
          instant={instant}
          onOpenNutrition={onOpenNutrition}
        />
      ))}
    </div>
  );
}
