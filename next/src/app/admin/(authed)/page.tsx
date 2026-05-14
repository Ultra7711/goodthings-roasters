/* ══════════════════════════════════════════
   Admin Dashboard (/admin) — S130 Group I-1: 시안 inline UI 유지 + RPC 실 데이터.
   - admin_dashboard_overview RPC 1 round-trip → stats / tasks / recent / bestsellers.
   - 시안 dashboard.jsx 의 stat 카드 + 최근 주문 + 사이드 위젯 슬롯 그대로.
   - S171: pending_orders 카드 제거 (무통장입금 잔재) → 3 카드 grid.
   ══════════════════════════════════════════ */

import Link from 'next/link';
import { Suspense } from 'react';
import { getAdminClaims } from '@/lib/auth/getClaims';
import { fetchAdminDashboard } from '@/lib/admin/dashboardServer';
import { bestsellerPercents } from '@/lib/admin/dashboard';
import { Badge as ShadcnBadge } from '@/components/admin/ui/badge';

const TONE_BG: Record<string, string> = {
  primary: 'var(--primary-soft)',
  warning: 'var(--warning-soft)',
  danger: 'var(--danger-soft)',
  info: 'var(--info-soft)',
  success: 'var(--success-soft)',
  neutral: 'var(--neutral-soft)',
};
const TONE_FG: Record<string, string> = {
  primary: 'var(--primary-soft-fg)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  info: 'var(--info)',
  success: 'var(--success)',
  neutral: 'var(--neutral-soft-fg)',
};

const TODAY_LABEL = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
}).format(new Date());

/* S223 Phase 2-b: CARD_STYLE 폐기 (Tailwind className bg-card border border-border rounded-lg). */

/* shadcn Badge variant="outline" + tone soft 매트릭스 style override (DEC-2). */
function Badge({ tone, children }: { tone: keyof typeof TONE_BG; children: React.ReactNode }) {
  return (
    <ShadcnBadge
      variant="outline"
      className="border-transparent"
      style={{ background: TONE_BG[tone], color: TONE_FG[tone] }}
    >
      {children}
    </ShadcnBadge>
  );
}

const ChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

function WelcomeHeading() {
  return (
    <Suspense fallback={<WelcomeFallback />}>
      <WelcomeHeadingInner />
    </Suspense>
  );
}

async function WelcomeHeadingInner() {
  const claims = await getAdminClaims();
  const name = claims?.displayName?.trim() || claims?.email.split('@')[0] || '운영자';
  return (
    <h2 className="m-0 text-2xl font-medium tracking-tight">
      안녕하세요, {name}님
    </h2>
  );
}

function WelcomeFallback() {
  return (
    <h2 className="m-0 text-2xl font-medium tracking-tight">
      안녕하세요
    </h2>
  );
}

export default async function AdminDashboardPage() {
  const overview = await fetchAdminDashboard();
  const { stats, tasks, recentOrders, bestsellers } = overview;
  const bestsellerPcts = bestsellerPercents(bestsellers);

  return (
    <div>
      {/* 환영 헤더 — AdminPageHeader 패턴 답습 (WelcomeHeading = ReactNode 이므로 인라인) */}
      <div className="mb-5">
        <WelcomeHeading />
        <div className="mt-1 text-sm text-muted-foreground">
          {TODAY_LABEL} · 오늘 운영 현황을 한눈에 확인하세요.
        </div>
      </div>

      {/* stats grid */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-card border border-border rounded-lg p-5 relative overflow-hidden"
          >
            {s.accent && (
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-[var(--primary)]" />
            )}
            {s.warn && (
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-[var(--warning)]" />
            )}
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
            <div
              className="gtr-tnum mt-2.5 text-2xl font-medium tracking-tight text-foreground leading-normal"
            >
              {s.value}
            </div>
            <div className="mt-2 text-xs text-[var(--foreground-subtle)]">
              {s.sub}
            </div>
          </div>
        ))}
      </div>

      {/* main grid */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 320px' }}>
        {/* recent orders */}
        <div className="bg-card border border-border rounded-lg p-0">
          <div className="px-5 py-3 flex items-center justify-between border-b border-border">
            <h3 className="m-0 text-base font-medium">최근 주문</h3>
            <Link
              href="/admin/orders"
              className="text-xs text-muted-foreground flex items-center gap-0.5 no-underline"
            >
              전체 보기 <ChevronRight />
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">
              아직 주문이 없습니다.
            </div>
          ) : (
            <div>
              {recentOrders.map((o, idx) => (
                <Link
                  key={o.id}
                  href={`/admin/orders/${o.orderNumber}`}
                  className="grid gap-3 px-5 py-3 text-sm text-foreground no-underline items-center"
                  style={{
                    gridTemplateColumns: '1fr auto auto',
                    borderTop: idx === 0 ? 'none' : '1px solid var(--border)',
                  }}
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex gap-2 items-baseline whitespace-nowrap overflow-hidden text-ellipsis">
                      <span className="gtr-tnum text-xs text-muted-foreground">
                        {o.orderNumber}
                      </span>
                      <span className="font-medium">{o.customerName}</span>
                    </div>
                    <div className="text-xs text-[var(--foreground-subtle)]">
                      {o.createdAtLabel}
                    </div>
                  </div>
                  <span className="gtr-tnum font-medium tabular-nums">
                    {o.totalAmountLabel}
                  </span>
                  <Badge tone={o.statusTone}>{o.statusLabel}</Badge>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* side widgets */}
        <div className="flex flex-col gap-3">
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="m-0 text-base font-medium">오늘 할 일</h3>
            <div className="mt-3 flex flex-col gap-2.5">
              {tasks.map((t) => (
                <div key={t.label} className="flex items-center justify-between text-sm">
                  <span
                    className={t.pending ? 'text-muted-foreground' : 'text-foreground'}
                  >
                    {t.label}
                    {t.pending && (
                      <span className="ml-1.5 text-xs text-[var(--foreground-subtle)]">
                        (준비 중)
                      </span>
                    )}
                  </span>
                  <Badge tone={t.tone}>{t.n}</Badge>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="m-0 text-base font-medium">이번 주 베스트셀러</h3>
            {bestsellers.length === 0 ? (
              <div className="mt-4 text-xs text-muted-foreground leading-relaxed">
                이번 주에 판매된 상품이 없습니다.
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-2.5">
                {bestsellers.map((b, idx) => (
                  <div key={b.productSlug + idx} className="text-xs">
                    <div className="flex justify-between mb-1">
                      <span className="overflow-hidden text-ellipsis whitespace-nowrap mr-2">
                        {b.label}
                      </span>
                      <span className="gtr-tnum text-muted-foreground shrink-0">
                        {b.quantity}건
                      </span>
                    </div>
                    <div className="h-1 rounded-sm bg-muted overflow-hidden">
                      <div
                        className="h-full bg-[var(--primary)] opacity-80"
                        style={{ width: `${bestsellerPcts[idx]}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
