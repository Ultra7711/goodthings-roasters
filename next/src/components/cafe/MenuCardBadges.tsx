/* ══════════════════════════════════════════
   MenuCardBadges — 카드 + 시트 좌상단 메타 배지 (S245-P20 재설계)

   왜 분리? (S116)
   - CafeMenuCard 가 popularRank prop 을 받으면 likes store 변경 시 카드 자체가
     리렌더되어 inline transitionDelay 재적용 → 진입 연출 흔들림
   - 이 컴포넌트가 자체 store 구독 → 카드는 likes 정보를 모름 → 격리

   S245-P20 재설계 변경:
   - 단일 배지만 표시 (중복 stack 폐기)
   - popularRank > status 우선순위
   - status='시그니처' 제외 (★ 텍스트 처리 — getMenuDisplayName)
   - 표시 정책:
     1. popularRank 있음 (1/2/3위) → "인기\nNo.X" 원형
     2. popularRank 없음 + status (NEW/인기/시즌/시즌 한정/품절) → status 원형
     3. status='시그니처' → 메타 0 (★ 메뉴명 prefix 로 처리)
     4. 둘 다 없음 → null
   ══════════════════════════════════════════ */

'use client';

import { useMenuPopularRank } from '@/lib/menuLikesStore';
import type { CafeMenuStatus } from '@/lib/cafeMenu';

type Props = {
  menuId: string;
  status: CafeMenuStatus;
};

/** status → { variant 클래스, 두 줄 텍스트 } 매핑 · '시그니처' 제외 */
function getStatusBadge(
  status: CafeMenuStatus,
): { className: string; text: string } | null {
  if (!status) return null;
  switch (status) {
    case '시즌':
      return { className: 'cm-meta-badge--season', text: '시즌' };
    case '시즌 한정':
      return { className: 'cm-meta-badge--season', text: '시즌\n한정' };
    case 'NEW':
      return { className: 'cm-meta-badge--new', text: 'NEW' };
    case '인기':
      return { className: 'cm-meta-badge--popular', text: '인기' };
    case '품절':
      return { className: 'cm-meta-badge--sold', text: '품절' };
    /* '시그니처' 는 메타 배지 표시 X — ★ 텍스트로 처리 (getMenuDisplayName) */
    default:
      return null;
  }
}

export default function MenuCardBadges({ menuId, status }: Props) {
  const popularRank = useMenuPopularRank(menuId);

  /* 단일 배지 — popularRank 우선. 둘 다 있으면 popularRank 만 표시. */
  if (popularRank) {
    return (
      <div className="cm-card-badges">
        <span
          className={`cm-meta-badge cm-meta-badge--rank-${popularRank}`}
        >{`인기\nNo.${popularRank}`}</span>
      </div>
    );
  }

  const statusBadge = getStatusBadge(status);
  if (!statusBadge) return null;

  return (
    <div className="cm-card-badges">
      <span className={`cm-meta-badge ${statusBadge.className}`}>
        {statusBadge.text}
      </span>
    </div>
  );
}
