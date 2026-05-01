/* ══════════════════════════════════════════
   Admin Dashboard (/admin) — S125: 시안 dashboard.jsx 100% inline style 이식.
   - 데이터는 모두 placeholder (실데이터는 Group I 에서 연결).
   - 시안 시각 (환영 헤더 + 4 stat cards + 최근 주문 + 사이드 위젯) 그대로.
   ══════════════════════════════════════════ */

import { Suspense, type CSSProperties } from 'react';
import { getAdminClaims } from '@/lib/auth/getClaims';
import DashboardActions from './DashboardActions';

type Stat = {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
  warn?: boolean;
};

const STATS: Stat[] = [
  { label: '오늘 주문', value: '—', sub: 'Group I-1 에서 채워질 예정', accent: true },
  { label: '이번 주 매출', value: '—', sub: 'Group I-1 에서 채워질 예정' },
  { label: '활성 정기배송', value: '—', sub: 'Group I-1 에서 채워질 예정' },
  { label: '대기 주문', value: '—', sub: 'Group I-1 에서 채워질 예정', warn: true },
];

const TASKS: { label: string; n: number; tone: 'primary' | 'warning' | 'danger' | 'info' }[] = [
  { label: '신규 주문 처리', n: 0, tone: 'primary' },
  { label: '로스팅 일정 확정', n: 0, tone: 'warning' },
  { label: '재고 알림', n: 0, tone: 'danger' },
  { label: '발송 대기', n: 0, tone: 'info' },
];

const BESTSELLERS: [string, number][] = [
  ['에티오피아 예가체프 · 200g', 0],
  ['하우스 블렌드 · 500g', 0],
  ['콜롬비아 핑크버번', 0],
  ['드립백 선물세트', 0],
];

const TONE_BG: Record<string, string> = {
  primary: 'var(--primary-soft)',
  warning: 'var(--warning-soft)',
  danger: 'var(--danger-soft)',
  info: 'var(--info-soft)',
};
const TONE_FG: Record<string, string> = {
  primary: 'var(--primary-soft-fg)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  info: 'var(--info)',
};

const TODAY_LABEL = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
}).format(new Date());

/* 시안 Card style — inline */
const CARD_STYLE: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
};

/* 시안 Badge style */
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
          fontFamily: 'var(--font-serif)',
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
          fontFamily: 'var(--font-serif)',
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

export default function AdminDashboardPage() {
  return (
    <div>
      {/* Topbar actions slot 으로 inject — 시안 dashboard.jsx 의 actions prop 매칭 */}
      <DashboardActions />

      {/* 환영 헤더 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 22 }}>
        <WelcomeHeading />
        <div style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
          어드민 콘솔 인프라 구축 단계입니다. 실데이터는 Group I 통계 그룹에서 연결됩니다.
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
        {STATS.map((s) => (
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
              style={{
                marginTop: 10,
                fontFamily: 'var(--font-serif)',
                fontSize: 28,
                fontWeight: 500,
                letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums',
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
            <svg
              width="100%"
              height="28"
              viewBox="0 0 100 28"
              preserveAspectRatio="none"
              style={{ marginTop: 10, display: 'block' }}
              aria-hidden
            >
              <polyline
                points="0,22 14,18 28,16 42,12 56,14 70,8 84,10 100,4"
                fill="none"
                stroke={s.accent ? 'var(--primary)' : 'var(--border-strong)'}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h3
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-serif)',
                  fontSize: 15,
                  fontWeight: 500,
                }}
              >
                최근 주문
              </h3>
              <Badge tone="primary">Group B 구현 예정</Badge>
            </div>
            <span
              style={{
                fontSize: 12,
                color: 'var(--foreground-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                cursor: 'pointer',
              }}
            >
              전체 보기 <ChevronRight />
            </span>
          </div>
          <div
            style={{
              padding: '48px 18px',
              textAlign: 'center',
              fontSize: 13,
              color: 'var(--foreground-muted)',
            }}
          >
            주문 데이터가 연결되면 최근 5건이 여기에 표시됩니다.
          </div>
        </div>

        {/* side widgets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ ...CARD_STYLE, padding: 18 }}>
            <h3
              style={{
                margin: 0,
                fontFamily: 'var(--font-serif)',
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
              {TASKS.map((t) => (
                <div
                  key={t.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 13,
                  }}
                >
                  <span>{t.label}</span>
                  <Badge tone={t.tone}>{t.n}</Badge>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...CARD_STYLE, padding: 18 }}>
            <h3
              style={{
                margin: 0,
                fontFamily: 'var(--font-serif)',
                fontSize: 15,
                fontWeight: 500,
              }}
            >
              이번 주 베스트셀러
            </h3>
            <div
              style={{
                marginTop: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {BESTSELLERS.map(([n, q]) => (
                <div key={n} style={{ fontSize: 12.5 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 4,
                    }}
                  >
                    <span>{n}</span>
                    <span
                      className="gtr-tnum"
                      style={{ color: 'var(--foreground-muted)' }}
                    >
                      {q}건
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
                        width: `${q > 0 ? (q / 100) * 100 : 0}%`,
                        background: 'var(--primary)',
                        opacity: 0.8,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
