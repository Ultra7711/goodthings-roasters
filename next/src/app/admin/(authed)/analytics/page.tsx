/* ══════════════════════════════════════════
   AdminAnalyticsPage — S130 Group I-2: readiness 판정 + 실 데이터 매출 통계.
   - 미달 (50건/14일 미만): 시안 empty.jsx 그대로 + 실제 cur 값으로 progress.
   - 충족: period switcher + 4 stat cards + 상품별 테이블.
   ══════════════════════════════════════════ */

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { fetchAdminAnalytics } from '@/lib/admin/analyticsServer';
import {
  ANALYTICS_PERIOD_OPTIONS,
  type AnalyticsPeriodKey,
} from '@/lib/admin/analytics';
import AnalyticsActions from './AnalyticsActions';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const CARD_STYLE: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
};

export default async function AdminAnalyticsPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const view = await fetchAdminAnalytics(raw);

  return (
    <>
      <AnalyticsActions />

      {/* 환영 헤더 */}
      <div style={{ marginBottom: 22 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 500,
            letterSpacing: '-0.02em',
          }}
        >
          매출 통계
        </h2>
        <div style={{ marginTop: 4, fontSize: 13, color: 'var(--foreground-muted)' }}>
          {view.readiness.ready
            ? '기간별 매출, 상품별 판매량을 확인하세요.'
            : '기간별 매출, 카테고리별 판매량, 정기배송 추이를 한눈에 보세요.'}
        </div>
      </div>

      {view.readiness.ready ? <ReadyView view={view} /> : <NotReadyView readiness={view.readiness} />}
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
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 16,
        }}
      >
        {PLACEHOLDER_STAT_LABELS.map((label) => (
          <div
            key={label}
            style={{
              ...CARD_STYLE,
              padding: 18,
              opacity: 0.55,
            }}
          >
            <div style={{ fontSize: 12.5, color: 'var(--foreground-muted)' }}>{label}</div>
            <div
              style={{
                marginTop: 12,
                height: 28,
                width: '60%',
                borderRadius: 4,
                background:
                  'repeating-linear-gradient(90deg, var(--surface-muted) 0 6px, transparent 6px 10px)',
              }}
            />
            <div
              style={{
                marginTop: 10,
                height: 8,
                width: '40%',
                borderRadius: 4,
                background: 'var(--surface-muted)',
              }}
            />
          </div>
        ))}
      </div>

      {/* main empty card */}
      <div style={{ ...CARD_STYLE, padding: 0 }}>
        <div
          style={{
            padding: '64px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* faint grid backdrop */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.4,
              backgroundImage:
                'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
              maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
              WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          {/* 일러스트: 5-bar chart 카드 + badge */}
          <div
            style={{
              position: 'relative',
              width: 120,
              height: 90,
              marginBottom: 20,
              borderRadius: 8,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'flex-end',
              padding: 14,
              gap: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
            }}
          >
            {[14, 26, 18, 32, 22].map((h, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: h,
                  borderRadius: 2,
                  background: i === 3 ? 'var(--primary)' : 'var(--border-strong)',
                  opacity: i === 3 ? 0.9 : 0.6,
                }}
              />
            ))}
            <div
              style={{
                position: 'absolute',
                top: -10,
                right: -10,
                width: 28,
                height: 28,
                borderRadius: 999,
                background: 'var(--primary-soft)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
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

          <h3
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 500,
              letterSpacing: '-0.015em',
              position: 'relative',
            }}
          >
            아직 분석할 데이터가 부족해요
          </h3>
          <p
            style={{
              margin: '8px 0 0',
              maxWidth: 420,
              fontSize: 13.5,
              lineHeight: 1.7,
              color: 'var(--foreground-muted)',
              position: 'relative',
            }}
          >
            통계 리포트는 최소{' '}
            <strong style={{ color: 'var(--foreground)' }}>주문 {readiness.ordersMax}건</strong> 또는{' '}
            <strong style={{ color: 'var(--foreground)' }}>운영 {readiness.daysMax}일</strong>이 지나야 정확한 인사이트를
            보여드려요. 현재까지{' '}
            <strong style={{ color: 'var(--foreground)' }}>
              주문 {readiness.ordersCur}건 · 운영 {readiness.daysCur}일
            </strong>
            이 누적됐어요.
          </p>

          {/* progress bars */}
          <div
            style={{
              position: 'relative',
              width: 320,
              marginTop: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {progress.map(({ label, cur, max, unit }) => (
              <div key={label}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    marginBottom: 5,
                  }}
                >
                  <span style={{ color: 'var(--foreground-muted)' }}>{label}</span>
                  <span className="gtr-tnum" style={{ fontWeight: 500 }}>
                    {cur} / {max} {unit}
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 999,
                    background: 'var(--surface-muted)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, (cur / max) * 100)}%`,
                      background: 'var(--primary)',
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* CTA buttons */}
          <div style={{ marginTop: 28, display: 'flex', gap: 8, position: 'relative' }}>
            <Link
              href="/admin/orders"
              style={{
                padding: '7px 14px',
                fontSize: 13,
                height: 34,
                gap: 6,
                borderRadius: 6,
                fontWeight: 500,
                background: 'var(--primary)',
                color: '#fff',
                border: '1px solid var(--primary)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
                letterSpacing: '-0.005em',
              }}
            >
              주문 목록 열기
            </Link>
          </div>

          {/* 팁 */}
          <div
            style={{
              position: 'relative',
              marginTop: 32,
              padding: '12px 16px',
              borderRadius: 6,
              background: 'var(--surface-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 12,
              color: 'var(--foreground-muted)',
              maxWidth: 460,
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                flexShrink: 0,
                borderRadius: 999,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
              }}
            >
              💡
            </span>
            <span>
              <strong style={{ color: 'var(--foreground)' }}>팁.</strong> 사이트 설정에서 오픈 공지를 등록하면 첫 주문이
              평균 3배 빨라져요.
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
      <div
        style={{
          display: 'flex',
          gap: 6,
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
        {ANALYTICS_PERIOD_OPTIONS.map((opt) => {
          const active = view.period === opt.id;
          return (
            <Link
              key={opt.id}
              href={`/admin/analytics?period=${opt.id}`}
              style={{
                padding: '6px 12px',
                fontSize: 12.5,
                borderRadius: 6,
                border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                background: active ? 'var(--primary-soft)' : 'var(--surface)',
                color: active ? 'var(--primary)' : 'var(--foreground)',
                textDecoration: 'none',
                fontWeight: active ? 500 : 400,
              }}
            >
              {opt.label}
            </Link>
          );
        })}
      </div>

      {/* 4 stat cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 16,
        }}
      >
        {view.stats.map((s) => (
          <div key={s.label} style={{ ...CARD_STYLE, padding: 18 }}>
            <div style={{ fontSize: 12.5, color: 'var(--foreground-muted)' }}>{s.label}</div>
            <div
              className="gtr-tnum"
              style={{
                marginTop: 10,
                fontSize: 24,
                fontWeight: 500,
                letterSpacing: '-0.02em',
                color: 'var(--foreground)',
                lineHeight: 1.1,
              }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* 상품별 테이블 */}
      <div style={{ ...CARD_STYLE, padding: 0 }}>
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>상품별 판매</h3>
          <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
            {view.products.length}개 상품
          </span>
        </div>

        {view.products.length === 0 ? (
          <div
            style={{
              padding: '48px 18px',
              textAlign: 'center',
              fontSize: 13,
              color: 'var(--foreground-muted)',
            }}
          >
            선택한 기간에 판매된 상품이 없습니다.
          </div>
        ) : (
          <div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 100px 100px 130px',
                gap: 12,
                padding: '10px 18px',
                background: 'var(--surface-muted)',
                fontSize: 11.5,
                fontWeight: 500,
                color: 'var(--foreground-muted)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div>상품</div>
              <div style={{ textAlign: 'right' }}>판매량</div>
              <div style={{ textAlign: 'right' }}>주문 수</div>
              <div style={{ textAlign: 'right' }}>매출</div>
            </div>
            {view.products.map((p, idx) => (
              <div
                key={p.productSlug + idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 100px 100px 130px',
                  gap: 12,
                  padding: '12px 18px',
                  borderTop: idx === 0 ? 'none' : '1px solid var(--border)',
                  fontSize: 13,
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.label}
                </div>
                <div className="gtr-tnum" style={{ textAlign: 'right' }}>
                  {p.quantityLabel}
                </div>
                <div
                  className="gtr-tnum"
                  style={{ textAlign: 'right', color: 'var(--foreground-muted)' }}
                >
                  {p.orderCount}
                </div>
                <div
                  className="gtr-tnum"
                  style={{ textAlign: 'right', fontWeight: 500 }}
                >
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
