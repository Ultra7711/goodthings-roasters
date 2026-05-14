'use client';

/* ══════════════════════════════════════════════════════════════════════════
   SubscriptionsTableClient — /admin/subscriptions 인터랙티브 본체 (S189 Group D)

   S228 PR-A — Orders 답습 패턴 적용 (5 inline 답습 폐기):
   - 페이지 헤더    → AdminPageHeader (subtitle = "총 N건의 구독 · M건 진행중")
   - STATUS_TABS    → AdminTabsNav (mode='url')
   - TH/TD inline   → AdminDataTable (Column<ListedSubscription> + footer)
   - colSpan 빈     → AdminEmptyState (variant='table-row')
   - PageNav grid   → AdminPagination (mode='url' · 26×26 정합)

   행 클릭 미적용 (Orders/Users 와 정책 차이) — Subscriptions 는 별 상세
   페이지 없는 inline 다이얼로그 구조. 명시적 "편집" 버튼 클릭만 다이얼로그
   진입. ended (cancelled/expired) 행은 편집 버튼 disabled 로 시각 명확화.

   편집 버튼 = Pencil 아이콘화 (size='icon-xs' · 24×24 admin 아이콘 표준).
   describeRange 패턴 답습: `총 N건 · M~K번째` (단위 건).

   carry-over (별 commit):
   - EditSubscriptionDialog 토큰화 (배송주기 칩 · 폰트 크기 inline → className)

   참조:
   - lib/admin/subscriptions.ts            (헬퍼)
   - actions.ts                             (Server Actions)
   ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { extractKrName } from '@/lib/products';
import { AdminSearchInput } from '@/components/admin/AdminSearchInput';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminTabsNav } from '@/components/admin/AdminTabsNav';
import { AdminDataTable, type Column } from '@/components/admin/AdminDataTable';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { Button } from '@/components/admin/ui/button';
import { Input } from '@/components/admin/ui/input';
import { Badge as ShadcnBadge } from '@/components/admin/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/admin/ui/dialog';
import {
  PAGE_SIZE,
  STATUS_TABS,
  describeStatus,
  describeCycle,
  formatDeliveryDate,
  isoToDateInput,
  resolveUserName,
  type AdminSubscriptionsSearchParams,
  type DbSubscriptionPeriod,
  type DbSubscriptionStatus,
  type ListedSubscription,
  type StatusTabKey,
  type StatusTone,
} from '@/lib/admin/subscriptions';
import { SUBSCRIPTION_CYCLES } from '@/lib/subscription/cycles';
import {
  updateSubscriptionNextDeliveryAction,
  updateSubscriptionCycleAction,
  updateSubscriptionStatusAction,
  fetchSubscriptionAuditLogAction,
  type AuditLogEntry,
} from './actions';

type CountsShape = Record<StatusTabKey, number>;

type Props = {
  rows: ListedSubscription[];
  total: number;
  counts: CountsShape;
  filters: AdminSubscriptionsSearchParams;
};

const TONES: Record<StatusTone, { bg: string; fg: string }> = {
  neutral: { bg: 'var(--neutral-soft)', fg: 'var(--neutral-soft-fg)' },
  success: { bg: 'var(--success-soft)', fg: 'var(--success)' },
  warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)' },
  info: { bg: 'var(--info-soft)', fg: 'var(--info)' },
};

export default function SubscriptionsTableClient({ rows, total, counts, filters }: Props) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(filters.q);
  const [editingRow, setEditingRow] = useState<ListedSubscription | null>(null);

  useEffect(() => {
    setSearchValue(filters.q);
  }, [filters.q]);

  function buildHref(override: Partial<AdminSubscriptionsSearchParams>): string {
    const merged = { ...filters, ...override };
    const params = new URLSearchParams();
    if (merged.status !== 'all') params.set('status', merged.status);
    if (merged.q.trim().length > 0) params.set('q', merged.q.trim());
    if (merged.page > 1) params.set('page', String(merged.page));
    const qs = params.toString();
    return qs.length > 0 ? `?${qs}` : '?';
  }

  useEffect(() => {
    if (searchValue === filters.q) return;
    const t = setTimeout(() => {
      router.replace(buildHref({ q: searchValue, page: 1 }));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isEnded = (s: ListedSubscription) => s.status === 'cancelled' || s.status === 'expired';

  const columns: readonly Column<ListedSubscription>[] = useMemo(() => [
    {
      key: 'user',
      header: '고객',
      cellClassName: 'text-sm',
      render: (s) => (
        <>
          <div className="font-medium">{resolveUserName(s)}</div>
          <div className="text-xs text-[var(--foreground-subtle)] mt-0.5">{s.userEmail}</div>
        </>
      ),
    },
    {
      key: 'product',
      header: '상품',
      cellClassName: 'text-sm',
      render: (s) => (
        <>
          <div className="font-medium">{extractKrName(s.productName)}</div>
          {s.productVolume && (
            <div className="text-xs text-muted-foreground mt-0.5">{s.productVolume}</div>
          )}
        </>
      ),
    },
    {
      key: 'cycle',
      header: '주기',
      cellClassName: 'text-sm',
      render: (s) => describeCycle(s.cycle),
    },
    {
      key: 'status',
      header: '상태',
      render: (s) => {
        const desc = describeStatus(s.status);
        const tone = TONES[desc.tone];
        return (
          <ShadcnBadge
            variant="outline"
            className="border-transparent rounded"
            style={{ background: tone.bg, color: tone.fg }}
          >
            {desc.label}
          </ShadcnBadge>
        );
      },
    },
    {
      key: 'nextDelivery',
      header: '다음 배송',
      cellClassName: 'text-xs text-muted-foreground tabular-nums',
      render: (s) => formatDeliveryDate(s.nextDeliveryAtIso),
    },
    {
      key: 'lastDelivery',
      header: '이전 배송',
      cellClassName: 'text-xs text-muted-foreground tabular-nums',
      render: (s) => (s.lastDeliveryAtIso ? formatDeliveryDate(s.lastDeliveryAtIso) : '—'),
    },
    {
      key: 'edit',
      header: '편집',
      align: 'right',
      width: 'w-[80px]',
      render: (s) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            onClick={() => setEditingRow(s)}
            disabled={isEnded(s)}
            title="구독 편집"
            aria-label="구독 편집"
          >
            <PencilIcon />
          </Button>
        </span>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  return (
    <>
      <AdminPageHeader
        title="정기배송 관리"
        subtitle={
          <>
            총 {counts.all.toLocaleString()}건의 구독
            {counts.active > 0 ? ` · ${counts.active.toLocaleString()}건 진행중` : ''}
          </>
        }
      />

      <AdminTabsNav
        mode="url"
        tabs={STATUS_TABS.map((t) => ({
          id: t.id,
          label: t.label,
          count: counts[t.id] ?? 0,
        }))}
        active={filters.status}
        buildHref={(id) => buildHref({ status: id as StatusTabKey, page: 1 })}
      />

      {/* 검색 — admin 공통 AdminSearchInput */}
      <div className="flex gap-2 mb-3 items-center">
        <AdminSearchInput
          value={searchValue}
          onChange={setSearchValue}
          placeholder="상품명 또는 이메일로 검색…"
        />
      </div>

      <AdminDataTable
        columns={columns}
        data={rows}
        rowKey={(s) => s.id}
        empty={
          <AdminEmptyState
            variant="table-row"
            colSpan={columns.length}
            message="표시할 구독이 없습니다."
          />
        }
        footer={
          <>
            <div>{describeRange(filters.page, total)}</div>
            <AdminPagination
              mode="url"
              page={filters.page}
              pageCount={pageCount}
              buildHref={(p) => buildHref({ page: p })}
            />
          </>
        }
      />

      {/* 통합 편집 다이얼로그 */}
      {editingRow && (
        <EditSubscriptionDialog
          row={editingRow}
          onClose={() => setEditingRow(null)}
          onSaved={(updated) => {
            setEditingRow(updated ?? null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

/* ── 공유 헬퍼 ──────────────────────────────────────────────────────── */

function describeRange(page: number, total: number): string {
  if (total === 0) return '0건';
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);
  return `총 ${total.toLocaleString()}건 · ${start.toLocaleString()}~${end.toLocaleString()}번째`;
}

/* ── 인라인 SVG ─────────────────────────────────── */

/* Pencil — 편집 액션 (size-3 자동 · icon-xs Button 매트릭스). */
const PencilIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);

/* ══════════════════════════════════════════════════════════════════════════
   EditSubscriptionDialog — 3섹션 통합 편집 다이얼로그
   1) 다음 배송일 변경
   2) 주기 변경
   3) 상태 변경 (pause / resume / cancel)

   carry-over (별 commit): inline style 토큰화 (배송주기 칩 · 폰트 크기).
   ══════════════════════════════════════════════════════════════════════════ */

type SectionKey = 'delivery' | 'cycle' | 'status' | 'history';

type DialogProps = {
  row: ListedSubscription;
  onClose: () => void;
  /** updated: 변경 후 row (null이면 다이얼로그 닫기) */
  onSaved: (updated: ListedSubscription | null) => void;
};

function EditSubscriptionDialog({ row, onClose, onSaved }: DialogProps) {
  const [activeSection, setActiveSection] = useState<SectionKey>('delivery');

  const userName = resolveUserName(row);
  const isActive = row.status === 'active';
  const isPaused = row.status === 'paused';

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      {/* gooddays B-180b 답습 — DialogContent 의 Tailwind p-6 가 admin Portal 안에서
         적용 안 되는 케이스 회피용 inline padding/gap. */}
      <DialogContent
        className="gtr-admin"
        style={{ padding: 0, gap: 0, maxWidth: 460 }}
      >
        {/* 다이얼로그 헤더 */}
        <DialogHeader style={{ padding: '20px 24px 0' }}>
          <DialogTitle style={{ fontSize: 16, fontWeight: 500 }}>
            구독 편집
          </DialogTitle>
          <DialogDescription style={{ fontSize: 12, marginBottom: 16 }}>
            {userName} · {extractKrName(row.productName)}
            {row.productVolume ? ` (${row.productVolume})` : ''} · 주기 {describeCycle(row.cycle)}
          </DialogDescription>

          {/* 섹션 탭 */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)' }}>
            {([
              { key: 'delivery', label: '배송일' },
              { key: 'cycle', label: '주기' },
              { key: 'status', label: '상태 변경' },
              { key: 'history', label: '변경 이력' },
            ] as { key: SectionKey; label: string }[]).map((tab) => {
              const active = tab.key === activeSection;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveSection(tab.key)}
                  style={{
                    padding: '8px 14px',
                    fontSize: 13,
                    fontWeight: active ? 500 : 400,
                    color: active ? 'var(--foreground)' : 'var(--foreground-muted)',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
                    cursor: 'pointer',
                    marginBottom: -1,
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </DialogHeader>

        {/* 섹션 콘텐츠 */}
        <div style={{ padding: '20px 24px 24px' }}>
          {activeSection === 'delivery' && (
            <DeliverySection
              row={row}
              onClose={onClose}
              onSaved={onSaved}
            />
          )}
          {activeSection === 'cycle' && (
            <CycleSection
              row={row}
              canEdit={isActive || isPaused}
              onClose={onClose}
              onSaved={onSaved}
            />
          )}
          {activeSection === 'status' && (
            <StatusSection
              row={row}
              onClose={onClose}
              onSaved={onSaved}
            />
          )}
          {activeSection === 'history' && (
            <HistorySection subscriptionId={row.id} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── 섹션 1: 다음 배송일 변경 ───────────────────────────────────────── */

function DeliverySection({
  row,
  onClose,
  onSaved,
}: {
  row: ListedSubscription;
  onClose: () => void;
  onSaved: (updated: ListedSubscription | null) => void;
}) {
  const [dateValue, setDateValue] = useState(isoToDateInput(row.nextDeliveryAtIso));
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const original = isoToDateInput(row.nextDeliveryAtIso);

  function handleSave() {
    setSubmitError(null);
    startTransition(async () => {
      const result = await updateSubscriptionNextDeliveryAction({
        subscriptionId: row.id,
        nextDeliveryAt: dateValue,
      });
      if (result.ok) {
        onSaved({ ...row, nextDeliveryAtIso: result.nextDeliveryAtIso });
        return;
      }
      const map: Record<string, string> = {
        unauthorized: '권한이 없습니다.',
        validation_failed: '입력값이 잘못되었습니다.',
        not_found: '구독을 찾을 수 없습니다.',
        server_error: '저장 중 오류가 발생했습니다.',
      };
      setSubmitError(map[result.error] ?? '오류가 발생했습니다.');
    });
  }

  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--foreground-muted)', marginBottom: 6 }}>
        다음 배송일 (KST)
      </label>
      <Input
        type="date"
        value={dateValue}
        onChange={(e) => setDateValue(e.target.value)}
        disabled={isPending}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      />
      {submitError && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--destructive)' }}>{submitError}</div>
      )}
      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <CancelButton onClick={onClose} disabled={isPending} />
        <SaveButton
          onClick={handleSave}
          disabled={isPending || dateValue === original}
          isPending={isPending}
        />
      </div>
    </div>
  );
}

/* ── 섹션 2: 주기 변경 ────────────────────────────────────────────────── */

function CycleSection({
  row,
  canEdit,
  onClose,
  onSaved,
}: {
  row: ListedSubscription;
  canEdit: boolean;
  onClose: () => void;
  onSaved: (updated: ListedSubscription | null) => void;
}) {
  const [newCycle, setNewCycle] = useState(row.cycle);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setSubmitError(null);
    startTransition(async () => {
      const result = await updateSubscriptionCycleAction({
        subscriptionId: row.id,
        newCycle,
      });
      if (result.ok) {
        onSaved({ ...row, cycle: result.cycle as typeof row.cycle, nextDeliveryAtIso: result.nextDeliveryAtIso });
        return;
      }
      const map: Record<string, string> = {
        unauthorized: '권한이 없습니다.',
        validation_failed: '입력값이 잘못되었습니다.',
        not_found: '구독을 찾을 수 없습니다.',
        conflict: '해지·만료된 구독은 변경할 수 없습니다.',
        server_error: '저장 중 오류가 발생했습니다.',
      };
      setSubmitError(map[result.error] ?? '오류가 발생했습니다.');
    });
  }

  if (!canEdit) {
    return (
      <div style={{ fontSize: 13, color: 'var(--foreground-muted)', padding: '12px 0' }}>
        해지·만료된 구독은 주기를 변경할 수 없습니다.
      </div>
    );
  }

  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--foreground-muted)', marginBottom: 6 }}>
        배송 주기
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        {SUBSCRIPTION_CYCLES.map((c) => {
          const selected = c === newCycle;
          return (
            <Button
              key={c}
              type="button"
              variant={selected ? 'default' : 'outline'}
              onClick={() => setNewCycle(c)}
              disabled={isPending}
              className="flex-1"
            >
              {c}
            </Button>
          );
        })}
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--foreground-muted)' }}>
        변경 시 다음 배송일이 재계산됩니다 (직전 배송일 + 새 주기).
      </div>
      {submitError && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--destructive)' }}>{submitError}</div>
      )}
      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <CancelButton onClick={onClose} disabled={isPending} />
        <SaveButton
          onClick={handleSave}
          disabled={isPending || newCycle === row.cycle}
          isPending={isPending}
        />
      </div>
    </div>
  );
}

