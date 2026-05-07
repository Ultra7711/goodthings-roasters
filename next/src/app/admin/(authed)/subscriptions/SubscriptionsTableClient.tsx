'use client';

/* ══════════════════════════════════════════════════════════════════════════
   SubscriptionsTableClient — /admin/subscriptions 인터랙티브 본체 (S189 Group D)

   책임 (operating safety net):
   - status 탭 (전체 / 진행중 / 일시정지 / 해지 / 만료)
   - product_name 검색 (debounced)
   - 테이블: 사용자 / 상품 / 주기 / 상태 / 다음 배송일 / 편집 액션
   - 통합 편집 다이얼로그 (3섹션):
     1) 다음 배송일 변경
     2) 주기 변경
     3) 상태 변경 (pause / resume / cancel)
   - 페이지네이션

   참조:
   - lib/admin/subscriptions.ts            (헬퍼)
   - actions.ts                             (Server Actions)
   - app/admin/(authed)/users/UsersTableClient.tsx (스타일 패턴 답습)
   ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  PAGE_SIZE,
  STATUS_TABS,
  describeStatus,
  describeCycle,
  formatDeliveryDate,
  isoToDateInput,
  resolveUserName,
  type AdminSubscriptionsSearchParams,
  type ListedSubscription,
  type StatusTabKey,
  type StatusTone,
} from '@/lib/admin/subscriptions';
import { SUBSCRIPTION_CYCLES } from '@/lib/subscription/cycles';
import {
  updateSubscriptionNextDeliveryAction,
  updateSubscriptionCycleAction,
  updateSubscriptionStatusAction,
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
  fontSize: 13,
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

  return (
    <>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 500, letterSpacing: '-0.02em' }}>정기배송 관리</h2>
          <div style={{ marginTop: 4, fontSize: 13, color: 'var(--foreground-muted)' }}>
            총 {counts.all.toLocaleString()}건의 구독
            {counts.active > 0 ? ` · ${counts.active.toLocaleString()}건 진행중` : ''}
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        {STATUS_TABS.map((t) => {
          const active = t.id === filters.status;
          const cnt = counts[t.id] ?? 0;
          return (
            <Link
              key={t.id}
              href={buildHref({ status: t.id, page: 1 })}
              replace
              style={{
                padding: '8px 14px',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                color: active ? 'var(--foreground)' : 'var(--foreground-muted)',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                textDecoration: 'none',
              }}
            >
              {t.label}
              <span
                style={{
                  fontSize: 11,
                  fontVariantNumeric: 'tabular-nums',
                  color: active ? 'var(--foreground-muted)' : 'var(--foreground-subtle)',
                  background: active ? 'var(--surface-muted)' : 'transparent',
                  padding: '1px 6px',
                  borderRadius: 4,
                }}
              >
                {cnt.toLocaleString()}
              </span>
              {active && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: -1,
                    height: 2,
                    background: 'var(--primary)',
                  }}
                />
              )}
            </Link>
          );
        })}
      </div>

      {/* 검색 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="상품명으로 검색…"
          style={{
            flex: 1,
            maxWidth: 360,
            height: 32,
            padding: '0 12px',
            fontSize: 13,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            background: 'var(--surface)',
            color: 'var(--foreground)',
            outline: 'none',
          }}
        />
      </div>

      {/* 테이블 */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: 0,
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface-muted)' }}>
              <th style={TH_STYLE}>고객</th>
              <th style={TH_STYLE}>상품</th>
              <th style={TH_STYLE}>주기</th>
              <th style={TH_STYLE}>상태</th>
              <th style={TH_STYLE}>다음 배송</th>
              <th style={TH_STYLE}>이전 배송</th>
              <th style={{ ...TH_STYLE, width: 80, textAlign: 'right' }}>편집</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13 }}>
                  표시할 구독이 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((s, i) => {
                const desc = describeStatus(s.status);
                const tone = TONES[desc.tone];
                const userName = resolveUserName(s);
                const lastBorder = i === rows.length - 1 ? 'none' : '1px solid var(--border)';
                const ended = isEnded(s);
                return (
                  <tr key={s.id} style={{ borderBottom: lastBorder }}>
                    <td style={TD_STYLE}>
                      <div style={{ fontWeight: 500 }}>{userName}</div>
                      <div style={{ fontSize: 11, color: 'var(--foreground-muted)', marginTop: 2 }}>{s.userEmail}</div>
                    </td>
                    <td style={TD_STYLE}>
                      <div>{s.productName}</div>
                      {s.productVolume && (
                        <div style={{ fontSize: 11, color: 'var(--foreground-muted)', marginTop: 2 }}>{s.productVolume}</div>
                      )}
                    </td>
                    <td style={TD_STYLE}>{describeCycle(s.cycle)}</td>
                    <td style={TD_STYLE}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 500,
                          background: tone.bg,
                          color: tone.fg,
                        }}
                      >
                        {desc.label}
                      </span>
                    </td>
                    <td style={{ ...TD_STYLE, fontVariantNumeric: 'tabular-nums' }}>
                      {formatDeliveryDate(s.nextDeliveryAtIso)}
                    </td>
                    <td style={{ ...TD_STYLE, fontVariantNumeric: 'tabular-nums', color: 'var(--foreground-muted)' }}>
                      {s.lastDeliveryAtIso ? formatDeliveryDate(s.lastDeliveryAtIso) : '—'}
                    </td>
                    <td style={{ ...TD_STYLE, textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => setEditingRow(s)}
                        disabled={ended}
                        style={{
                          padding: '4px 10px',
                          fontSize: 12,
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 4,
                          cursor: ended ? 'not-allowed' : 'pointer',
                          color: 'var(--foreground)',
                          opacity: ended ? 0.5 : 1,
                        }}
                      >
                        편집
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {pageCount > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, marginTop: 16 }}>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => {
            const active = p === filters.page;
            return (
              <Link
                key={p}
                href={buildHref({ page: p })}
                replace
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 32,
                  height: 32,
                  padding: '0 8px',
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: active ? 500 : 400,
                  background: active ? 'var(--primary)' : 'transparent',
                  color: active ? 'var(--primary-fg)' : 'var(--foreground-muted)',
                  textDecoration: 'none',
                }}
              >
                {p}
              </Link>
            );
          })}
        </div>
      )}

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

