/* ══════════════════════════════════════════
   MenuCardBadges — 카드 + 시트 좌상단 메타 배지 (status + 인기 No.)

   왜 분리? (S116)
   - CafeMenuCard 가 popularRank prop 을 받으면 likes store 변경 시 카드 자체가
     리렌더되어 inline transitionDelay 재적용 → 진입 연출 흔들림
   - 이 컴포넌트가 자체 store 구독 → 카드는 likes 정보를 모름 → 격리

   S245-P20 Phase 2 변경:
   - sp-card-badge (pill · shop 공유) → cm-meta-badge (원형 · cafe 전용)
   - 텍스트 두 줄 매핑 (인기 No.1 → "인기\nNo.1") · pre-line 자동 줄바꿈
   - cm-popular-badge--{1,2,3} → cm-meta-badge--rank-{1,2,3}
   ══════════════════════════════════════════ */

'use client';

import { useMenuPopularRank } from '@/lib/menuLikesStore';
import type { CafeMenuStatus } from '@/lib/cafeMenu';

type Props = {
  menuId: string;
  status: CafeMenuStatus;
};

/** status → { variant 클래스, 두 줄 텍스트 } 매핑 */
function getStatusBadge(
  status: CafeMenuStatus,
): { className: string; text: string } | null {
  if (!status) return null;
  switch (status) {
    case '시즌':
      return { className: 'cm-meta-badge--season', text: '시즌' };
    case '시즌 한정':
      return { className: 'cm-meta-badge--season', text: '시즌\n한정' };
    case '시그니처':
      return { className: 'cm-meta-badge--signature', text: '시그\n니처' };
    case 'NEW':
      return { className: 'cm-meta-badge--new', text: 'NEW' };
    case '인기':
      return { className: 'cm-meta-badge--popular', text: '인기' };
    case '품절':
      return { className: 'cm-meta-badge--sold', text: '품절' };
    default:
      return null;
  }
}

export default function MenuCardBadges({ menuId, status }: Props) {
  const popularRank = useMenuPopularRank(menuId);
  const statusBadge = getStatusBadge(status);

  if (!statusBadge && !popularRank) return null;

  return (
    <div className="cm-card-badges">
      {statusBadge && (
        <span className={`cm-meta-badge ${statusBadge.className}`}>
          {statusBadge.text}
        </span>
      )}
      {popularRank && (
        <span
          className={`cm-meta-badge cm-meta-badge--rank-${popularRank}`}
        >{`인기\nNo.${popularRank}`}</span>
      )}
    </div>
  );
}
