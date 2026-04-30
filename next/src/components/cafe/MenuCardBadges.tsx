/* ══════════════════════════════════════════
   MenuCardBadges — 카드 좌상단 뱃지 영역(status + 인기 No.)

   왜 분리? (S116)
   - CafeMenuCard 가 popularRank prop 을 받으면 likes store 변경 시 카드 자체가
     리렌더되어 inline transitionDelay 재적용 → 진입 연출 흔들림
   - 이 컴포넌트가 자체 store 구독 → 카드는 likes 정보를 모름 → 격리
   ══════════════════════════════════════════ */

'use client';

import { useMenuPopularRank } from '@/lib/menuLikesStore';
import type { CafeMenuStatus } from '@/lib/cafeMenu';

type Props = {
  menuId: string;
  status: CafeMenuStatus;
};

/** 프로토타입 statusMap — `.sp-card-badge` + `badge-*` 조합 */
function getStatusBadgeClass(status: CafeMenuStatus): string | null {
  if (!status) return null;
  switch (status) {
    case '시즌':
    case '시즌 한정':
      return 'sp-card-badge badge-ltd';
    case '시그니처':
      return 'sp-card-badge badge-pop-1';
    case 'NEW':
      return 'sp-card-badge badge-new';
    case '인기':
      return 'sp-card-badge badge-pop-2';
    case '품절':
      return 'sp-card-badge badge-sold';
    default:
      return null;
  }
}

export default function MenuCardBadges({ menuId, status }: Props) {
  const popularRank = useMenuPopularRank(menuId);
  const badgeClass = getStatusBadgeClass(status);

  if (!badgeClass && !popularRank) return null;

  return (
    <div className="cm-card-badges">
      {badgeClass && <span className={badgeClass}>{status}</span>}
      {popularRank && (
        <span className={`sp-card-badge cm-popular-badge--${popularRank}`}>
          인기 No.{popularRank}
        </span>
      )}
    </div>
  );
}
