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
import { cn } from '@/lib/utils';
import { AdminBackLink } from '@/components/admin/AdminBackLink';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';

type Props = {
  profile: UserDetailProfile;
  orders: ListedUserOrder[];
  audit: AdminAuditEntry[];
  currentAdminId: string | null;
};

const ROLE_TONES: Record<RoleTone, { bg: string; fg: string; dot: string }> = {
  primary: { bg: 'var(--primary-soft)', fg: 'var(--primary-soft-fg)', dot: 'var(--primary)' },
  neutral: { bg: 'var(--neutral-soft)', fg: 'var(--neutral-soft-fg)', dot: 'var(--foreground-muted)' },
};

const STATUS_TONES: Record<StatusTone, { bg: string; fg: string; dot: string }> = {
  neutral: { bg: 'var(--neutral-soft)', fg: 'var(--neutral-soft-fg)', dot: 'var(--foreground-muted)' },
  success: { bg: 'var(--success-soft)', fg: 'var(--success)', dot: 'var(--success)' },
  warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)', dot: 'var(--warning)' },
  info:    { bg: 'var(--info-soft)',    fg: 'var(--info)',    dot: 'var(--info)' },
  primary: { bg: 'var(--primary-soft)', fg: 'var(--primary-soft-fg)', dot: 'var(--primary)' },
};

/* TH/TD inline — design.md §5-3 표준 (shadcn Table 마이그 carry-over) */
const TH_STYLE: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--foreground-muted)',
};

const TD_STYLE: React.CSSProperties = {
  padding: '12px 16px',
  verticalAlign: 'middle',
};

const CARD_CLASS =
  'bg-[var(--surface)] border border-border rounded-[var(--radius)] overflow-hidden';

const CARD_HEADER_CLASS =
  'px-6 py-4 border-b border-border flex items-center justify-between text-sm font-medium text-foreground';

