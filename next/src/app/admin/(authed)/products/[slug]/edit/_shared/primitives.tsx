/* ══════════════════════════════════════════
   _shared/primitives.tsx — ProductEditForm 공용 wrapper (S260 분리)

   - Card: 카드 + title 헤더
   - FieldGrid: cols 기반 grid (1~3 columns)
   - Field: label + required mark + hint/error 표시
   ══════════════════════════════════════════ */

import type { ReactNode } from 'react';

export function Card({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-[var(--surface)] border border-border rounded-[var(--radius)] p-5">
      <h3 className="m-0 mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

export function FieldGrid({
  cols = 2,
  children,
}: {
  cols?: 1 | 2 | 3;
  children: ReactNode;
}) {
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {children}
    </div>
  );
}

export function Field({
  label,
  hint,
  required,
  error,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-[var(--foreground)] tracking-[-0.005em] flex items-center gap-1">
        {label}
        {required && <span className="text-[var(--primary)]">*</span>}
      </label>
      {children}
      {error ? (
        <div className="pl-2.5 text-xs text-[var(--danger)]">{error}</div>
      ) : (
        hint && <div className="pl-2.5 text-xs text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}
