/* ══════════════════════════════════════════
   _shared/Badge.tsx — 헤더 dirty 카운트 / 저장 상태 뱃지 (S256-A 분리)

   - tone: 'warning' (저장되지 않은 변경 N개) | 'success' (최신 상태)
   - dot + label 형태
   ══════════════════════════════════════════ */

interface BadgeProps {
  tone: 'warning' | 'success';
  children: React.ReactNode;
}

export function Badge({ tone, children }: BadgeProps) {
  const isWarn = tone === 'warning';
  return (
    <span
      className="inline-flex items-center gap-[5px] px-2 py-0.5 rounded-full text-xs font-medium tracking-[-0.005em] leading-[1.5] whitespace-nowrap"
      style={{
        background: isWarn ? 'var(--warning-soft)' : 'var(--success-soft)',
        color: isWarn ? 'var(--warning)' : 'var(--success)',
      }}
    >
      <span
        aria-hidden
        className="size-[5px] rounded-full"
        style={{ background: isWarn ? 'var(--warning)' : 'var(--success)' }}
      />
      {children}
    </span>
  );
}