export default function UserDetailClient({
  profile,
  orders,
  audit,
  currentAdminId,
}: Props) {
  const role = describeRole(profile.role, profile.adminLevel);
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
        toast.error(`권한 변경에 실패했습니다 (${result.detail ?? result.error})`);
        return;
      }
      toast.success(
        intent === 'grant'
          ? '운영자 권한을 부여했습니다.'
          : '어드민 권한을 해제했습니다.',
      );
      setDialogOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <AdminTopbarActions>
        <Button
          type="button"
          variant={intent === 'grant' ? 'default' : 'outline'}
          size="sm"
          className="!h-7"
          onClick={openDialog}
          disabled={isSelf}
          title={isSelf ? '본인 계정은 SQL 로 직접 변경하세요' : undefined}
        >
          {intent === 'grant' ? '운영자 권한 부여' : '어드민 권한 해제'}
        </Button>
      </AdminTopbarActions>

      {/* 헤더 */}
      <div className="mb-5">
        <AdminBackLink href="/admin/users" label="고객 목록" />
        <div className="flex items-center gap-2.5">
          <h2 className="m-0 text-2xl font-medium tracking-tight">{name}</h2>
          <RoleBadge tone={role.tone}>{role.label}</RoleBadge>
        </div>
        <div className="mt-1 text-sm text-muted-foreground">{profile.email}</div>
      </div>

      <div className="flex flex-col gap-4">
        {/* 카드 1: 프로필 */}
        <section className={CARD_CLASS}>
          <header className={CARD_HEADER_CLASS}>
            <span>프로필</span>
          </header>
          <dl
            className="m-0 px-4 py-3 grid gap-y-2.5 gap-x-4 text-sm"
            style={{ gridTemplateColumns: '120px 1fr' }}
          >
            <DefRow label="ID">
              <span className="gtr-mono text-xs text-muted-foreground">
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
        <section className={CARD_CLASS}>
          <header className={CARD_HEADER_CLASS}>
            <span>주문 내역</span>
            <span className="text-xs text-muted-foreground font-normal">
              최근 {orders.length}건
            </span>
          </header>
          {orders.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              주문 내역이 없습니다.
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-muted)', color: 'var(--foreground-muted)' }}>
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
                      className={cn(i !== 0 && 'border-t border-border')}
                    >
                      <td style={TD_STYLE}>
                        <Link
                          href={`/admin/orders/${o.orderNumber}`}
                          className="gtr-mono text-xs text-[var(--primary)] font-medium no-underline"
                        >
                          {o.orderNumber}
                        </Link>
                      </td>
                      <td
                        style={TD_STYLE}
                        className="text-xs text-muted-foreground tabular-nums"
                      >
                        {formatKstDateTime(o.createdAtIso)}
                      </td>
                      <td style={TD_STYLE}>
                        <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                      </td>
                      <td
                        style={{ ...TD_STYLE, textAlign: 'right' }}
                        className="text-sm font-medium tabular-nums"
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
          <DialogContent className="max-w-[480px] p-0 gap-0">
            <DialogHeader className="px-6 pt-5 pb-0">
              <DialogTitle className="text-base font-medium">
                {intent === 'grant' ? '운영자 권한 부여' : '어드민 권한 해제'}
              </DialogTitle>
              <DialogDescription className="text-xs mt-1">
                {intent === 'grant'
                  ? `${profile.email} 을(를) 운영자(staff)로 추가합니다. 관리자(owner) 승격은 별도 SQL 절차가 필요합니다. 사유는 변경 이력에 기록됩니다.`
                  : `${profile.email} 의 어드민 권한을 해제합니다. 사유는 변경 이력에 기록됩니다.`}
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 py-5 flex flex-col gap-1.5">
              <label
                htmlFor="role-change-reason"
                className="text-xs text-muted-foreground"
              >
                사유 <span className="text-[var(--foreground-subtle)]">(선택, 최대 500자)</span>
              </label>
              <Textarea
                id="role-change-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 500))}
                disabled={isPending}
                placeholder={intent === 'grant' ? '예: 신규 운영자 합류' : '예: 권한 해제 요청'}
                rows={4}
              />
              <div className="text-xs text-[var(--foreground-subtle)] text-right">
                {reason.length} / 500
              </div>
            </div>

            <DialogFooter className="px-6 pb-5 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="!h-7"
                onClick={closeDialog}
                disabled={isPending}
              >
                취소
              </Button>
              <Button
                type="button"
                variant={intent === 'grant' ? 'default' : 'destructive'}
                size="sm"
                className="!h-7"
                onClick={submit}
                disabled={isPending}
              >
                {isPending ? '처리 중…' : intent === 'grant' ? '운영자로 추가' : '어드민 해제'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 카드 3: 역할 변경 이력 (admin_audit) */}
        <section className={CARD_CLASS}>
          <header className={CARD_HEADER_CLASS}>
            <span>역할 변경 이력</span>
            <span className="text-xs text-muted-foreground font-normal">
              {audit.length}건
            </span>
          </header>
          {audit.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              역할 변경 이력이 없습니다.
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-muted)', color: 'var(--foreground-muted)' }}>
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
                    className={cn(i !== 0 && 'border-t border-border')}
                  >
                    <td style={TD_STYLE}>
                      <ActionBadge action={a.action} />
                    </td>
                    <td style={TD_STYLE} className="text-sm text-muted-foreground">
                      {a.actorEmail ?? <Dim>—</Dim>}
                    </td>
                    <td
                      style={{ ...TD_STYLE, maxWidth: 360 }}
                      className={cn(
                        'text-sm overflow-hidden text-ellipsis whitespace-nowrap',
                        a.reason ? 'text-foreground' : 'text-[var(--foreground-subtle)]',
                      )}
                      title={a.reason ?? undefined}
                    >
                      {a.reason ?? '—'}
                    </td>
                    <td
                      style={TD_STYLE}
                      className="text-xs text-muted-foreground tabular-nums"
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
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="m-0 text-foreground">{children}</dd>
    </>
  );
}

function Dim({ children }: { children: React.ReactNode }) {
  return <span className="text-[var(--foreground-subtle)]">{children}</span>;
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

function ActionBadge({ action }: { action: 'grant_admin' | 'revoke_admin' | 'set_admin_level' }) {
  /* S232: set_admin_level 액션도 표시 (owner ↔ staff 변경 이력). */
  if (action === 'set_admin_level') {
    return (
      <ShadcnBadge
        variant="outline"
        className="border-transparent"
        style={{ background: 'var(--info-soft)', color: 'var(--info)' }}
      >
        권한 단계 변경
      </ShadcnBadge>
    );
  }
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
      {isGrant ? '운영자 권한 부여' : '어드민 권한 해제'}
    </ShadcnBadge>
  );
}
