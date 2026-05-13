/* ══════════════════════════════════════════════════════════════════════════
   Admin Badge (S218) — shadcn 표준 답습
   tone: neutral · success · warning · danger · info · primary
   dot: 5x5 색상 점 (status 표시 — orders/users 답습)
   ══════════════════════════════════════════════════════════════════════════ */

import type { CSSProperties, ReactNode } from 'react';

export type BadgeTone =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'primary';

const TONES: Record<BadgeTone, { bg: string; fg: string; dot: string }> = {
  neutral: {
    bg: 'var(--neutral-soft)',
    fg: 'var(--neutral-soft-fg)',
    dot: '#888',
  },
  success: {
    bg: 'var(--success-soft)',
    fg: 'var(--success)',
    dot: 'var(--success)',
  },
  warning: {
    bg: 'var(--warning-soft)',
    fg: 'var(--warning)',
    dot: 'var(--warning)',
  },
  danger: {
    bg: 'var(--danger-soft)',
    fg: 'var(--danger)',
    dot: 'var(--danger)',
  },
  info: {
    bg: 'var(--info-soft)',
    fg: 'var(--info)',
    dot: 'var(--info)',
  },
  primary: {
    bg: 'var(--primary-soft)',
    fg: 'var(--primary-soft-fg)',
    dot: 'var(--primary)',
  },
};

const BASE_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '2px 10px',
  borderRadius: 999,
  fontSize: 'var(--text-xs)',
  fontWeight: 500,
  lineHeight: 'var(--leading-normal)',
  letterSpacing: '-0.005em',
  whiteSpace: 'nowrap',
};

export type AdminBadgeProps = {
  tone?: BadgeTone;
  dot?: boolean;
  children: ReactNode;
  style?: CSSProperties;
};

export function AdminBadge({
  tone = 'neutral',
  dot,
  children,
  style,
}: AdminBadgeProps) {
  const t = TONES[tone];
  return (
    <span style={{ ...BASE_STYLE, background: t.bg, color: t.fg, ...style }}>
      {dot && (
        <span
          aria-hidden
          style={{
            width: 5,
            height: 5,
            borderRadius: 999,
            background: t.dot,
          }}
        />
      )}
      {children}
    </span>
  );
}
