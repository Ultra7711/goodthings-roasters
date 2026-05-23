/* ══════════════════════════════════════════
   _shared/SubCard.tsx — Signature 섹션 내부 sub-card (S256-A 분리)

   - title + subtitle (string · JSX 허용) + optional action slot
   - 현재 caller: SignatureSubForm 4 곳 (이미지/HTML/aspect/메타)
   ══════════════════════════════════════════ */

interface SubCardProps {
  title: string;
  /** string · JSX 모두 허용 (의미 단위 줄바꿈 시 fragment + <br/> 사용). */
  subtitle: React.ReactNode;
  children: React.ReactNode;
  /** 우측 상단 액션 슬롯 (예: AI prompt 복사 버튼). */
  action?: React.ReactNode;
}

export function SubCard({ title, subtitle, children, action }: SubCardProps) {
  return (
    <div className="bg-[var(--surface)] border border-border rounded-md overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="m-0 text-sm font-medium">{title}</h4>
          <div className="text-xs text-[var(--foreground-muted)] mt-0.5 leading-relaxed">{subtitle}</div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
