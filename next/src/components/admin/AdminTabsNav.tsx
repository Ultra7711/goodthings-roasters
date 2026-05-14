'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

/* ══════════════════════════════════════════════════════════════════════════
   AdminTabsNav — 어드민 status / category 탭 표준 (S227 DEC-11)

   답습 source (3 페이지 inline 답습 폐기):
   - OrdersTableClient.tsx:181-214 (URL state + count badge + primary indicator)
   - UsersTableClient.tsx · SubscriptionsTableClient.tsx 동일 구조
   - ProductsTableClient.tsx (local state button — 동일 패턴)

   기준 (admin-design.md §5-4):
   - Container = flex gap-1 border-b border-border mb-4
   - 활성: font-medium text-foreground + 바닥 1px primary indicator
   - 비활성: font-normal text-muted-foreground
   - count badge: text-xs tabular-nums + 활성 bg-muted / 비활성 transparent

   discriminated union — URL state vs local state 양 모드:
   - mode 'url'   = buildHref(id) → Link href (router state)
   - mode 'state' = onChange(id) → button onClick (local state)

   shadcn `Tabs` primitive 미사용 사유: 별도 line variant 가 있으나 indicator
   위치 / count badge 합성 / URL Link 답습이 어색. 직접 합성이 명료
   (admin-design.md §5-4 답습 그대로).

   참조: ADR-009 · admin-design.md §5-4 · §13
   ══════════════════════════════════════════════════════════════════════════ */

export type AdminTab = {
  id: string;
  label: string;
  count?: number;
};

type AdminTabsNavProps = {
  tabs: readonly AdminTab[];
  active: string;
  /** 기본 'mb-4'. caller 가 spacing override 필요 시. */
  className?: string;
} & (
  | { mode: 'url'; buildHref: (id: string) => string }
  | { mode: 'state'; onChange: (id: string) => void }
);

export function AdminTabsNav(props: AdminTabsNavProps) {
  const { tabs, active, className = 'mb-4' } = props;
  return (
    <div className={cn('flex gap-1 border-b border-border', className)}>
      {tabs.map((t) => (
        <TabItem key={t.id} tab={t} active={t.id === active} props={props} />
      ))}
    </div>
  );
}

function TabItem({
  tab,
  active,
  props,
}: {
  tab: AdminTab;
  active: boolean;
  props: AdminTabsNavProps;
}) {
  /* font-medium base — active/inactive 동일 weight 로 좌우 간격 변동 회피.
     active 시각 cue = text color + 하단 primary bar + count badge bg. */
  const labelClass = cn(
    'px-3 py-2 bg-transparent cursor-pointer text-sm font-medium relative flex items-center gap-1.5 no-underline',
    active ? 'text-foreground' : 'text-muted-foreground',
  );
  const countClass = cn(
    'text-xs tabular-nums rounded-sm',
    active
      ? 'bg-[var(--primary)] !text-white'
      : 'text-[var(--foreground-subtle)] bg-transparent',
  );

  const inner = (
    <>
      {tab.label}
      {tab.count != null && (
        <span className={countClass} style={{ padding: '1px 6px' }}>
          {tab.count.toLocaleString()}
        </span>
      )}
      {active && (
        <div
          className="absolute left-0 right-0 h-0.5 bg-[var(--primary)]"
          style={{ bottom: -1 }}
          aria-hidden="true"
        />
      )}
    </>
  );

  if (props.mode === 'url') {
    return (
      <Link
        href={props.buildHref(tab.id)}
        replace
        className={labelClass}
        aria-current={active ? 'page' : undefined}
      >
        {inner}
      </Link>
    );
  }

  /* data-slot="tabs-nav-item" — admin-theme.css 의 `button:not([data-slot])`
     color/font reset 회피용. 미적용 시 Tailwind text-foreground/muted 가
     `color: inherit` 으로 무력화되어 mode='state' 탭만 색 깨짐 (S228 회귀). */
  return (
    <button
      type="button"
      data-slot="tabs-nav-item"
      onClick={() => props.onChange(tab.id)}
      className={labelClass}
      aria-pressed={active}
    >
      {inner}
    </button>
  );
}
