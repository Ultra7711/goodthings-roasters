/* ══════════════════════════════════════════
   StatCard — 대시보드 통계 카드.
   - Claude Design 핸드오프: 라벨 / 수치 / delta / 부가설명 / 스파크라인 placeholder.
   - accent=true 면 카드 상단 2px clay orange 라인.
   ══════════════════════════════════════════ */

import { ArrowUp, ArrowDown } from 'lucide-react';
import { Card } from '@/components/admin/ui/card';
import { cn } from '@/lib/utils';

type Props = {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: 'up' | 'down';
  warn?: boolean;
  sub?: string;
  accent?: boolean;
  sparklinePoints?: string;
};

export default function StatCard({
  label,
  value,
  delta,
  deltaTone = 'up',
  warn = false,
  sub,
  accent = false,
  sparklinePoints = '0,22 14,18 28,16 42,12 56,14 70,8 84,10 100,4',
}: Props) {
  const deltaColor = deltaTone === 'up'
    ? (warn ? 'var(--warning)' : 'var(--success)')
    : (warn ? 'var(--success)' : 'var(--danger)');

  return (
    <Card className="relative gap-0 overflow-hidden p-[18px]">
      {accent && (
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-0.5"
          style={{ background: 'var(--primary)' }}
        />
      )}
      <div className="flex items-center justify-between">
        <div className="text-[12.5px]" style={{ color: 'var(--foreground-muted)' }}>
          {label}
        </div>
        {delta && (
          <span
            className="gtr-tnum inline-flex items-center gap-0.5 text-[11px] font-semibold"
            style={{ color: deltaColor }}
          >
            {deltaTone === 'up' ? (
              <ArrowUp size={11} strokeWidth={2.4} />
            ) : (
              <ArrowDown size={11} strokeWidth={2.4} />
            )}
            {delta}
          </span>
        )}
      </div>
      <div
        className={cn('gtr-tnum mt-2.5 text-[28px] font-medium leading-tight')}
        style={{ letterSpacing: '-0.02em', color: 'var(--foreground)' }}
      >
        {value}
      </div>
      {sub && (
        <div
          className="mt-2 text-[11.5px]"
          style={{ color: 'var(--foreground-subtle)' }}
        >
          {sub}
        </div>
      )}
      <svg
        width="100%"
        height="28"
        viewBox="0 0 100 28"
        preserveAspectRatio="none"
        className="mt-2.5 block"
        aria-hidden
      >
        <polyline
          points={sparklinePoints}
          fill="none"
          stroke={accent ? 'var(--primary)' : 'var(--border-strong)'}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Card>
  );
}
