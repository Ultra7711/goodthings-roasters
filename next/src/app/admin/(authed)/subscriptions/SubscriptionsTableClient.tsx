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
import { toast } from 'sonner';
import { extractKrName } from '@/lib/products';
import { AdminSearchInput } from '@/components/admin/AdminSearchInput';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminTabsNav } from '@/components/admin/AdminTabsNav';
import { AdminDataTable, type Column } from '@/components/admin/AdminDataTable';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
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
import {
  SUBSCRIPTION_CYCLES,
  CYCLE_DAYS,
  recalculateNextDeliveryOnCycleChange,
} from '@/lib/subscription/cycles';
import {
  updateSubscriptionNextDeliveryAction,
  updateSubscriptionCycleAction,
  updateSubscriptionStatusAction,
  fetchSubscriptionAuditLogAction,
  exportSubscriptionsCsvAction,
  type AuditLogEntry,
} from './actions';
import { downloadXlsxFromBase64 } from '@/lib/admin/clientDownload';

type CountsShape = Record<StatusTabKey, number>;

type Props = {
  rows: ListedSubscription[];
  total: number;
  counts: CountsShape;
  filters: AdminSubscriptionsSearchParams;
  /** S232: owner (관리자) 만 CSV 내보내기 활성. staff (운영자) 는 disabled. */
  isOwner: boolean;
};

const TONES: Record<StatusTone, { bg: string; fg: string }> = {
  neutral: { bg: 'var(--neutral-soft)', fg: 'var(--neutral-soft-fg)' },
  success: { bg: 'var(--success-soft)', fg: 'var(--success)' },
  warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)' },
  info: { bg: 'var(--info-soft)', fg: 'var(--info)' },
};

export default function SubscriptionsTableClient({ rows, total, counts, filters, isOwner }: Props) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(filters.q);
  const [editingRow, setEditingRow] = useState<ListedSubscription | null>(null);
  const [isExporting, startExport] = useTransition();

  useEffect(() => {
    setSearchValue(filters.q);
  }, [filters.q]);

  /* CSV 내보내기 — 현재 status / q 필터 적용. truncated 시 안내 toast. */
  function handleExport() {
    startExport(async () => {
      const result = await exportSubscriptionsCsvAction({
        status: filters.status,
        q: filters.q,
      });
      if (!result.ok) {
        const map: Record<string, string> = {
          unauthorized: '권한이 없습니다.',
          validation_failed: '입력값이 잘못되었습니다.',
          server_error: '내보내는 중 오류가 발생했습니다.',
        };
        toast.error(map[result.error] ?? '오류가 발생했습니다.');
        return;
      }
      if (result.rowCount === 0) {
        toast.info('내보낼 구독이 없습니다.');
        return;
      }
      /* S255-C: xlsx Buffer 를 base64 로 받아 디코딩 후 다운로드. */
      downloadXlsxFromBase64(result.xlsxBase64, result.filename);

      if (result.truncated) {
        toast.warning(
          `${result.rowCount.toLocaleString()}건 내보냈습니다. 상한(10,000건) 초과 — 필터를 좁혀 다시 내보내주세요.`,
        );
      } else {
        toast.success(`${result.rowCount.toLocaleString()}건을 내보냈습니다.`);
      }
    });
  }

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
      <AdminTopbarActions>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="!h-7"
          onClick={handleExport}
          disabled={!isOwner || isExporting || total === 0}
          title={
            !isOwner
              ? '관리자 권한 필요'
              : '현재 필터 기준으로 Excel 내보내기'
          }
        >
          <DownloadIcon />
          {isExporting ? '내보내는 중…' : 'Excel 내보내기'}
        </Button>
      </AdminTopbarActions>

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