/* ── 섹션 3: 상태 변경 ────────────────────────────────────────────────── */

function StatusSection({
  row,
  onClose,
  onSaved,
}: {
  row: ListedSubscription;
  onClose: () => void;
  onSaved: (updated: ListedSubscription | null) => void;
}) {
  const [cancelReason, setCancelReason] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isActive = row.status === 'active';
  const isPaused = row.status === 'paused';

  function handleAction(action: 'pause' | 'resume' | 'cancel') {
    setSubmitError(null);
    startTransition(async () => {
      const result = await updateSubscriptionStatusAction({
        subscriptionId: row.id,
        action,
        cancelReason: action === 'cancel' ? cancelReason || undefined : undefined,
      });
      if (result.ok) {
        onSaved(null);
        return;
      }
      const map: Record<string, string> = {
        unauthorized: '권한이 없습니다.',
        validation_failed: '입력값이 잘못되었습니다.',
        not_found: '구독을 찾을 수 없습니다.',
        conflict: '현재 상태에서는 해당 작업이 불가능합니다.',
        server_error: '처리 중 오류가 발생했습니다.',
      };
      setSubmitError(map[result.error] ?? '오류가 발생했습니다.');
    });
  }

  /* admin soft tone — shadcn Button variant 매핑 없음. inline style 강제 + size=sm. */
  const softWarning: React.CSSProperties = { background: 'var(--warning-soft)', color: 'var(--warning)' };
  const softDestructive: React.CSSProperties = { background: 'var(--destructive-soft, #fee2e2)', color: 'var(--destructive)' };
  const softSuccess: React.CSSProperties = { background: 'var(--success-soft)', color: 'var(--success)' };

  return (
    <div>
      {isActive && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
            현재 상태: <strong style={{ color: 'var(--foreground)' }}>진행중</strong>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleAction('pause')}
              disabled={isPending}
              style={softWarning}
            >
              일시정지
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmCancel((v) => !v)}
              disabled={isPending}
              style={softDestructive}
            >
              해지
            </Button>
          </div>
          {confirmCancel && (
            <div style={{ background: 'var(--surface-muted)', borderRadius: 'var(--radius)', padding: 14 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--foreground-muted)', marginBottom: 6 }}>
                해지 사유 (선택)
              </label>
              <Input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="해지 사유를 입력하세요…"
                maxLength={200}
                className="!h-8"
              />
              <Button
                type="button"
                variant="destructive"
                onClick={() => handleAction('cancel')}
                disabled={isPending}
                className="mt-2.5"
              >
                {isPending ? '처리중…' : '해지 확정'}
              </Button>
            </div>
          )}
        </div>
      )}

      {isPaused && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
            현재 상태: <strong style={{ color: 'var(--foreground)' }}>일시정지</strong>
          </div>
          <div style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>
            재개 시 다음 배송일 = 오늘 + 배송 주기로 설정됩니다.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleAction('resume')}
              disabled={isPending}
              style={softSuccess}
            >
              {isPending ? '처리중…' : '재개'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmCancel((v) => !v)}
              disabled={isPending}
              style={softDestructive}
            >
              해지
            </Button>
          </div>
          {confirmCancel && (
            <div style={{ background: 'var(--surface-muted)', borderRadius: 'var(--radius)', padding: 14 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--foreground-muted)', marginBottom: 6 }}>
                해지 사유 (선택)
              </label>
              <Input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="해지 사유를 입력하세요…"
                maxLength={200}
                className="!h-8"
              />
              <Button
                type="button"
                variant="destructive"
                onClick={() => handleAction('cancel')}
                disabled={isPending}
                className="mt-2.5"
              >
                {isPending ? '처리중…' : '해지 확정'}
              </Button>
            </div>
          )}
        </div>
      )}

      {!isActive && !isPaused && (
        <div style={{ fontSize: 13, color: 'var(--foreground-muted)', padding: '12px 0' }}>
          {row.status === 'cancelled' ? '해지된 구독입니다.' : '만료된 구독입니다.'} 상태를 변경할 수 없습니다.
        </div>
      )}

      {submitError && (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--destructive)' }}>{submitError}</div>
      )}
      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
        <CancelButton onClick={onClose} disabled={isPending} label="닫기" />
      </div>
    </div>
  );
}

