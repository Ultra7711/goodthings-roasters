/* ══════════════════════════════════════════
   MenuName — 시그니처 SVG prefix + 메뉴명 (S245-P20 후속)

   - 시그니처 메뉴 (status='시그니처') → ✦ SVG + 메뉴명
   - 그 외 → 메뉴명만
   - 카드 + 시트 양쪽 동일 사용

   접근성:
   - SVG aria-hidden="true" — 텍스트만 읽힘
   - sr-only "시그니처 메뉴" 텍스트 추가 (시그니처 의미 음성 안내)
   ══════════════════════════════════════════ */

import type { CafeMenuItem } from '@/lib/cafeMenu';
import SignatureStarIcon from './SignatureStarIcon';

type Props = {
  item: CafeMenuItem;
  /** SVG 사이즈 — 카드 (작은) vs 시트 (큰) 컨텍스트별 조정 */
  iconSize?: number;
};

export default function MenuName({ item, iconSize = 16 }: Props) {
  if (item.status !== '시그니처') {
    return <>{item.name}</>;
  }
  return (
    <span className="cm-menu-name-with-sig">
      <span className="sr-only">시그니처 메뉴</span>
      <SignatureStarIcon size={iconSize} className="cm-signature-icon" />
      {item.name}
    </span>
  );
}
