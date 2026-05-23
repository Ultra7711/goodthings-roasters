/* ══════════════════════════════════════════
   _shared/FormField.tsx — label + hint + children 래퍼 (S256-A 분리)

   - required 시 라벨 우측에 빨간 별 (var(--primary))
   - hint: ReactNode 허용 (JSX 줄바꿈 포함)
   ══════════════════════════════════════════ */

interface FormFieldProps {
  label: string;
  hint?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
}

export function FormField({ label, hint, required, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-[var(--foreground)] tracking-[-0.005em] flex items-center gap-1">
        {label}
        {required && <span className="text-[var(--primary)]">*</span>}
      </label>
      {children}
      {hint && (
        <div className="text-xs text-muted-foreground pl-2.5">{hint}</div>
      )}
    </div>
  );
}