/* ── 섹션 4: 변경 이력 ────────────────────────────────────────────────── */

const ACTION_LABELS: Record<string, string> = {
  update_next_delivery: '배송일 변경',
  update_cycle: '주기 변경',
  update_status: '상태 변경',
};

function formatAuditChange(entry: AuditLogEntry): string {
  const old = entry.oldValue ?? {};
  const next = entry.newValue ?? {};

  if (entry.action === 'update_next_delivery') {
    const oldDate = old.next_delivery_at ? formatDeliveryDate(old.next_delivery_at as string) : '—';
    const newDate = next.next_delivery_at ? formatDeliveryDate(next.next_delivery_at as string) : '—';
    return `${oldDate} → ${newDate}`;
  }
  if (entry.action === 'update_cycle') {
    const oldCycle = describeCycle(old.cycle as DbSubscriptionPeriod);
    const newCycle = describeCycle(next.cycle as DbSubscriptionPeriod);
    const newDate = next.next_delivery_at ? formatDeliveryDate(next.next_delivery_at as string) : '—';
    return `${oldCycle} → ${newCycle} (다음 배송: ${newDate})`;
  }
  if (entry.action === 'update_status') {
    const oldStatus = describeStatus(old.status as DbSubscriptionStatus).label;
    const newStatus = describeStatus(next.status as DbSubscriptionStatus).label;
    const reason = next.cancel_reason ? ` · ${next.cancel_reason}` : '';
    return `${oldStatus} → ${newStatus}${reason}`;
  }
  return '';
}

