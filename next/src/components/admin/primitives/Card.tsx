/* ══════════════════════════════════════════════════════════════════════════
   Admin Card (S218) — shadcn 표준 (p-6 = 24px) + section header pattern
   padding: sm 16 / md 24 (default · shadcn p-6) / lg 32
   ══════════════════════════════════════════════════════════════════════════ */

import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

type Padding = 'sm' | 'md' | 'lg' | 'none';

export type AdminCardProps = HTMLAttributes<HTMLDivElement> & {
  padding?: Padding;
};

const PAD_VALUE: Record<Padding, string> = {
  none: '0',
  sm: 'var(--space-4)', // 16
  md: 'var(--space-6)', // 24 (default · shadcn p-6)
  lg: 'var(--space-8)', // 32
};

const BASE_STYLE: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
};

export function AdminCard({
  padding = 'md',
  style,
  ...rest
}: AdminCardProps) {
  return (
    <div
      style={{ ...BASE_STYLE, padding: PAD_VALUE[padding], ...style }}
      {...rest}
    />
  );
}

/* 카드 내부 섹션 헤더 — UPPERCASE label · text-xs · foreground-muted */
export type AdminCardSectionHeaderProps = {
  title: string;
  meta?: string;
  right?: ReactNode;
};

export function AdminCardSectionHeader({
  title,
  meta,
  right,
}: AdminCardSectionHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--foreground-muted)',
            lineHeight: 'var(--leading-tight)',
          }}
        >
          {title}
        </h3>
        {meta && (
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--foreground-subtle)',
            }}
          >
            {meta}
          </span>
        )}
      </div>
      {right}
    </div>
  );
}
