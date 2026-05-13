/* ══════════════════════════════════════════════════════════════════════════
   Admin Toggle (S218) — settings · ProductsTableClient 패턴 통일
   on: var(--primary) / off: var(--switch-off-bg) #939291 (admin 전체 공통 토큰)
   ══════════════════════════════════════════════════════════════════════════ */

import type { CSSProperties } from 'react';

export type AdminToggleProps = {
  on: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
  style?: CSSProperties;
};

export function AdminToggle({
  on,
  onChange,
  disabled,
  ariaLabel,
  style,
}: AdminToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange?.(!on)}
      style={{
        position: 'relative',
        width: 36,
        height: 20,
        borderRadius: 999,
        border: 'none',
        background: on ? 'var(--primary)' : 'var(--switch-off-bg)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'background 0.15s ease',
        padding: 0,
        flexShrink: 0,
        ...style,
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: 999,
          background: '#fff',
          boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
          transition: 'left 0.15s ease',
        }}
      />
    </button>
  );
}
