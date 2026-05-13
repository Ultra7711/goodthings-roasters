'use client';

/* ══════════════════════════════════════════════════════════════════════════
   UserDetailClient — /admin/users/[id] 인터랙티브 본체 (S169 PR-2 → PR-3)

   PR-2 read-only:
   - 헤더 (← 목록 + 사용자 이름 + 역할 badge)
   - 프로필 카드 (id · email · 이름 · phone · 가입일 · 마지막 업데이트)
   - 주문 카드 (최근 N개 테이블, 행 클릭 → /admin/orders/[orderNumber])
   - 역할 변경 이력 카드 (admin_audit)

   PR-3 추가:
   - 헤더 우측 "역할 변경" 버튼 (self → disabled)
   - Dialog (사유 입력 textarea optional · max 500자 · 확인/취소)
   - grantAdminAction / revokeAdminAction 호출 + toast + router.refresh
   ══════════════════════════════════════════════════════════════════════════ */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/admin/ui/button';
import { Badge as ShadcnBadge } from '@/components/admin/ui/badge';
import { Textarea } from '@/components/admin/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/admin/ui/dialog';
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
import {
  grantAdminAction,
  revokeAdminAction,
  type UserRoleActionResult,
} from '../actions';

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

/* S222 PR-5: ADMIN_BTN_* + ADMIN_TEXTAREA_STYLE 폐기 (shadcn Button + Textarea 으로 대체). */

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
  currentAdminId,
}: Props) {
  const role = describeRole(profile.role);
  const name = resolveUserName(profile);
  const isSelf = currentAdminId !== null && currentAdminId === profile.id;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const intent: 'grant' | 'revoke' = profile.role === 'admin' ? 'revoke' : 'grant';

  function openDialog() {
    setReason('');
    setDialogOpen(true);
  }

  function closeDialog() {
    if (isPending) return;
    setDialogOpen(false);
  }

  function submit() {
    const trimmed = reason.trim();
    const payload = {
      targetId: profile.id,
      ...(trimmed.length > 0 ? { reason: trimmed } : {}),
    };
    startTransition(async () => {
      const result: UserRoleActionResult =
        intent === 'grant'
          ? await grantAdminAction(payload)
          : await revokeAdminAction(payload);
      if (!result.ok) {
        toast.error(`역할 변경 실패 (${result.detail ?? result.error})`);
        return;
      }
      toast.success(intent === 'grant' ? '운영자 승격 완료' : '운영자 해제 완료');
      setDialogOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      {/* 헤더 */}
      <div
        style={{
          marginBottom: 18,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
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

        {/* 역할 변경 버튼 — self 면 disabled + tooltip */}
        <Button
          type="button"
          variant={intent === 'grant' ? 'default' : 'outline'}
          size="sm"
          onClick={openDialog}
          disabled={isSelf}
          title={isSelf ? '본인 계정은 SQL 로 직접 변경하세요' : undefined}
        >
          {intent === 'grant' ? '운영자로 승격' : '운영자 해제'}
        </Button>
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

        {/* 역할 변경 다이얼로그 */}
        <Dialog open={dialogOpen} onOpenChange={(o) => (o ? setDialogOpen(true) : closeDialog())}>
          <DialogContent style={{ padding: 24, maxWidth: 480 }}>
            <DialogHeader>
              <DialogTitle>
                {intent === 'grant' ? '운영자 승격' : '운영자 해제'}
              </DialogTitle>
              <DialogDescription>
                {intent === 'grant'
                  ? `${profile.email} 을(를) 운영자로 승격합니다. 사유는 admin_audit 에 기록됩니다.`
                  : `${profile.email} 의 운영자 권한을 해제합니다. 사유는 admin_audit 에 기록됩니다.`}
              </DialogDescription>
            </DialogHeader>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label
                htmlFor="role-change-reason"
                style={{ fontSize: 12, color: 'var(--foreground-muted)' }}
              >
                사유 <span style={{ color: 'var(--foreground-subtle)' }}>(선택, 최대 500자)</span>
              </label>
              <Textarea
                id="role-change-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 500))}
                disabled={isPending}
                placeholder={intent === 'grant' ? '예: 신규 운영자 합류' : '예: 권한 해제 요청'}
                rows={4}
              />
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--foreground-subtle)',
                  textAlign: 'right',
                }}
              >
                {reason.length} / 500
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={isPending}
              >
                취소
              </Button>
              <Button
                type="button"
                variant={intent === 'grant' ? 'default' : 'destructive'}
                onClick={submit}
                disabled={isPending}
              >
                {isPending ? '처리 중…' : intent === 'grant' ? '운영자로 승격' : '운영자 해제'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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

/* S222 PR-5: 3 Badge 변종 모두 shadcn Badge variant=outline + tone soft style override (DEC-2). */
function RoleBadge({ tone, children }: { tone: RoleTone; children: React.ReactNode }) {
  const t = ROLE_TONES[tone];
  return (
    <ShadcnBadge
      variant="outline"
      className="border-transparent gap-1.5"
      style={{ background: t.bg, color: t.fg }}
    >
      <span aria-hidden style={{ width: 5, height: 5, borderRadius: 999, background: t.dot }} />
      {children}
    </ShadcnBadge>
  );
}

function StatusBadge({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  const t = STATUS_TONES[tone];
  return (
    <ShadcnBadge
      variant="outline"
      className="border-transparent gap-1.5"
      style={{ background: t.bg, color: t.fg }}
    >
      <span aria-hidden style={{ width: 5, height: 5, borderRadius: 999, background: t.dot }} />
      {children}
    </ShadcnBadge>
  );
}

function ActionBadge({ action }: { action: 'grant_admin' | 'revoke_admin' }) {
  const isGrant = action === 'grant_admin';
  return (
    <ShadcnBadge
      variant="outline"
      className="border-transparent"
      style={{
        background: isGrant ? 'var(--success-soft)' : 'var(--neutral-soft)',
        color: isGrant ? 'var(--success)' : 'var(--neutral-soft-fg)',
      }}
    >
      {isGrant ? '운영자 승격' : '운영자 해제'}
    </ShadcnBadge>
  );
}
