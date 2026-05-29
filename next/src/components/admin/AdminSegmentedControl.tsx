'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

/* ══════════════════════════════════════════════════════════════════════════
   AdminSegmentedControl — 어드민 서브 필터 세그먼트 컨트롤 (S250-2)

   AdminTabsNav(언더라인 탭) 와 동일 페이지에서 두 단계 필터가 겹칠 때
   (예: 섹션 탭 + 상태 필터) 두 번째 단계를 시각적으로 구분하기 위한 pill 형 토글.

   - 컨테이너 = bg-muted 둥근 트랙 + 활성 세그먼트 bg-card + shadow (iOS 스타일)
   - AdminTabsNav 와 동일한 discriminated union (url / state) + count badge.
   - mode 'state' 버튼은 data-slot 으로 admin-theme.css 의 button color reset 회피
     (AdminTabsNav S228 회귀 노트 답습).
   ══════════════════════════════════════════════════════════════════════════ */

export type AdminSegment = {
  id: string;
  label: string;
  count?: number;
};

type AdminSegmentedControlProps = {
  segments: readonly AdminSegment[];
  active: string;
  /** 기본 'mb-4'. caller spacing override 용. */
  className?: string;
} & (
  | { mode: 'url'; buildHref: (id: string) => string }
  | { mode: 'state'; onChange: (id: string) => void }
);

export function AdminSegmentedControl(props: AdminSegmentedControlProps) {
  const { segments, active, className = 'mb-4' } = props;
  return (
    <div className={cn('inline-flex items-center gap-0.5 rounded-md bg-muted p-0.5', className)}>
      {segments.map((s) => (
        <SegmentItem key={s.id} segment={s} active={s.id === active} props={props} />
      ))}
    </div>
  );
}

function SegmentItem({
  segment,
  active,
  props,
}: {
  segment: AdminSegment;
  active: boolean;
  props: AdminSegmentedControlProps;
}) {
  const itemClass = cn(
    'px-3 py-1 rounded text-sm font-medium flex items-center gap-1.5 no-underline transition-colors cursor-pointer',
    active
      ? 'bg-card text-foreground shadow-sm'
      : 'text-muted-foreground hover:text-foreground',
  );
  const countClass = cn(
    'text-xs tabular-nums',
    active ? 'text-[var(--primary)]' : 'text-[var(--foreground-subtle)]',
  );

  const inner = (
    <>
      {segment.label}
      {segment.count != null && <span className={countClass}>{segment.count.toLocaleString()}</span>}
    </>
  );

  if (props.mode === 'url') {
    return (
      <Link
        href={props.buildHref(segment.id)}
        replace
        className={itemClass}
        aria-current={active ? 'page' : undefined}
      >
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      data-slot="segmented-control-item"
      onClick={() => props.onChange(segment.id)}
      className={itemClass}
      aria-pressed={active}
    >
      {inner}
    </button>
  );
}
