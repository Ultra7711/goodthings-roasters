/* ══════════════════════════════════════════
   AdminAnalyticsPage — 시안 empty.jsx 풀 이식 (S126).
   통계 페이지의 빈 상태(데이터 부족) — 실제 인사이트 데이터 연결은 Group I-2.
   ══════════════════════════════════════════ */

import AnalyticsActions from './AnalyticsActions';

const PLACEHOLDER_STATS = ['총 매출', '주문 건수', '평균 객단가', '재구매율'];
const PROGRESS = [
  { label: '주문 누적', cur: 23, max: 50, unit: '건' },
  { label: '운영 일수', cur: 6, max: 14, unit: '일' },
];

export default function AdminAnalyticsPage() {
  return (
    <>
      <AnalyticsActions />

      {/* 환영 헤더 */}
      <div style={{ marginBottom: 22 }}>
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-serif)',
            fontSize: 24,
            fontWeight: 500,
            letterSpacing: '-0.02em',
          }}
        >
          매출 통계
        </h2>
        <div style={{ marginTop: 4, fontSize: 13, color: 'var(--foreground-muted)' }}>
          기간별 매출, 카테고리별 판매량, 정기배송 추이를 한눈에 보세요.
        </div>
      </div>

      {/* placeholder 통계 카드 4종 (disabled) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 16,
        }}
      >
        {PLACEHOLDER_STATS.map((label) => (
          <div
            key={label}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
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
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: 0,
        }}
      >
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
              maskImage:
                'radial-gradient(ellipse at center, black 30%, transparent 70%)',
              WebkitMaskImage:
                'radial-gradient(ellipse at center, black 30%, transparent 70%)',
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
              fontFamily: 'var(--font-serif)',
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
            통계 리포트는 최소 <strong style={{ color: 'var(--foreground)' }}>주문 50건</strong> 또는{' '}
            <strong style={{ color: 'var(--foreground)' }}>운영 14일</strong>이 지나야 정확한 인사이트를 보여드려요.
            현재까지 <strong style={{ color: 'var(--foreground)' }}>주문 23건 · 운영 6일</strong>이 누적됐어요.
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
            {PROGRESS.map(({ label, cur, max, unit }) => (
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
                      width: `${(cur / max) * 100}%`,
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
            <a
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
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginRight: 4 }}
              >
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
              주문 생성하기
            </a>
            <button
              type="button"
              disabled
              style={{
                padding: '7px 14px',
                fontSize: 13,
                height: 34,
                borderRadius: 6,
                fontWeight: 500,
                background: 'var(--surface)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
                cursor: 'not-allowed',
                letterSpacing: '-0.005em',
                opacity: 0.7,
              }}
            >
              샘플 데이터로 미리보기
            </button>
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
              <strong style={{ color: 'var(--foreground)' }}>팁.</strong>{' '}
              메인 사이트에 <a style={{ color: 'var(--primary)' }}>오픈 공지</a>를 등록하면 첫 주문이 평균 3배 빨라져요.
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
