/* ══════════════════════════════════════════
   Admin Dashboard (/admin) — S130 Group I-1: 시안 inline UI 유지 + RPC 실 데이터.
   - admin_dashboard_overview RPC 1 round-trip → stats / tasks / recent / bestsellers.
   - 시안 dashboard.jsx 의 4 카드 + 최근 주문 + 사이드 위젯 슬롯 그대로.
   ══════════════════════════════════════════ */

import Link from 'next/link';
import { Suspense, type CSSProperties } from 'react';
import { getAdminClaims } from '@/lib/auth/getClaims';
import { fetchAdminDashboard } from '@/lib/admin/dashboardServer';
import { bestsellerPercents } from '@/lib/admin/dashboard';
import DashboardActions from './DashboardActions';

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

const CARD_STYLE: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
};

function Badge({ tone, children }: { tone: keyof typeof TONE_BG; children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        borderRadius: 999,
        background: TONE_BG[tone],
        color: TONE_FG[tone],
        fontSize: 11.5,
        fontWeight: 500,
        letterSpacing: '-0.005em',
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
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
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
      <h2
        style={{
          margin: 0,
          fontSize: 28,
          fontWeight: 500,
          letterSpacing: '-0.02em',
        }}
      >
        안녕하세요, {name}님
      </h2>
      <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>{TODAY_LABEL}</span>
    </div>
  );
}

function WelcomeFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
      <h2
        style={{
          margin: 0,
          fontSize: 28,
          fontWeight: 500,
          letterSpacing: '-0.02em',
        }}
      >
        안녕하세요
      </h2>
      <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>{TODAY_LABEL}</span>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const overview = await fetchAdminDashboard();
  const { stats, tasks, recentOrders, bestsellers } = overview;
  const bestsellerPcts = bestsellerPercents(bestsellers);

  return (
    <div>
      {/* Topbar actions slot */}
      <DashboardActions />

      {/* 환영 헤더 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 22 }}>
        <WelcomeHeading />
        <div style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
          오늘 운영 현황을 한눈에 확인하세요.
        </div>
      </div>

      {/* stats grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 22,
        }}
      >
        {stats.map((s) => (
          <div
            key={s.label}
            style={{
              ...CARD_STYLE,
              padding: 18,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {s.accent && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: 'var(--primary)',
                }}
              />
            )}
            {s.warn && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: 'var(--warning)',
                }}
              />
            )}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ fontSize: 12.5, color: 'var(--foreground-muted)' }}>{s.label}</div>
            </div>
            <div
              className="gtr-tnum"
              style={{
                marginTop: 10,
                fontSize: 28,
                fontWeight: 500,
                letterSpacing: '-0.02em',
                color: 'var(--foreground)',
                lineHeight: 1.1,
              }}
            >
              {s.value}
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 11.5,
                color: 'var(--foreground-subtle)',
              }}
            >
              {s.sub}
            </div>
          </div>
        ))}
      </div>

      {/* main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
        {/* recent orders */}
        <div style={{ ...CARD_STYLE, padding: 0 }}>
          <div
            style={{
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 500,
              }}
            >
              최근 주문
            </h3>
            <Link
              href="/admin/orders"
              style={{
                fontSize: 12,
                color: 'var(--foreground-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                textDecoration: 'none',
              }}
            >
              전체 보기 <ChevronRight />
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <div
              style={{
                padding: '48px 18px',
                textAlign: 'center',
                fontSize: 13,
                color: 'var(--foreground-muted)',
              }}
            >
              아직 주문이 없습니다.
            </div>
          ) : (
            <div>
              {recentOrders.map((o, idx) => (
                <Link
                  key={o.id}
                  href={`/admin/orders/${o.orderNumber}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto',
                    gap: 12,
                    padding: '12px 18px',
                    borderTop: idx === 0 ? 'none' : '1px solid var(--border)',
                    fontSize: 13,
                    color: 'var(--foreground)',
                    textDecoration: 'none',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'baseline',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      <span
                        className="gtr-tnum"
                        style={{ fontSize: 12, color: 'var(--foreground-muted)' }}
                      >
                        {o.orderNumber}
                      </span>
                      <span style={{ fontWeight: 500 }}>{o.customerName}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--foreground-subtle)' }}>
                      {o.createdAtLabel}
                    </div>
                  </div>
                  <span
                    className="gtr-tnum"
                    style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {o.totalAmountLabel}
                  </span>
                  <Badge tone={o.statusTone}>{o.statusLabel}</Badge>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* side widgets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ ...CARD_STYLE, padding: 18 }}>
            <h3
              style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 500,
              }}
            >
              오늘 할 일
            </h3>
            <div
              style={{
                marginTop: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {tasks.map((t) => (
                <div
                  key={t.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 13,
                  }}
                >
                  <span
                    style={{
                      color: t.pending ? 'var(--foreground-muted)' : 'var(--foreground)',
                    }}
                  >
                    {t.label}
                    {t.pending && (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 11,
                          color: 'var(--foreground-subtle)',
                        }}
                      >
                        (준비 중)
                      </span>
                    )}
                  </span>
                  <Badge tone={t.tone}>{t.n}</Badge>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...CARD_STYLE, padding: 18 }}>
            <h3
              style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 500,
              }}
            >
              이번 주 베스트셀러
            </h3>
            {bestsellers.length === 0 ? (
              <div
                style={{
                  marginTop: 16,
                  fontSize: 12.5,
                  color: 'var(--foreground-muted)',
                  lineHeight: 1.6,
                }}
              >
                이번 주에 판매된 상품이 없습니다.
              </div>
            ) : (
              <div
                style={{
                  marginTop: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {bestsellers.map((b, idx) => (
                  <div key={b.productSlug + idx} style={{ fontSize: 12.5 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginRight: 8,
                        }}
                      >
                        {b.label}
                      </span>
                      <span
                        className="gtr-tnum"
                        style={{ color: 'var(--foreground-muted)', flexShrink: 0 }}
                      >
                        {b.quantity}건
                      </span>
                    </div>
                    <div
                      style={{
                        height: 4,
                        borderRadius: 2,
                        background: 'var(--surface-muted)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${bestsellerPcts[idx]}%`,
                          background: 'var(--primary)',
                          opacity: 0.8,
                        }}
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
