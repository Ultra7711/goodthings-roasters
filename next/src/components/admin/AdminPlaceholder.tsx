/* ══════════════════════════════════════════
   AdminPlaceholder — 미구현 그룹 페이지 빈 상태 (S126).
   - 시안 empty.jsx 시각 패턴 inline 100% 이식. shadcn 의존 제거.
   - 일러스트 + 헤딩 + 그룹 안내 (analytics 와 달리 진행률·CTA·팁 없음).
   ══════════════════════════════════════════ */

type Props = {
  title: string;
  description: string;
  group: string;
};

export default function AdminPlaceholder({ title, description, group }: Props) {
  return (
    <div>
      {/* 헤더 */}
      <div style={{ marginBottom: 22 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 500,
            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </h2>
        <div style={{ marginTop: 4, fontSize: 13, color: 'var(--foreground-muted)' }}>
          {description}
        </div>
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

          {/* 일러스트 */}
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
                width="14"
                height="14"
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
            구현 예정 — {title}
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
            이 페이지는 어드민 인프라(Group A) 구축 단계 placeholder 입니다.{' '}
            <strong style={{ color: 'var(--foreground)' }}>Group {group}</strong>{' '}
            그룹 작업 시 실제 기능과 데이터로 채워집니다.
          </p>
        </div>
      </div>
    </div>
  );
}
