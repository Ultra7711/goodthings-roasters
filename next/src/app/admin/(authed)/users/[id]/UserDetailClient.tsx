'use client';

/* ══════════════════════════════════════════════════════════════════════════
   UserDetailClient — /admin/users/[id] 인터랙티브 본체 (S169 PR-2 Group C-2)

   책임 (PR-2 read-only):
   - 헤더 (← 목록 + 사용자 이름 + 역할 badge)
   - 프로필 카드 (id · email · 이름 · phone · 가입일 · 마지막 업데이트)
   - 주문 카드 (최근 N개 테이블, 행 클릭 → /admin/orders/[orderNumber])
   - 역할 변경 이력 카드 (admin_audit)

   carry-over (PR-3):
   - "역할 변경" 버튼 + 다이얼로그
   - grantAdminAction / revokeAdminAction 호출
   ══════════════════════════════════════════════════════════════════════════ */

import Link from 'next/link';
import {
  describeRole,
  formatAuditTimestamp,
  formatJoinedDate,
  resolveUserName,
  type AdminAuditEntry,
  type ListedUserOrder,
  type RoleTone,
  type UserDetailProfile,
} from '@/lib/admin/users';
import {
  describeStatus,
  formatKstDateTime,
  type StatusTone,
} from '@/lib/admin/orders';

type Props = {
  profile: UserDetailProfile;
  orders: ListedUserOrder[];
  audit: AdminAuditEntry[];
  currentAdminId: string | null;
};

const ROLE_TONES: Record<RoleTone, { bg: string; fg: string; dot: string }> = {
  primary: { bg: 'var(--primary-soft)', fg: 'var(--primary-soft-fg)', dot: 'var(--primary)' },
  neutral: { bg: 'var(--neutral-soft)', fg: 'var(--neutral-soft-fg)', dot: '#888' },
};

const STATUS_TONES: Record<StatusTone, { bg: string; fg: string; dot: string }> = {
  neutral: { bg: 'var(--neutral-soft)', fg: 'var(--neutral-soft-fg)', dot: '#888' },
  success: { bg: 'var(--success-soft)', fg: 'var(--success)', dot: 'var(--success)' },
  warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)', dot: 'var(--warning)' },
  info:    { bg: 'var(--info-soft)',    fg: 'var(--info)',    dot: 'var(--info)' },
  primary: { bg: 'var(--primary-soft)', fg: 'var(--primary-soft-fg)', dot: 'var(--primary)' },
};

const TH_STYLE: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 14px',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--foreground-muted)',
};

const TD_STYLE: React.CSSProperties = {
  padding: '11px 14px',
  verticalAlign: 'middle',
};

const CARD_STYLE: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: 0,
  overflow: 'hidden',
};

const CARD_HEADER_STYLE: React.CSSProperties = {
  padding: '14px 18px',
  borderBottom: '1px solid var(--border)',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--foreground)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