/* Download — CSV 내보내기 버튼 (Orders 답습). */
const DownloadIcon = () => (
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
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 10l5 5 5-5" />
    <path d="M12 15V3" />
  </svg>
);

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
        className="gtr-admin p-0 gap-0 max-w-[460px]"
      >
        {/* 다이얼로그 헤더 */}
        <DialogHeader className="px-6 pt-5">
          <DialogTitle className="text-lg font-medium">
            구독 편집
          </DialogTitle>
          <DialogDescription className="text-sm mb-4">
            {userName} · {extractKrName(row.productName)}
            {row.productVolume ? ` (${row.productVolume})` : ''} · 주기 {describeCycle(row.cycle)}
            {' '} ·  다음 배송 <span className="tabular-nums">{formatDeliveryDate(row.nextDeliveryAtIso)}</span>
          </DialogDescription>

          {/* 섹션 탭 */}
          <div className="flex gap-0 border-b border-border">
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
                  data-slot="tabs-nav-item"
                  onClick={() => setActiveSection(tab.key)}
                  className={`px-3 py-2 text-sm font-medium bg-transparent cursor-pointer -mb-px border-b-2 ${
                    active
                      ? 'text-foreground border-[var(--primary)]'
                      : 'text-muted-foreground border-transparent'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </DialogHeader>

        {/* 섹션 콘텐츠 — min-h 로 탭 전환 시 다이얼로그 크기 통일 (울렁거림 방지).
           flex-col 으로 각 섹션이 영역 다 차지 → CTA 가 mt-auto 로 하단 고정. */}
        <div className="px-6 pt-5 pb-6 min-h-[320px] flex flex-col">
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
    <div className="flex-1 flex flex-col">
      <label className="block text-xs text-muted-foreground mb-1.5">
        다음 배송일 (KST)
      </label>
      <Input
        type="date"
        value={dateValue}
        onChange={(e) => setDateValue(e.target.value)}
        disabled={isPending}
        className="tabular-nums"
      />
      {submitError && (
        <div className="mt-2 text-xs text-destructive">{submitError}</div>
      )}
      <div className="mt-auto pt-5 flex justify-end gap-2">
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

  /* 미리보기 — newCycle !== row.cycle 일 때만 계산 (SoT = lib/subscription/cycles). */
  const previewNextIso = useMemo(() => {
    if (newCycle === row.cycle) return null;
    return recalculateNextDeliveryOnCycleChange(
      new Date(row.nextDeliveryAtIso),
      row.cycle,
      newCycle,
    ).toISOString();
  }, [newCycle, row.cycle, row.nextDeliveryAtIso]);

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
        conflict: '해지 · 만료된 구독은 변경할 수 없습니다.',
        server_error: '저장 중 오류가 발생했습니다.',
      };
      setSubmitError(map[result.error] ?? '오류가 발생했습니다.');
    });
  }

  if (!canEdit) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="text-sm text-muted-foreground py-3">
          해지 · 만료된 구독은 주기를 변경할 수 없습니다.
        </div>
        <div className="mt-auto pt-5 flex justify-end gap-2">
          <CancelButton onClick={onClose} disabled={false} label="닫기" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <label className="block text-xs text-muted-foreground mb-1.5">
        배송 주기
      </label>
      <div className="flex gap-2">
        {SUBSCRIPTION_CYCLES.map((c) => {
          const selected = c === newCycle;
          return (
            <button
              key={c}
              type="button"
              data-slot="chip-radio"
              onClick={() => setNewCycle(c)}
              disabled={isPending}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs border font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                selected
                  ? 'bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary)]'
                  : 'bg-[var(--surface)] text-foreground border-border'
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>
      {/* 미리보기 — 새 주기 선택 시 실 날짜 표시 (SoT 답습). */}
      {previewNextIso && (
        <div className="bg-[var(--surface-muted)] rounded-[var(--radius)] p-3 mt-3 text-xs">
          <div className="flex justify-between text-muted-foreground">
            <span>현재 다음 배송</span>
            <span className="tabular-nums">
              {formatDeliveryDate(row.nextDeliveryAtIso)} ({describeCycle(row.cycle)})
            </span>
          </div>
          <div className="mt-1 flex justify-between text-foreground font-medium">
            <span>변경 후 다음 배송</span>
            <span className="tabular-nums">
              {formatDeliveryDate(previewNextIso)} ({describeCycle(newCycle)})
            </span>
          </div>
        </div>
      )}
      <div className="mt-2 text-xs text-muted-foreground">
        변경 저장 시 다음 배송일이 재계산됩니다.
      </div>
      {submitError && (
        <div className="mt-2 text-xs text-destructive">{submitError}</div>
      )}
      <div className="mt-auto pt-5 flex justify-end gap-2">
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
  const [selectedAction, setSelectedAction] = useState<'pause' | 'resume' | 'cancel' | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isActive = row.status === 'active';
  const isPaused = row.status === 'paused';
  const canEdit = isActive || isPaused;

  /* status 별 가능한 action 옵션 — 칩 라디오. */
  const availableActions = useMemo(() => {
    if (isActive)
      return [
        { id: 'pause' as const, label: '일시정지' },
        { id: 'cancel' as const, label: '해지' },
      ];
    if (isPaused)
      return [
        { id: 'resume' as const, label: '재개' },
        { id: 'cancel' as const, label: '해지' },
      ];
    return [];
  }, [isActive, isPaused]);

  /* 재개 시 다음 배송 미리보기 — 클라 기준 today + cycle (서버 KST 와 미세 차이 가능).
     안내용이므로 UI 정합 충분 (정확값은 서버 actions.ts resume 처리). */
  const resumePreviewIso = useMemo(() => {
    if (!isPaused) return null;
    const next = new Date();
    next.setDate(next.getDate() + CYCLE_DAYS[row.cycle]);
    return next.toISOString();
  }, [isPaused, row.cycle]);

  function handleSave() {
    if (!selectedAction) return;
    setSubmitError(null);
    startTransition(async () => {
      const result = await updateSubscriptionStatusAction({
        subscriptionId: row.id,
        action: selectedAction,
        cancelReason: selectedAction === 'cancel' ? cancelReason || undefined : undefined,
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

  /* 헤더 상태 Badge — 부모 페이지 리스트 답습 (TONES 매트릭스 정합). */
  const statusDesc = describeStatus(row.status);
  const statusTone = TONES[statusDesc.tone];

  return (
    <div className="flex-1 flex flex-col">
      {/* 현재 상태 — label 위치 = 다른 섹션 답습 (DeliverySection/CycleSection). */}
      <label className="block text-xs text-muted-foreground mb-1.5">
        현재 상태
      </label>
      <div className="mb-4">
        <ShadcnBadge
          variant="outline"
          className="border-transparent rounded"
          style={{ background: statusTone.bg, color: statusTone.fg }}
        >
          {statusDesc.label}
        </ShadcnBadge>
      </div>

      {!canEdit && (
        <div className="text-sm text-muted-foreground">
          상태를 변경할 수 없습니다.
        </div>
      )}

      {canEdit && (
        <>
          {/* 칩 라디오 (CycleSection 답습) */}
          <label className="block text-xs text-muted-foreground mb-1.5">
            선택할 상태
          </label>
          <div className="flex gap-2">
            {availableActions.map((a) => {
              const selected = a.id === selectedAction;
              return (
                <button
                  key={a.id}
                  type="button"
                  data-slot="chip-radio"
                  onClick={() => setSelectedAction(a.id)}
                  disabled={isPending}
                  className={`flex-1 px-3 py-1.5 rounded-md text-xs border font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    selected
                      ? 'bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary)]'
                      : 'bg-[var(--surface)] text-foreground border-border'
                  }`}
                >
                  {a.label}
                </button>
              );
            })}
          </div>

          {/* 미리보기 / 안내 — 칩 선택 시 노출 */}
          {selectedAction === 'pause' && (
            <div className="bg-[var(--surface-muted)] rounded-[var(--radius)] p-3 mt-3 text-xs text-muted-foreground">
              배송 보류 — 재개 시점에 다음 배송일이 재계산됩니다.
            </div>
          )}
          {selectedAction === 'resume' && resumePreviewIso && (
            <div className="bg-[var(--surface-muted)] rounded-[var(--radius)] p-3 mt-3 text-xs">
              <div className="flex justify-between text-foreground font-medium">
                <span>재개 시 다음 배송</span>
                <span className="tabular-nums">{formatDeliveryDate(resumePreviewIso)}</span>
              </div>
            </div>
          )}
          {selectedAction === 'cancel' && (
            <div className="mt-3">
              <label className="block text-xs text-muted-foreground mb-1.5">
                해지 사유 (선택)
              </label>
              <Input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="해지 사유를 입력하세요…"
                maxLength={200}
              />
            </div>
          )}
        </>
      )}

      {submitError && (
        <div className="mt-3 text-xs text-destructive">{submitError}</div>
      )}

      <div className="mt-auto pt-5 flex justify-end gap-2">
        <CancelButton onClick={onClose} disabled={isPending} />
        {canEdit &&
          (selectedAction === 'cancel' ? (
            <Button
              type="button"
              variant="destructive"
              onClick={handleSave}
              disabled={isPending || !selectedAction}
              className="min-w-20"
            >
              {isPending ? '처리 중…' : '해지 확정'}
            </Button>
          ) : (
            <SaveButton
              onClick={handleSave}
              disabled={isPending || !selectedAction}
              isPending={isPending}
            />
          ))}
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
      <div className="py-6 text-center text-sm text-muted-foreground">
        불러오는 중…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="py-3 text-sm text-destructive">
        이력을 불러오지 못했습니다.
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        변경 이력이 없습니다.
      </div>
    );
  }

  return (
    <div className="bg-[var(--surface-muted)] border border-border rounded-[var(--radius)] max-h-[260px] overflow-y-auto">
      {entries.map((entry, i) => (
        <div
          key={entry.id}
          className={`px-3 py-2.5 ${i < entries.length - 1 ? 'border-b border-border' : ''}`}
        >
          <div className="flex justify-between items-baseline mb-0.5">
            <span className="text-xs font-medium text-foreground">
              {ACTION_LABELS[entry.action] ?? entry.action}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatAuditTimestamp(entry.createdAt)}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
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
    <Button type="button" variant="outline" onClick={onClick} disabled={disabled} className="min-w-20">
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
    <Button type="button" onClick={onClick} disabled={disabled} className="min-w-20">
      {isPending ? '저장 중…' : '저장'}
    </Button>
  );
}
