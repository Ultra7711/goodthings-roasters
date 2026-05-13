/* ══════════════════════════════════════════════════════════════════════════
   Admin Button (S218) — shadcn 표준 답습 + GTR brown primary
   variant: primary / secondary / ghost / danger
   size: sm (h32 text-xs) / md (h36 text-sm) / lg (h40 text-sm)
   ══════════════════════════════════════════════════════════════════════════ */

import { forwardRef, type ButtonHTMLAttributes, type CSSProperties } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export type AdminButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const SIZE_STYLE: Record<Size, CSSProperties> = {
  sm: {
    height: 'var(--btn-h-sm)',
    fontSize: 'var(--text-xs)',
    padding: '0 12px',
    gap: 6,
  },
  md: {
    height: 'var(--btn-h-md)',
    fontSize: 'var(--text-sm)',
    padding: '0 16px',
    gap: 6,
  },
  lg: {
    height: 'var(--btn-h-lg)',
    fontSize: 'var(--text-sm)',
    padding: '0 32px',
    gap: 8,
  },
};

const VARIANT_STYLE: Record<Variant, CSSProperties> = {
  primary: {
    background: 'var(--primary)',
    color: '#fff',
    border: '1px solid var(--primary)',
  },
  secondary: {
    background: 'var(--surface)',
    color: 'var(--foreground)',
    border: '1px solid var(--border)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--foreground-muted)',
    border: '1px solid transparent',
  },
  danger: {
    background: 'var(--danger)',
    color: '#fff',
    border: '1px solid var(--danger)',
  },
};

const BASE_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 6,
  fontWeight: 500,
  fontFamily: 'inherit',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  letterSpacing: '-0.005em',
  transition: 'opacity 0.15s ease, background 0.15s ease',
};

export const AdminButton = forwardRef<HTMLButtonElement, AdminButtonProps>(
  function AdminButton(
    { variant = 'secondary', size = 'md', disabled, style, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled}
        style={{
          ...BASE_STYLE,
          ...SIZE_STYLE[size],
          ...VARIANT_STYLE[variant],
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          ...style,
        }}
        {...rest}
      />
    );
  },
);
