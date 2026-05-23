/* ══════════════════════════════════════════
   _shared/FormInput.tsx — prefix/suffix 가능한 input 래퍼 (S256-A 분리)

   - 34px 높이 + has-[:focus-visible] 로 ring 표시
   - disabled 시 surface-muted 배경 + opacity 0.7
   ══════════════════════════════════════════ */

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  prefix?: string;
  suffix?: string;
}

export function FormInput({ prefix, suffix, ...rest }: FormInputProps) {
  const disabled = rest.disabled === true;
  return (
    <div
      className="flex items-center gap-2 px-2.5 h-[34px] border border-[var(--input)] rounded-[6px] shadow-xs transition-[color,box-shadow] has-[:focus-visible]:border-ring has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
      style={{
        background: disabled ? 'var(--surface-muted)' : 'var(--surface)',
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {prefix && (
        <span className="text-muted-foreground text-sm">{prefix}</span>
      )}
      <input
        {...rest}
        className="flex-1 min-w-0 border-0 outline-none shadow-none ring-0 bg-transparent text-sm text-[var(--foreground)] p-0 h-full"
      />
      {suffix && (
        <span className="text-muted-foreground text-xs">{suffix}</span>
      )}
    </div>
  );
}
