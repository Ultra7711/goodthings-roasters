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
  adjustPointsAction,
  forceDeleteAccountAction,
  grantAdminAction,
  revokeAdminAction,
  setAdminLevelAction,
  type ForceDeleteAccountResult,
  type UserRoleActionResult,
} from '../actions';
import type { PointLedgerEntry } from '@/types/point';
import { cn } from '@/lib/utils';
import { AdminBackLink } from '@/components/admin/AdminBackLink';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';

type Props = {
  profile: UserDetailProfile;
  orders: ListedUserOrder[];
  audit: AdminAuditEntry[];
  /** S328 ②: 포인트 잔액 + 최근 원장. */
  pointBalance: number;
  pointLedger: PointLedgerEntry[];
  /** S336: 활성/일시정지 정기배송 수 — 강제 탈퇴 다이얼로그 고지용. */
  activeSubscriptionCount: number;
  currentAdminId: string | null;
  /** S233-fu: owner (관리자) 만 권한 변경/단계 조정 가능. staff (운영자) 는 조회만. */
  isOwner: boolean;
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
  pointBalance,
  pointLedger,
  activeSubscriptionCount,
  currentAdminId,
  isOwner,
}: Props) {
  const role = describeRole(profile.role, profile.adminLevel);
  const name = resolveUserName(profile);
  const isSelf = currentAdminId !== null && currentAdminId === profile.id;
  const isAdminTarget = profile.role === 'admin';

  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isPending, startTransition] = useTransition();
  /* S233-fu: 권한 단계 변경 (owner ↔ staff) 다이얼로그 별도 상태 */
  const [levelDialogOpen, setLevelDialogOpen] = useState(false);
  const [levelReason, setLevelReason] = useState('');
  const [isLevelPending, startLevelTransition] = useTransition();
  /* S258 P4: 운영자 직권 탈퇴 다이얼로그 상태 */
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [emailConfirm, setEmailConfirm] = useState('');
  const [isDeletePending, startDeleteTransition] = useTransition();
  /* S328 ②: 포인트 수동 가감 다이얼로그 상태 */
  const [pointDialogOpen, setPointDialogOpen] = useState(false);
  const [pointAmount, setPointAmount] = useState('');
  const [pointReason, setPointReason] = useState('');
  const [pointNonce, setPointNonce] = useState('');
  const [isPointPending, startPointTransition] = useTransition();
  const router = useRouter();

  /* 변경 후 새 admin_level (현재가 owner면 → staff, staff면 → owner) */
  const targetLevel: 'owner' | 'staff' =
    profile.adminLevel === 'owner' ? 'staff' : 'owner';

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
        const map: Record<string, string> = {
          unauthorized: '관리자 권한이 필요합니다.',
          validation_failed: '입력값을 확인해 주세요.',
          self_action: '본인의 권한은 변경할 수 없습니다.',
          server_error: '권한 변경 중 오류가 발생했습니다.',
        };
        toast.error(map[result.error] ?? '권한 변경에 실패했습니다.');
        return;
      }
      toast.success(
        intent === 'grant'
          ? '운영자 권한을 부여했습니다.'
          : '운영자 권한을 해제했습니다.',
      );
      setDialogOpen(false);
      router.refresh();
    });
  }

  /* S233-fu: 권한 단계 변경 (owner ↔ staff) 제출 */
  function openLevelDialog() {
    setLevelReason('');
    setLevelDialogOpen(true);
  }

  function closeLevelDialog() {
    if (isLevelPending) return;
    setLevelDialogOpen(false);
  }

  function submitLevel() {
    const trimmed = levelReason.trim();
    const payload = {
      targetId: profile.id,
      newLevel: targetLevel,
      ...(trimmed.length > 0 ? { reason: trimmed } : {}),
    };
    startLevelTransition(async () => {
      const result = await setAdminLevelAction(payload);
      if (!result.ok) {
        const map: Record<string, string> = {
          unauthorized: '관리자 권한이 필요합니다.',
          validation_failed: '입력값이 잘못되었습니다.',
          last_owner: '마지막 관리자는 운영자로 강등할 수 없습니다.',
          not_admin: '대상이 어드민이 아닙니다.',
          not_found: '사용자를 찾을 수 없습니다.',
          server_error: '변경 중 오류가 발생했습니다.',
        };
        toast.error(map[result.error] ?? '오류가 발생했습니다.');
        return;
      }
      toast.success(
        targetLevel === 'owner'
          ? '관리자로 승격했습니다.'
          : '운영자로 변경했습니다.',
      );
      setLevelDialogOpen(false);
      router.refresh();
    });
  }

  /* S258 P4: 운영자 직권 탈퇴 — 사유 필수 + 이메일 재확인 + RPC + audit + auth.delete */
  function openDeleteDialog() {
    setDeleteReason('');
    setEmailConfirm('');
    setDeleteDialogOpen(true);
  }

  function closeDeleteDialog() {
    if (isDeletePending) return;
    setDeleteDialogOpen(false);
  }

  const deleteReasonTrim = deleteReason.trim();
  const emailConfirmTrim = emailConfirm.trim();
  const canSubmitDelete =
    deleteReasonTrim.length > 0 &&
    emailConfirmTrim === profile.email &&
    !isDeletePending;

  function submitDelete() {
    if (!canSubmitDelete) return;
    startDeleteTransition(async () => {
      const result: ForceDeleteAccountResult = await forceDeleteAccountAction({
        targetId: profile.id,
        reason: deleteReasonTrim,
      });
      if (!result.ok) {
        const map: Record<string, string> = {
          unauthorized: '관리자 권한이 필요합니다.',
          validation_failed: '입력값을 확인해 주세요.',
          self_action: '본인 계정은 어드민에서 탈퇴 처리할 수 없습니다.',
          not_found: '대상 회원을 찾을 수 없습니다.',
          target_is_admin: '어드민 계정은 강제 탈퇴할 수 없습니다. 먼저 권한을 해제하세요.',
          server_error: '탈퇴 처리 중 오류가 발생했습니다.',
        };
        toast.error(map[result.error] ?? '탈퇴 처리에 실패했습니다.');
        return;
      }
      toast.success(
        `회원을 탈퇴 처리했습니다 (주문 ${result.ordersAnonymized}건 익명화, 구독 ${result.subscriptionsDeleted}건 삭제)`,
      );
      setDeleteDialogOpen(false);
      router.push('/admin/users');
    });
  }

  /* S328 ②: 포인트 수동 가감 — owner 전용. 양수=지급, 음수=차감. */
  const parsedPointAmount = (() => {
    const cleaned = pointAmount.trim().replace(/[^0-9-]/g, '');
    const n = Number.parseInt(cleaned, 10);
    return Number.isFinite(n) ? n : 0;
  })();
  const pointReasonTrim = pointReason.trim();
  const canSubmitPoint =
    parsedPointAmount !== 0 &&
    Math.abs(parsedPointAmount) <= 10_000_000 &&
    pointReasonTrim.length > 0 &&
    !isPointPending;
  const pointBalanceAfter = pointBalance + parsedPointAmount;

  function openPointDialog() {
    setPointAmount('');
    setPointReason('');
    setPointNonce(crypto.randomUUID());
    setPointDialogOpen(true);
  }

  function closePointDialog() {
    if (isPointPending) return;
    setPointDialogOpen(false);
  }

  function submitPoint() {
    if (!canSubmitPoint) return;
    startPointTransition(async () => {
      const result = await adjustPointsAction({
        targetId: profile.id,
        amount: parsedPointAmount,
        reason: pointReasonTrim,
        idempotencyKey: pointNonce,
      });
      if (!result.ok) {
        const map: Record<string, string> = {
          unauthorized: '관리자 권한이 필요합니다.',
          validation_failed: '입력값을 확인해 주세요.',
          user_not_found: '대상 회원을 찾을 수 없습니다.',
          invalid_amount: '가감액이 올바르지 않습니다 (0 불가).',
          insufficient_balance: '잔액이 부족하여 차감할 수 없습니다.',
          server_error: '처리 중 오류가 발생했습니다.',
        };
        toast.error(map[result.error] ?? '포인트 가감에 실패했습니다.');
        return;
      }
      toast.success(
        result.applied
          ? `포인트를 ${parsedPointAmount > 0 ? '지급' : '차감'}했습니다 (잔액 ${result.balance.toLocaleString()}P)`
          : '이미 처리된 요청입니다.',
      );
      setPointDialogOpen(false);
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

        {/* 카드 1.2: 적립금 (S328 ②) */}
        <section className={CARD_CLASS}>
          <header className={CARD_HEADER_CLASS}>
            <span>적립금</span>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {pointBalance.toLocaleString()}P
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="!h-7"
                onClick={openPointDialog}
                disabled={!isOwner || isPointPending}
                title={!isOwner ? '관리자 권한 필요' : undefined}
              >
                수동 가감
              </Button>
            </div>
          </header>
          {pointLedger.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              포인트 내역이 없습니다.
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-muted)', color: 'var(--foreground-muted)' }}>
                  <th style={TH_STYLE}>구분</th>
                  <th style={{ ...TH_STYLE, textAlign: 'right' }}>변동</th>
                  <th style={TH_STYLE}>사유</th>
                  <th style={TH_STYLE}>시각</th>
                </tr>
              </thead>
              <tbody>
                {pointLedger.map((e, i) => (
                  <tr key={e.id} className={cn(i !== 0 && 'border-t border-border')}>
                    <td style={TD_STYLE}>
                      <PointEventBadge eventType={e.eventType} />
                    </td>
                    <td
                      style={{ ...TD_STYLE, textAlign: 'right' }}
                      className={cn(
                        'text-sm font-medium tabular-nums',
                        e.amount > 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]',
                      )}
                    >
                      {e.amount > 0 ? '+' : ''}
                      {e.amount.toLocaleString()}P
                    </td>
                    <td
                      style={{ ...TD_STYLE, maxWidth: 320 }}
                      className={cn(
                        'text-sm overflow-hidden text-ellipsis whitespace-nowrap',
                        e.description ? 'text-foreground' : 'text-[var(--foreground-subtle)]',
                      )}
                      title={e.description ?? undefined}
                    >
                      {e.description ?? '—'}
                    </td>
                    <td style={TD_STYLE} className="text-xs text-muted-foreground tabular-nums">
                      {formatKstDateTime(e.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* 카드 1.5: 권한 설정 (S233-fu · admin 인 경우만) */}
        {isAdminTarget && (
          <section className={CARD_CLASS}>
            <header className={CARD_HEADER_CLASS}>
              <span>권한 설정</span>
              <span className="text-xs text-muted-foreground font-normal">
                현재 단계 · {profile.adminLevel === 'owner' ? '관리자' : '운영자'}
              </span>
            </header>
            <div className="px-4 py-3 text-sm">
              <div className="text-muted-foreground leading-relaxed mb-3">
                {profile.adminLevel === 'owner' ? (
                  <>
                    관리자는 CSV 내보내기 · 상품 영구 삭제 · 사이트 설정 변경 · 다른 어드민의 권한 변경이 가능합니다.
                    운영자로 변경하면 일상 운영 (주문 처리 · 구독 편집 · 상품 수정) 만 가능합니다.
                  </>
                ) : (
                  <>
                    운영자는 일상 운영만 가능합니다 (CSV 내보내기 · 영구 삭제 · 설정 변경 불가).
                    관리자로 승격하면 모든 민감 액션을 수행할 수 있습니다.
                  </>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="!h-8"
                onClick={openLevelDialog}
                disabled={!isOwner || isLevelPending || (isSelf && profile.adminLevel === 'owner')}
                title={
                  !isOwner
                    ? '관리자 권한 필요'
                    : isSelf && profile.adminLevel === 'owner'
                      ? '본인은 운영자로 강등할 수 없습니다 (다른 관리자에게 요청)'
                      : undefined
                }
              >
                {profile.adminLevel === 'owner' ? '운영자로 변경' : '관리자로 승격'}
              </Button>
            </div>
          </section>
        )}

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

        {/* 권한 단계 변경 다이얼로그 (S233-fu) */}
        <Dialog open={levelDialogOpen} onOpenChange={(o) => (o ? setLevelDialogOpen(true) : closeLevelDialog())}>
          <DialogContent className="max-w-[480px] p-0 gap-0">
            <DialogHeader className="px-6 pt-5 pb-0">
              <DialogTitle className="text-base font-medium">
                {targetLevel === 'owner' ? '관리자로 승격' : '운영자로 변경'}
              </DialogTitle>
              <DialogDescription className="text-xs mt-1">
                {targetLevel === 'owner'
                  ? `${profile.email} 을(를) 관리자로 승격합니다. CSV 내보내기 · 영구 삭제 · 사이트 설정 등 민감 액션이 가능해집니다.`
                  : `${profile.email} 을(를) 운영자로 변경합니다. 민감 액션 권한이 해제되며 일상 운영만 가능해집니다.`}
                {' '}사유는 변경 이력에 기록됩니다.
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 py-5 flex flex-col gap-1.5">
              <label
                htmlFor="level-change-reason"
                className="text-xs text-muted-foreground"
              >
                사유 <span className="text-[var(--foreground-subtle)]">(선택, 최대 500자)</span>
              </label>
              <Textarea
                id="level-change-reason"
                value={levelReason}
                onChange={(e) => setLevelReason(e.target.value.slice(0, 500))}
                disabled={isLevelPending}
                placeholder={targetLevel === 'owner' ? '예: 운영 책임자 변경' : '예: 권한 범위 조정'}
                rows={4}
              />
              <div className="text-xs text-[var(--foreground-subtle)] text-right">
                {levelReason.length} / 500
              </div>
            </div>

            <DialogFooter className="px-6 pb-5 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="!h-7"
                onClick={closeLevelDialog}
                disabled={isLevelPending}
              >
                취소
              </Button>
              <Button
                type="button"
                variant={targetLevel === 'owner' ? 'default' : 'destructive'}
                size="sm"
                className="!h-7"
                onClick={submitLevel}
                disabled={isLevelPending}
              >
                {isLevelPending
                  ? '처리 중…'
                  : targetLevel === 'owner'
                    ? '관리자로 승격'
                    : '운영자로 변경'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 포인트 수동 가감 다이얼로그 (S328 ②) */}
        <Dialog
          open={pointDialogOpen}
          onOpenChange={(o) => (o ? setPointDialogOpen(true) : closePointDialog())}
        >
          <DialogContent className="max-w-[480px] p-0 gap-0">
            <DialogHeader className="px-6 pt-5 pb-0">
              <DialogTitle className="text-base font-medium">포인트 수동 가감</DialogTitle>
              <DialogDescription className="text-xs mt-1">
                <strong>{profile.email}</strong> 의 적립금을 지급(양수)하거나 차감(음수)합니다.
                사유는 적립금 내역과 감사 로그에 기록됩니다. 현재 잔액{' '}
                <span className="tabular-nums">{pointBalance.toLocaleString()}P</span>.
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="point-amount" className="text-xs text-muted-foreground">
                  가감액 <span className="text-[var(--danger)]">(필수, 0 불가)</span>
                </label>
                <input
                  id="point-amount"
                  inputMode="numeric"
                  value={pointAmount}
                  onChange={(e) => setPointAmount(e.target.value)}
                  disabled={isPointPending}
                  placeholder="예: 5000 (지급) · -3000 (차감)"
                  className="h-9 px-3 text-sm border rounded-md bg-background border-border focus:outline-none focus:ring-2 focus:ring-[var(--ring)] tabular-nums"
                  autoComplete="off"
                />
                {parsedPointAmount !== 0 && (
                  <div className="text-xs text-[var(--foreground-subtle)] tabular-nums">
                    변경 후 잔액 {pointBalanceAfter.toLocaleString()}P
                    {pointBalanceAfter < 0 && (
                      <span className="text-[var(--danger)]"> · 잔액 부족 (차감 불가)</span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="point-reason" className="text-xs text-muted-foreground">
                  사유 <span className="text-[var(--danger)]">(필수, 최대 500자)</span>
                </label>
                <Textarea
                  id="point-reason"
                  value={pointReason}
                  onChange={(e) => setPointReason(e.target.value.slice(0, 500))}
                  disabled={isPointPending}
                  placeholder="예: CS 보상 — 배송 지연 사과"
                  rows={3}
                />
                <div className="text-xs text-[var(--foreground-subtle)] text-right">
                  {pointReason.length} / 500
                </div>
              </div>
            </div>

            <DialogFooter className="px-6 pb-5 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="!h-7"
                onClick={closePointDialog}
                disabled={isPointPending}
              >
                취소
              </Button>
              <Button
                type="button"
                size="sm"
                className="!h-7"
                onClick={submitPoint}
                disabled={!canSubmitPoint || pointBalanceAfter < 0}
              >
                {isPointPending ? '처리 중…' : parsedPointAmount < 0 ? '차감' : '지급'}
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

        {/* 카드 4: 위험 영역 (S258 P4 · 운영자 직권 탈퇴) — non-admin target 만 + owner only */}
        {!isAdminTarget && !isSelf && (
          <section
            className="bg-card border rounded-[var(--radius)] overflow-hidden"
            style={{ borderColor: 'var(--danger)' }}
          >
            <header
              className="px-6 py-4 border-b text-sm font-medium"
              style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
            >
              위험 영역
            </header>
            <div className="px-6 py-5 text-sm">
              <div className="text-muted-foreground leading-relaxed mb-3">
                <strong className="text-foreground">운영자 직권 탈퇴</strong> — 약관 위반·부정 이용 등이 확인된 경우에만 사용합니다.
                회원 정보는 즉시 파기되며, 주문 거래 기록은 익명화 후 5년간 보존됩니다.
                활성 정기배송이 있으면 탈퇴 시 함께 해지·취소됩니다.
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="!h-8"
                onClick={openDeleteDialog}
                disabled={!isOwner || isDeletePending}
                title={!isOwner ? '관리자(owner) 권한 필요' : undefined}
              >
                회원 탈퇴 처리
              </Button>
            </div>
          </section>
        )}

        {/* S258 P4: 운영자 직권 탈퇴 다이얼로그 */}
        <Dialog
          open={deleteDialogOpen}
          onOpenChange={(o) => (o ? setDeleteDialogOpen(true) : closeDeleteDialog())}
        >
          <DialogContent className="max-w-[480px] p-0 gap-0">
            <DialogHeader className="px-6 pt-5 pb-0">
              <DialogTitle className="text-base font-medium" style={{ color: 'var(--danger)' }}>
                회원 탈퇴 처리
              </DialogTitle>
              <DialogDescription className="text-xs mt-1">
                <strong>{profile.email}</strong> 회원을 영구 탈퇴 처리합니다. 회원 정보는 즉시 파기되며,
                주문 거래 기록은 익명화 후 5년간 보존됩니다. 이 작업은 되돌릴 수 없습니다.
                <br />
                <span className="text-[var(--foreground-subtle)]">
                  사유는 감사 로그에 기록되며 5년간 보존됩니다 (PIPA §29 · §39-7).
                </span>
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 py-5 flex flex-col gap-4">
              {/* S336: 활성/일시정지 정기배송 고지 — owner 실수 방지(차단 아님, 정보 표시). */}
              {activeSubscriptionCount > 0 && (
                <div
                  className="rounded-md border px-3.5 py-3 text-xs leading-relaxed"
                  style={{
                    borderColor: 'var(--warning)',
                    background: 'var(--warning-soft)',
                    color: 'var(--warning)',
                  }}
                >
                  이 회원은 진행 중인 정기배송{' '}
                  <strong>{activeSubscriptionCount}건</strong>이 있습니다. 탈퇴 시 모두
                  취소(삭제)되며 복구되지 않습니다.
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="force-delete-reason" className="text-xs text-muted-foreground">
                  사유 <span className="text-[var(--danger)]">(필수, 최대 500자)</span>
                </label>
                <Textarea
                  id="force-delete-reason"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value.slice(0, 500))}
                  disabled={isDeletePending}
                  placeholder="예: 약관 위반 (반복적 어뷰징 신고)"
                  rows={3}
                />
                <div className="text-xs text-[var(--foreground-subtle)] text-right">
                  {deleteReason.length} / 500
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="force-delete-email" className="text-xs text-muted-foreground">
                  이메일 재확인 <span className="text-[var(--danger)]">(필수)</span>
                </label>
                <input
                  id="force-delete-email"
                  type="email"
                  value={emailConfirm}
                  onChange={(e) => setEmailConfirm(e.target.value)}
                  disabled={isDeletePending}
                  placeholder={profile.email}
                  className="h-9 px-3 text-sm border rounded-md bg-background border-border focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  autoComplete="off"
                />
                <div className="text-xs text-[var(--foreground-subtle)]">
                  탈퇴 대상 이메일을 정확히 입력해야 처리됩니다.
                </div>
              </div>
            </div>

            <DialogFooter className="px-6 pb-5 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="!h-7"
                onClick={closeDeleteDialog}
                disabled={isDeletePending}
              >
                취소
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="!h-7"
                onClick={submitDelete}
                disabled={!canSubmitDelete}
              >
                {isDeletePending ? '처리 중…' : '탈퇴 처리'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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

function ActionBadge({
  action,
}: {
  action:
    | 'grant_admin'
    | 'revoke_admin'
    | 'set_admin_level'
    | 'self_delete_account'
    | 'force_delete_account';
}) {
  /* S232: set_admin_level (owner ↔ staff). S258 P2: 탈퇴 2종. */
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
  if (action === 'self_delete_account') {
    return (
      <ShadcnBadge
        variant="outline"
        className="border-transparent"
        style={{ background: 'var(--neutral-soft)', color: 'var(--neutral-soft-fg)' }}
      >
        회원 자기 탈퇴
      </ShadcnBadge>
    );
  }
  if (action === 'force_delete_account') {
    return (
      <ShadcnBadge
        variant="outline"
        className="border-transparent"
        style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}
      >
        운영자 직권 탈퇴
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

/* S328 ②: 포인트 원장 구분 배지 */
const POINT_EVENT_META: Record<
  PointLedgerEntry['eventType'],
  { label: string; bg: string; fg: string }
> = {
  earned:   { label: '적립',   bg: 'var(--success-soft)', fg: 'var(--success)' },
  used:     { label: '사용',   bg: 'var(--neutral-soft)', fg: 'var(--neutral-soft-fg)' },
  expired:  { label: '소멸',   bg: 'var(--neutral-soft)', fg: 'var(--foreground-muted)' },
  adjusted: { label: '수동조정', bg: 'var(--warning-soft)', fg: 'var(--warning)' },
  reversed: { label: '복원',   bg: 'var(--info-soft)',    fg: 'var(--info)' },
};

function PointEventBadge({ eventType }: { eventType: PointLedgerEntry['eventType'] }) {
  const m = POINT_EVENT_META[eventType];
  return (
    <ShadcnBadge
      variant="outline"
      className="border-transparent"
      style={{ background: m.bg, color: m.fg }}
    >
      {m.label}
    </ShadcnBadge>
  );
}
