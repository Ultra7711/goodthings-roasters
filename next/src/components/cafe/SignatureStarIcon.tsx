/* ══════════════════════════════════════════
   SignatureStarIcon — 시그니처 메뉴 prefix SVG (S245-P20 후속)

   디자인: Sparkle (4점 별 · 다이아몬드 sparkle shape)
   - 4 방향 sharp point + concave middle
   - 미니멀 모던 · GTR warm neutral 톤 정합
   - 카페 시그니처 메뉴 = "특별한 한 잔" 미세 강조

   기본:
   - size 16 (메뉴명 옆 인라인)
   - color: currentColor (CSS 로 #B8943F gold 지정)
   ══════════════════════════════════════════ */

type Props = {
  size?: number;
  className?: string;
};

export default function SignatureStarIcon({ size = 16, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      {/* 4점 sparkle — 12,2 ↑ / 22,12 → / 12,22 ↓ / 2,12 ← + concave middle */}
      <path d="M12 1.5 L13.6 10.4 L22.5 12 L13.6 13.6 L12 22.5 L10.4 13.6 L1.5 12 L10.4 10.4 Z" />
    </svg>
  );
}
