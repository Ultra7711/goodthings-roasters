/* ══════════════════════════════════════════
   BrandMark — 어드민 로고 마크
   - 사이드바 헤더·로그인 카드 등 다중 사용처.
   - light=true 면 흰 배경용 (검정 마크), 기본은 사이드바용 (clay orange 마크).
   ══════════════════════════════════════════ */

import { cn } from '@/lib/utils';

type Props = {
  light?: boolean;
  size?: number;
  showText?: boolean;
};

export default function BrandMark({ light = false, size = 28, showText = true }: Props) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={cn(
          'flex items-center justify-center rounded-lg text-white font-medium',
          light ? 'bg-[var(--foreground)]' : 'bg-[var(--sidebar-accent)]',
        )}
        style={{
          width: size,
          height: size,
          fontSize: size * 0.55,
          letterSpacing: '-0.02em',
        }}
      >
        G
      </div>
      {showText && (
        <div className="leading-tight">
          <div
            className={cn(
              'text-sm font-medium',
              light ? 'text-[var(--foreground)]' : 'text-[var(--sidebar-fg)]',
            )}
            style={{ letterSpacing: '-0.01em' }}
          >
            Good Things
          </div>
          <div
            className={cn(
              'text-[10px] font-medium uppercase',
              light
                ? 'text-[var(--foreground-muted)]'
                : 'text-[var(--sidebar-fg-muted)]',
            )}
            style={{ letterSpacing: '0.08em' }}
          >
            Roasters · Admin
          </div>
        </div>
      )}
    </div>
  );
}
