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

export function InfoCircleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...SVG_DEFAULTS} style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12,16v-4" />
      <path d="M12,8h0" />
    </svg>
  );
}

/* X close 아이콘 — 표준 spec.
   - size 24 / strokeWidth 2: 시트·드로어·모달 close 기본
   - size 28 / strokeWidth 1.5: lightbox·풀 오버레이 close
   - path 14×14 (5,5 ~ 19,19) — 좌우 5px 인셋, 시각적으로 명확. */
export function CloseIcon({
  size = 24,
  strokeWidth = 2,
}: { size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19,5l-14,14" />
      <path d="M5,5l14,14" />
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
