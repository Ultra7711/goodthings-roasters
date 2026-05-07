'use client';

/* ══════════════════════════════════════════════════════════════════════════
   SubscriptionsTableClient — /admin/subscriptions 인터랙티브 본체 (S188 minimal)

   책임 (operating safety net):
   - status 탭 (전체 / 진행중 / 일시정지 / 해지 / 만료)
   - product_name 검색 (debounced)
   - 테이블: 사용자 / 상품 / 주기 / 상태 / 다음 배송일 / 편집 액션
   - next_delivery_at 편집 다이얼로그 — date input
   - 페이지네이션

   비포함 (carry-over · full Group D):
   - cycle / qty / status / cancel / pause / resume 변경
   - audit log 조회
   - CSV 내보내기 / 일괄 처리
   - 사용자 상세 조회

   참조:
   - lib/admin/subscriptions.ts            (헬퍼)
   - actions.ts                             (Server Action)
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
import { updateSubscriptionNextDeliveryAction } from './actions';

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

  /* filters.q 가 외부에서 바뀌면 (예: 탭 전환) input 도 동기화 */
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

  /* 검색 — 300ms debounced router.replace */
  useEffect(() => {
    if (searchValue === filters.q) return;
    const t = setTimeout(() => {
      router.replace(buildHref({ q: searchValue, page: 1 }));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 500, letterSpacing: '-0.02em' }}>정기배송 관리</h2>
          <div style={{ marginTop: 4, fontSize: 13, color: 'var(--foreground-muted)' }}>
            총 {counts.all.toLocaleString()}건의 구독
            {counts.active > 0 ? ` · ${counts.active.toLocaleString()}건 진행중` : ''}
            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--foreground-subtle)' }}>
              운영 안전망 — next_delivery 편집만 (S188 minimal)
            </span>
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
              <th style={{ ...TH_STYLE, width: 100, textAlign: 'right' }}>액션</th>
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
                        disabled={s.status === 'cancelled' || s.status === 'expired'}
                        style={{
                          padding: '4px 10px',
                          fontSize: 12,
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 4,
                          cursor: s.status === 'cancelled' || s.status === 'expired' ? 'not-allowed' : 'pointer',
                          color: 'var(--foreground)',
                          opacity: s.status === 'cancelled' || s.status === 'expired' ? 0.5 : 1,
                        }}
                      >
                        다음 배송 변경
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

      {/* 편집 다이얼로그 */}
      {editingRow && (
        <EditNextDeliveryDialog
          row={editingRow}
          onClose={() => setEditingRow(null)}
          onSaved={() => {
            setEditingRow(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

/* ── 편집 다이얼로그 ─────────────────────────────────────────────────── */

type DialogProps = {
  row: ListedSubscription;
  onClose: () => void;
  onSaved: () => void;
};

function EditNextDeliveryDialog({ row, onClose, onSaved }: DialogProps) {
  const [dateValue, setDateValue] = useState(isoToDateInput(row.nextDeliveryAtIso));
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setSubmitError(null);
    startTransition(async () => {
      const result = await updateSubscriptionNextDeliveryAction({
        subscriptionId: row.id,
        nextDeliveryAt: dateValue,
      });
      if (result.ok) {
        onSaved();
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

  const userName = resolveUserName(row);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-next-delivery-title"
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
          width: 420,
          maxWidth: 'calc(100vw - 48px)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: 24,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.16)',
        }}
      >
        <h3 id="edit-next-delivery-title" style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 500 }}>
          다음 배송일 변경
        </h3>
        <div style={{ fontSize: 12, color: 'var(--foreground-muted)', marginBottom: 16 }}>
          {userName} · {row.productName}
          {row.productVolume ? ` (${row.productVolume})` : ''} · 주기 {describeCycle(row.cycle)}
        </div>

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
          }}
        />

        {submitError && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--destructive)' }}>{submitError}</div>
        )}

        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            style={{
              padding: '8px 14px',
              fontSize: 13,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              cursor: isPending ? 'not-allowed' : 'pointer',
              color: 'var(--foreground)',
            }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || dateValue === isoToDateInput(row.nextDeliveryAtIso)}
            style={{
              padding: '8px 14px',
              fontSize: 13,
              background: 'var(--primary)',
              border: 'none',
              borderRadius: 'var(--radius)',
              cursor: isPending ? 'not-allowed' : 'pointer',
              color: 'var(--primary-fg)',
              fontWeight: 500,
              opacity: isPending || dateValue === isoToDateInput(row.nextDeliveryAtIso) ? 0.5 : 1,
            }}
          >
            {isPending ? '저장중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