export default function UserDetailClient({
  profile,
  orders,
  audit,
  currentAdminId: _currentAdminId,
}: Props) {
  const role = describeRole(profile.role);
  const name = resolveUserName(profile);

  return (
    <>
      {/* 헤더 */}
      <div style={{ marginBottom: 18 }}>
        <Link
          href="/admin/users"
          style={{
            fontSize: 12,
            color: 'var(--foreground-muted)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            marginBottom: 6,
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          고객 목록
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 500,
              letterSpacing: '-0.02em',
            }}
          >
            {name}
          </h2>
          <RoleBadge tone={role.tone}>{role.label}</RoleBadge>
        </div>
        <div style={{ marginTop: 4, fontSize: 13, color: 'var(--foreground-muted)' }}>
          {profile.email}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 카드 1: 프로필 */}
        <section style={CARD_STYLE}>
          <header style={CARD_HEADER_STYLE}>
            <span>프로필</span>
          </header>
          <dl
            style={{
              margin: 0,
              padding: '14px 18px',
              display: 'grid',
              gridTemplateColumns: '120px 1fr',
              rowGap: 10,
              columnGap: 16,
              fontSize: 13,
            }}
          >
            <DefRow label="ID">
              <span
                className="gtr-mono"
                style={{ fontSize: 12, color: 'var(--foreground-muted)' }}
              >
                {profile.id}
              </span>
            </DefRow>
            <DefRow label="이메일">{profile.email}</DefRow>
            <DefRow label="이름">{profile.fullName ?? <Dim>—</Dim>}</DefRow>
            <DefRow label="표시명">{profile.displayName ?? <Dim>—</Dim>}</DefRow>
            <DefRow label="전화">{profile.phone ?? <Dim>—</Dim>}</DefRow>
            <DefRow label="가입일">{formatJoinedDate(profile.createdAtIso)}</DefRow>
            <DefRow label="최종 업데이트">{formatAuditTimestamp(profile.updatedAtIso)}</DefRow>
          </dl>
        </section>

        {/* 카드 2: 주문 */}
        <section style={CARD_STYLE}>
          <header style={CARD_HEADER_STYLE}>
            <span>주문 내역</span>
            <span style={{ fontSize: 12, color: 'var(--foreground-muted)', fontWeight: 400 }}>
              최근 {orders.length}건
            </span>
          </header>
          {orders.length === 0 ? (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                fontSize: 13,
                color: 'var(--foreground-muted)',
              }}
            >
              주문 내역이 없습니다.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr
                  style={{
                    background: 'var(--surface-muted)',
                    color: 'var(--foreground-muted)',
                  }}
                >
                  <th style={TH_STYLE}>주문번호</th>
                  <th style={TH_STYLE}>주문일시</th>
                  <th style={TH_STYLE}>상태</th>
                  <th style={{ ...TH_STYLE, textAlign: 'right' }}>금액</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o, i) => {
                  const s = describeStatus(o.status);
                  return (
                    <tr
                      key={o.id}
                      style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}
                    >
                      <td style={TD_STYLE}>
                        <Link
                          href={`/admin/orders/${o.orderNumber}`}
                          className="gtr-mono"
                          style={{
                            fontSize: 12,
                            color: 'var(--primary)',
                            fontWeight: 500,
                            textDecoration: 'none',
                          }}
                        >
                          {o.orderNumber}
                        </Link>
                      </td>
                      <td
                        style={{
                          ...TD_STYLE,
                          color: 'var(--foreground-muted)',
                          fontSize: 12,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {formatKstDateTime(o.createdAtIso)}
                      </td>
                      <td style={TD_STYLE}>
                        <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                      </td>
                      <td
                        style={{
                          ...TD_STYLE,
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 500,
                        }}
                      >
                        {o.totalAmount.toLocaleString()}원
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {/* 카드 3: 역할 변경 이력 (admin_audit) */}
        <section style={CARD_STYLE}>
          <header style={CARD_HEADER_STYLE}>
            <span>역할 변경 이력</span>
            <span style={{ fontSize: 12, color: 'var(--foreground-muted)', fontWeight: 400 }}>
              {audit.length}건
            </span>
          </header>
          {audit.length === 0 ? (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                fontSize: 13,
                color: 'var(--foreground-muted)',
              }}
            >
              역할 변경 이력이 없습니다.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr
                  style={{
                    background: 'var(--surface-muted)',
                    color: 'var(--foreground-muted)',
                  }}
                >
                  <th style={TH_STYLE}>액션</th>
                  <th style={TH_STYLE}>실행자</th>
                  <th style={TH_STYLE}>사유</th>
                  <th style={TH_STYLE}>시각</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a, i) => (
                  <tr
                    key={a.id}
                    style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}
                  >
                    <td style={TD_STYLE}>
                      <ActionBadge action={a.action} />
                    </td>
                    <td style={{ ...TD_STYLE, color: 'var(--foreground-muted)' }}>
                      {a.actorEmail ?? <Dim>—</Dim>}
                    </td>
                    <td
                      style={{
                        ...TD_STYLE,
                        color: a.reason ? 'var(--foreground)' : 'var(--foreground-subtle)',
                        maxWidth: 360,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={a.reason ?? undefined}
                    >
                      {a.reason ?? '—'}
                    </td>
                    <td
                      style={{
                        ...TD_STYLE,
                        color: 'var(--foreground-muted)',
                        fontSize: 12,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatAuditTimestamp(a.createdAtIso)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}

/* ── 로컬 컴포넌트 ─────────────────────────────────────────────────── */

function DefRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt style={{ color: 'var(--foreground-muted)', fontSize: 12 }}>{label}</dt>
      <dd style={{ margin: 0, color: 'var(--foreground)' }}>{children}</dd>
    </>
  );
}

function Dim({ children }: { children: React.ReactNode }) {
  return <span style={{ color: 'var(--foreground-subtle)' }}>{children}</span>;
}

function RoleBadge({ tone, children }: { tone: RoleTone; children: React.ReactNode }) {
  const t = ROLE_TONES[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 10px',
        borderRadius: 999,
        background: t.bg,
        color: t.fg,
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: '-0.005em',
        lineHeight: 1.4,
      }}
    >
      <span aria-hidden style={{ width: 5, height: 5, borderRadius: 999, background: t.dot }} />
      {children}
    </span>
  );
}

function StatusBadge({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  const t = STATUS_TONES[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        borderRadius: 999,
        background: t.bg,
        color: t.fg,
        fontSize: 11.5,
        fontWeight: 500,
        letterSpacing: '-0.005em',
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden style={{ width: 5, height: 5, borderRadius: 999, background: t.dot }} />
      {children}
    </span>
  );
}

function ActionBadge({ action }: { action: 'grant_admin' | 'revoke_admin' }) {
  const isGrant = action === 'grant_admin';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        borderRadius: 999,
        background: isGrant ? 'var(--success-soft)' : 'var(--neutral-soft)',
        color: isGrant ? 'var(--success)' : 'var(--neutral-soft-fg)',
        fontSize: 11.5,
        fontWeight: 500,
        letterSpacing: '-0.005em',
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
      }}
    >
      {isGrant ? '운영자 승격' : '운영자 강등'}
    </span>
  );
}
