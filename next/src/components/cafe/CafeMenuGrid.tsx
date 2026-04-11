/* ══════════════════════════════════════════
   CafeMenuGrid (RP-5)
   프로토타입 #cm-grid + `renderCmGrid` 구조 이식.
   - IntersectionObserver 는 CafeMenuCard 내부에서 처리 (RP-5d).
   - 필터/페이지 변경 시 카드 key 에 `filterKey`+`pageKey` 를 포함해 remount →
     `.cm-visible` 클래스가 초기화되어 등장 연출을 재생한다.
   ══════════════════════════════════════════ */

'use client';

import CafeMenuCard from './CafeMenuCard';
import type { CafeFilterKey, CafeMenuItem } from '@/lib/cafeMenu';

type Props = {
  items: CafeMenuItem[];
  filterKey: CafeFilterKey;
  pageKey: number;
  activeCardId: string | null;
  highlightId: string | null;
  scrollRoot: HTMLElement | null;
  onCardToggle: (id: string) => void;
};

export default function CafeMenuGrid({
  items,
  filterKey,
  pageKey,
  activeCardId,
  highlightId,
  scrollRoot,
  onCardToggle,
}: Props) {
  return (
    <div id="cm-grid">
      {items.map((item, i) => (
        <CafeMenuCard
          key={`${filterKey}-${pageKey}-${item.id}`}
          item={item}
          colIndex={i % 3}
          scrollRoot={scrollRoot}
          isActive={activeCardId === item.id}
          isHighlight={highlightId === item.id}
          onToggle={() => onCardToggle(item.id)}
        />
      ))}
    </div>
  );
}