/* ══════════════════════════════════════════════════════════════════════════
   EditSubscriptionDialog — 3섹션 통합 편집 다이얼로그
   1) 다음 배송일 변경
   2) 주기 변경
   3) 상태 변경 (pause / resume / cancel)
   ══════════════════════════════════════════════════════════════════════════ */

type SectionKey = 'delivery' | 'cycle' | 'status';

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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-subscription-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.4)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 460,
          maxWidth: 'calc(100vw - 48px)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.16)',
          overflow: 'hidden',
        }}
      >
        {/* 다이얼로그 헤더 */}
        <div style={{ padding: '20px 24px 0' }}>
          <h3 id="edit-subscription-title" style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 500 }}>
            구독 편집
          </h3>
          <div style={{ fontSize: 12, color: 'var(--foreground-muted)', marginBottom: 16 }}>
            {userName} · {row.productName}
            {row.productVolume ? ` (${row.productVolume})` : ''} · 주기 {describeCycle(row.cycle)}
          </div>

          {/* 섹션 탭 */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)' }}>
            {([
              { key: 'delivery', label: '배송일' },
              { key: 'cycle', label: '주기' },
              { key: 'status', label: '상태 변경' },
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
        </div>

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
        </div>
      </div>
    </div>
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
      <input
        type="date"
        value={dateValue}
        onChange={(e) => setDateValue(e.target.value)}
        disabled={isPending}
        style={{
          width: '100%',
          height: 36,
          padding: '0 12px',
          fontSize: 14,
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          background: 'var(--surface)',
          color: 'var(--foreground)',
          outline: 'none',
          fontVariantNumeric: 'tabular-nums',
          boxSizing: 'border-box',
        }}
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
            <button
              key={c}
              type="button"
              onClick={() => setNewCycle(c)}
              disabled={isPending}
              style={{
                flex: 1,
                height: 36,
                fontSize: 13,
                fontWeight: selected ? 500 : 400,
                background: selected ? 'var(--primary)' : 'var(--surface)',
                color: selected ? 'var(--primary-fg)' : 'var(--foreground)',
                border: selected ? 'none' : '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                cursor: isPending ? 'not-allowed' : 'pointer',
              }}
            >
              {c}
            </button>
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

  const btnBase: React.CSSProperties = {
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 500,
    border: 'none',
    borderRadius: 'var(--radius)',
    cursor: isPending ? 'not-allowed' : 'pointer',
    opacity: isPending ? 0.5 : 1,
  };

  return (
    <div>
      {isActive && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
            현재 상태: <strong style={{ color: 'var(--foreground)' }}>진행중</strong>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => handleAction('pause')}
              disabled={isPending}
              style={{
                ...btnBase,
                background: 'var(--warning-soft)',
                color: 'var(--warning)',
              }}
            >
              일시정지
            </button>
            <button
              type="button"
              onClick={() => setConfirmCancel((v) => !v)}
              disabled={isPending}
              style={{
                ...btnBase,
                background: 'var(--destructive-soft, #fee2e2)',
                color: 'var(--destructive)',
              }}
            >
              해지
            </button>
          </div>
          {confirmCancel && (
            <div style={{ background: 'var(--surface-muted)', borderRadius: 'var(--radius)', padding: 14 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--foreground-muted)', marginBottom: 6 }}>
                해지 사유 (선택)
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="해지 사유를 입력하세요…"
                maxLength={200}
                style={{
                  width: '100%',
                  height: 32,
                  padding: '0 10px',
                  fontSize: 13,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  background: 'var(--surface)',
                  color: 'var(--foreground)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => handleAction('cancel')}
                disabled={isPending}
                style={{
                  ...btnBase,
                  marginTop: 10,
                  background: 'var(--destructive)',
                  color: '#fff',
                }}
              >
                {isPending ? '처리중…' : '해지 확정'}
              </button>
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
            <button
              type="button"
              onClick={() => handleAction('resume')}
              disabled={isPending}
              style={{
                ...btnBase,
                background: 'var(--success-soft)',
                color: 'var(--success)',
              }}
            >
              {isPending ? '처리중…' : '재개'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmCancel((v) => !v)}
              disabled={isPending}
              style={{
                ...btnBase,
                background: 'var(--destructive-soft, #fee2e2)',
                color: 'var(--destructive)',
              }}
            >
              해지
            </button>
          </div>
          {confirmCancel && (
            <div style={{ background: 'var(--surface-muted)', borderRadius: 'var(--radius)', padding: 14 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--foreground-muted)', marginBottom: 6 }}>
                해지 사유 (선택)
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="해지 사유를 입력하세요…"
                maxLength={200}
                style={{
                  width: '100%',
                  height: 32,
                  padding: '0 10px',
                  fontSize: 13,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  background: 'var(--surface)',
                  color: 'var(--foreground)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => handleAction('cancel')}
                disabled={isPending}
                style={{
                  ...btnBase,
                  marginTop: 10,
                  background: 'var(--destructive)',
                  color: '#fff',
                }}
              >
                {isPending ? '처리중…' : '해지 확정'}
              </button>
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
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '8px 14px',
        fontSize: 13,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: 'var(--foreground)',
      }}
    >
      {label}
    </button>
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
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '8px 14px',
        fontSize: 13,
        background: 'var(--primary)',
        border: 'none',
        borderRadius: 'var(--radius)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: 'var(--primary-fg)',
        fontWeight: 500,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {isPending ? '저장중…' : '저장'}
    </button>
  );
}
