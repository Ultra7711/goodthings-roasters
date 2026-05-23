/* ══════════════════════════════════════════
   _shared/SettingsCard.tsx — settings 4 섹션 공용 카드 (S256-A 분리)

   - title + subtitle + Switch (활/비활) 헤더
   - children 영역 활성 시 opacity 1 / 비활성 시 0.5
   ══════════════════════════════════════════ */

import { Switch } from '@/components/admin/ui/switch';

interface SettingsCardProps {
  title: string;
  subtitle: string;
  on: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function SettingsCard({
  title,
  subtitle,
  on,
  onToggle,
  children,
}: SettingsCardProps) {
  return (
    <div className="bg-[var(--surface)] border border-border rounded-[var(--radius)]">
      <div className="px-6 py-4 border-b border-border flex items-center gap-3">
        <div className="flex-1">
          <h3 className="m-0 text-sm font-medium">{title}</h3>
          <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>
        </div>
        <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
          <Switch
            checked={on}
            onCheckedChange={() => onToggle()}
            aria-label={on ? `${title} — 비활성으로 전환` : `${title} — 활성으로 전환`}
            className="data-[state=unchecked]:bg-[var(--switch-off-bg)]"
          />
          <span className="text-muted-foreground">
            {on ? '활성' : '비활성'}
          </span>
        </label>
      </div>
      <div
        className="p-6 transition-opacity duration-150"
        style={{ opacity: on ? 1 : 0.5 }}
      >
        {children}
      </div>
    </div>
  );
}
