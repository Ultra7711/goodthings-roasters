/* ══════════════════════════════════════════════════════════════════════════
   Admin Input (S218) — shadcn 표준 (h36 / text-sm / px-3)
   size: sm (h28 · 검색·필터 전용) / md (h36 · default)
   ══════════════════════════════════════════════════════════════════════════ */

import { forwardRef, type InputHTMLAttributes, type CSSProperties } from 'react';

type Size = 'sm' | 'md';

export type AdminInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'size'
> & {
  size?: Size;
  invalid?: boolean;
};

const SIZE_STYLE: Record<Size, CSSProperties> = {
  sm: {
    height: 'var(--input-h-sm)',
    fontSize: 'var(--text-xs)',
    padding: '0 10px',
  },
  md: {
    height: 'var(--input-h)',
    fontSize: 'var(--text-sm)',
    padding: '0 12px',
  },
};

const BASE_STYLE: CSSProperties = {
  width: '100%',
  background: 'var(--surface)',
  border: '1px solid var(--input)',
  borderRadius: 6,
  color: 'var(--foreground)',
  outline: 'none',
  fontFamily: 'inherit',
  lineHeight: 'var(--leading-normal)',
};

export const AdminInput = forwardRef<HTMLInputElement, AdminInputProps>(
  function AdminInput(
    { size: sizeProp = 'md', invalid, style, disabled, readOnly, ...rest },
    ref,
  ) {
    return (
      <input
        ref={ref}
        disabled={disabled}
        readOnly={readOnly}
        style={{
          ...BASE_STYLE,
          ...SIZE_STYLE[sizeProp],
          borderColor: invalid ? 'var(--danger)' : 'var(--input)',
          background:
            disabled || readOnly ? 'var(--surface-muted)' : 'var(--surface)',
          color:
            disabled || readOnly
              ? 'var(--foreground-muted)'
              : 'var(--foreground)',
          cursor: disabled
            ? 'not-allowed'
            : readOnly
              ? 'not-allowed'
              : 'text',
          ...style,
        }}
        {...rest}
      />
    );
  },
);