function formatAuditTimestamp(iso: string): string {
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}.${get('month')}.${get('day')} ${get('hour')}:${get('minute')}`;
}

function HistorySection({ subscriptionId }: { subscriptionId: string }) {
  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setEntries(null);
    setLoadError(false);
    fetchSubscriptionAuditLogAction(subscriptionId).then((result) => {
      if (result.ok) {
        setEntries(result.entries);
      } else {
        setLoadError(true);
      }
    });
  }, [subscriptionId]);

  if (entries === null && !loadError) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--foreground-muted)' }}>
        불러오는 중…
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ padding: '12px 0', fontSize: 13, color: 'var(--destructive)' }}>
        이력을 불러오지 못했습니다.
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--foreground-muted)' }}>
        변경 이력이 없습니다.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxHeight: 320, overflowY: 'auto' }}>
      {entries.map((entry, i) => (
        <div
          key={entry.id}
          style={{
            padding: '10px 0',
            borderBottom: i < entries.length - 1 ? '1px solid var(--border)' : 'none',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--foreground)' }}>
              {ACTION_LABELS[entry.action] ?? entry.action}
            </span>
            <span style={{ fontSize: 11, color: 'var(--foreground-muted)', fontVariantNumeric: 'tabular-nums' }}>
              {formatAuditTimestamp(entry.createdAt)}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
            {formatAuditChange(entry)}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── 공통 버튼 ───────────────────────────────────────────────────────── */

function CancelButton({
  onClick,
  disabled,
  label = '취소',
}: {
  onClick: () => void;
  disabled: boolean;
  label?: string;
}) {
  return (
    <Button type="button" variant="outline" onClick={onClick} disabled={disabled}>
      {label}
    </Button>
  );
}

function SaveButton({
  onClick,
  disabled,
  isPending,
}: {
  onClick: () => void;
  disabled: boolean;
  isPending: boolean;
}) {
  return (
    <Button type="button" onClick={onClick} disabled={disabled}>
      {isPending ? '저장중…' : '저장'}
    </Button>
  );
}
