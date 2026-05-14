/* ══════════════════════════════════════════
   AdminAnalyticsPage — S130 Group I-2: readiness 판정 + 실 데이터 매출 통계.
   - 미달 (50건/14일 미만): 시안 empty.jsx 그대로 + 실제 cur 값으로 progress.
   - 충족: period switcher + 4 stat cards + 상품별 테이블.
   ══════════════════════════════════════════ */

import Link from 'next/link';
import { fetchAdminAnalytics } from '@/lib/admin/analyticsServer';
import {
  ANALYTICS_PERIOD_OPTIONS,
  type AnalyticsPeriodKey,
} from '@/lib/admin/analytics';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import AnalyticsActions from './AnalyticsActions';
import { cn } from '@/lib/utils';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const CARD_CLASS =
  'bg-[var(--surface)] border border-border rounded-[var(--radius)]';

export default async function AdminAnalyticsPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const view = await fetchAdminAnalytics(raw);

  return (
    <>
      <AnalyticsActions />

      <AdminPageHeader
        title="매출 통계"
        subtitle={
          view.readiness.ready
            ? '기간별 매출, 상품별 판매량을 확인하세요.'
            : '기간별 매출, 카테고리별 판매량, 정기배송 추이를 한눈에 보세요.'
        }
      />

      {view.readiness.ready ? (
        <ReadyView view={view} />
      ) : (
        <NotReadyView readiness={view.readiness} />
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   미달 — 시안 empty.jsx 그대로, progress bar 만 실제 cur 값으로 갱신.
   ─────────────────────────────────────────────────────────────────── */

const PLACEHOLDER_STAT_LABELS = ['총 매출', '주문 건수', '평균 객단가', '재구매율'];

function NotReadyView({
  readiness,
}: {
  readiness: { ordersCur: number; ordersMax: number; daysCur: number; daysMax: number };
}) {
  const progress = [
    { label: '주문 누적', cur: readiness.ordersCur, max: readiness.ordersMax, unit: '건' },
    { label: '운영 일수', cur: readiness.daysCur, max: readiness.daysMax, unit: '일' },
  ];

  return (
    <>
      {/* placeholder 통계 카드 4종 (disabled) */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {PLACEHOLDER_STAT_LABELS.map((label) => (
          <div key={label} className={cn(CARD_CLASS, 'p-4 opacity-50')}>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div
              className="mt-3 h-7 w-3/5 rounded-sm"
              style={{
                background:
                  'repeating-linear-gradient(90deg, var(--surface-muted) 0 6px, transparent 6px 10px)',
              }}
            />
            <div className="mt-2.5 h-2 w-2/5 rounded-sm bg-[var(--surface-muted)]" />
          </div>
        ))}
      </div>

      {/* main empty card */}
      <div className={cn(CARD_CLASS, 'p-0')}>
        <div className="px-6 py-16 flex flex-col items-center text-center relative overflow-hidden">
          {/* faint grid backdrop */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              backgroundImage:
                'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
              maskImage:
                'radial-gradient(ellipse at center, black 30%, transparent 70%)',
              WebkitMaskImage:
                'radial-gradient(ellipse at center, black 30%, transparent 70%)',
            }}
          />

          {/* 일러스트: 5-bar chart 카드 + badge */}
          <div
            className="relative mb-5 flex items-end gap-2 rounded-lg bg-[var(--surface)] border border-border"
            style={{
              width: 120,
              height: 90,
              padding: 14,
              boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
            }}
          >
            {[14, 26, 18, 32, 22].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-[2px]"
                style={{
                  height: h,
                  background: i === 3 ? 'var(--primary)' : 'var(--border-strong)',
                  opacity: i === 3 ? 0.9 : 0.6,
                }}
              />
            ))}
            <div
              className="absolute flex items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)]"
              style={{
                top: -10,
                right: -10,
                width: 28,
                height: 28,
                border: '1.5px solid var(--surface)',
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 3v18h18" />
                <path d="M7 14l4-4 4 4 6-6" />
              </svg>
            </div>
          </div>

          <h3 className="m-0 text-xl font-medium tracking-tight relative">
            아직 분석할 데이터가 부족해요
          </h3>
          <p
            className="mt-2 text-sm text-muted-foreground relative"
            style={{ maxWidth: 420, lineHeight: 1.7 }}
          >
            통계 리포트는 최소{' '}
            <strong className="text-foreground">주문 {readiness.ordersMax}건</strong> 또는{' '}
            <strong className="text-foreground">운영 {readiness.daysMax}일</strong>이 지나야 정확한 인사이트를 보여드려요.
            현재까지{' '}
            <strong className="text-foreground">
              주문 {readiness.ordersCur}건 · 운영 {readiness.daysCur}일
            </strong>
            이 누적됐어요.
          </p>

          {/* progress bars */}
          <div
            className="relative mt-6 flex flex-col gap-3"
            style={{ width: 320 }}
          >
            {progress.map(({ label, cur, max, unit }) => (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="gtr-tnum font-medium">
                    {cur} / {max} {unit}
                  </span>
                </div>
                <div
                  className="rounded-full bg-[var(--surface-muted)] overflow-hidden"
                  style={{ height: 6 }}
                >
                  <div
                    className="h-full rounded-full bg-[var(--primary)]"
                    style={{ width: `${Math.min(100, (cur / max) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="mt-7 flex gap-2 relative">
            <Link
              href="/admin/orders"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 rounded-md text-sm font-medium bg-[var(--primary)] !text-white border border-[var(--primary)] no-underline"
              style={{ height: 34 }}
            >
              주문 목록 열기
            </Link>
          </div>

          {/* 팁 */}
          <div
            className="relative mt-8 px-4 py-3 rounded-md bg-[var(--surface-muted)] flex items-center gap-2.5 text-xs text-muted-foreground"
            style={{ maxWidth: 460 }}
          >
            <span
              className="flex-shrink-0 rounded-full bg-[var(--surface)] border border-border flex items-center justify-center text-xs"
              style={{ width: 22, height: 22 }}
            >
              💡
            </span>
            <span>
              <strong className="text-foreground">팁.</strong> 사이트 설정에서 오픈 공지를 등록하면 첫 주문이 평균 3배 빨라져요.
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   충족 — period switcher + 4 stat cards + 상품 테이블.
   ─────────────────────────────────────────────────────────────────── */

function ReadyView({
  view,
}: {
  view: {
    period: AnalyticsPeriodKey;
    stats: { label: string; value: string }[];
    products: {
      productSlug: string;
      label: string;
      quantity: number;
      quantityLabel: string;
      revenue: number;
      revenueLabel: string;
      orderCount: number;
    }[];
  };
}) {
  return (
    <>
      {/* period switcher */}
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {ANALYTICS_PERIOD_OPTIONS.map((opt) => {
          const active = view.period === opt.id;
          return (
            <Link
              key={opt.id}
              href={`/admin/analytics?period=${opt.id}`}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs no-underline border',
                active
                  ? 'bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary)] font-medium'
                  : 'bg-[var(--surface)] text-foreground border-border font-normal',
              )}
            >
              {opt.label}
            </Link>
          );
        })}
      </div>

      {/* 4 stat cards */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {view.stats.map((s) => (
          <div key={s.label} className={cn(CARD_CLASS, 'p-4')}>
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div
              className="gtr-tnum mt-2.5 text-2xl font-medium tracking-tight text-foreground"
              style={{ lineHeight: 1.1 }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* 상품별 테이블 */}
      <div className={cn(CARD_CLASS, 'p-0')}>
        <div className="px-4 py-3 border-b border-border">
          <h3 className="m-0 text-base font-medium">상품별 판매</h3>
        </div>

        {view.products.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            선택한 기간에 판매된 상품이 없습니다.
          </div>
        ) : (
          <div>
            <div
              className="grid gap-3 px-4 py-2.5 bg-[var(--surface-muted)] text-xs font-medium text-muted-foreground border-b border-border"
              style={{ gridTemplateColumns: '1fr 100px 100px 130px' }}
            >
              <div>상품</div>
              <div className="text-right">판매량</div>
              <div className="text-right">주문 수</div>
              <div className="text-right">매출</div>
            </div>
            {view.products.map((p, idx) => (
              <div
                key={p.productSlug + idx}
                className={cn(
                  'grid gap-3 px-4 py-3 text-sm items-center',
                  idx !== 0 && 'border-t border-border',
                )}
                style={{ gridTemplateColumns: '1fr 100px 100px 130px' }}
              >
                <div className="overflow-hidden text-ellipsis whitespace-nowrap">
                  {p.label}
                </div>
                <div className="gtr-tnum text-right">{p.quantityLabel}</div>
                <div className="gtr-tnum text-right text-muted-foreground">
                  {p.orderCount}
                </div>
                <div className="gtr-tnum text-right font-medium">
                  {p.revenueLabel}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
