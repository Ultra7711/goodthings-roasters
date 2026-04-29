/* ══════════════════════════════════════════
   공통 SVG 아이콘 컴포넌트
   ══════════════════════════════════════════ */

const SVG_DEFAULTS = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export function ChevronRight({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...SVG_DEFAULTS}>
      <path d="M9,6l6,6-6,6" />
    </svg>
  );
}

export function CopyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...SVG_DEFAULTS}>
      <rect x="9" y="9" width="12" height="12" rx="2" ry="2" />
      <path d="M5,15c-1.1,0-2-.9-2-2V5c0-1.1.9-2,2-2h8c1.1,0,2,.9,2,2" />
    </svg>
  );
}
