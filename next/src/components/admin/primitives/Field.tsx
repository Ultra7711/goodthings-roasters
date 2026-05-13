/* ══════════════════════════════════════════════════════════════════════════
   Admin Field (S218) — label + hint + error wrapper
   shadcn FormField 패턴 답습. RHF errors / hint / required 통합.
   ══════════════════════════════════════════════════════════════════════════ */

import type { ReactNode } from 'react';

export type AdminFieldProps = {
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
};

export function AdminField({
  label,
  hint,
  required,
  error,
  children,
}: AdminFieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        style={{
          fontSize: 'var(--text-sm)',
          fontWeight: 500,
          color: 'var(--foreground)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          lineHeight: 'var(--leading-snug)',
        }}
      >
        {label}
        {required && (
          <span style={{ color: 'var(--primary)' }} aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <div
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--danger)',
            lineHeight: 'var(--leading-snug)',
          }}
        >
          {error}
        </div>
      ) : (
        hint && (
          <div
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--foreground-muted)',
              lineHeight: 'var(--leading-snug)',
            }}
          >
            {hint}
          </div>
        )
      )}
    </div>
  );
}
