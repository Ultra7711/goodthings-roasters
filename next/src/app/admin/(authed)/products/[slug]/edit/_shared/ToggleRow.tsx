/* ══════════════════════════════════════════
   _shared/ToggleRow.tsx — subscription / popup 토글 행 (S260 분리)

   label + hint + Switch. RHF Controller 통합.
   ══════════════════════════════════════════ */

import { Controller, type Control } from 'react-hook-form';
import { Switch } from '@/components/admin/ui/switch';
import type { FormValues } from './schema';

export function ToggleRow({
  label,
  hint,
  name,
  control,
}: {
  label: string;
  hint: string;
  name: 'subscription' | 'popup';
  control: Control<FormValues>;
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">{label}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
          </div>
          <Switch
            checked={!!field.value}
            onCheckedChange={field.onChange}
            aria-label={field.value ? `${label} 켜짐` : `${label} 꺼짐`}
            className="data-[state=unchecked]:bg-[var(--switch-off-bg)]"
          />
        </div>
      )}
    />
  );
}
