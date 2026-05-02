'use client';

/* ══════════════════════════════════════════
   AdminOrdersPage — 시안 orders.jsx 풀 이식 (S126).
   - 상태 탭 + 검색·필터 + 데이터 테이블 + 페이지네이션
   - 데이터는 mock fixture. 실 API 연결은 Group B 백엔드 단계.
   ══════════════════════════════════════════ */

import { useState } from 'react';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';

type StatusKey = 'new' | 'process' | 'ship' | 'done' | 'cancel';
type Tone = 'primary' | 'warning' | 'info' | 'success' | 'neutral';

type Order = {
  id: string;
  date: string;
  customer: string;
  email: string;
  items: string;
  amount: number;
  status: [StatusKey, string];
  pay: string;
};

const TABS = [
  { id: 'all', label: '전체', count: 218 },
  { id: 'new', label: '신규', count: 12 },
  { id: 'process', label: '준비중', count: 18 },
  { id: 'ship', label: '배송중', count: 34 },
  { id: 'done', label: '완료', count: 152 },
  { id: 'cancel', label: '취소', count: 2 },
] as const;

const ORDERS: Order[] = [
  { id: 'GT-24851', date: '2026.05.02 14:23', customer: '김민지', email: 'minji.k@gmail.com', items: '에티오피아 예가체프 200g', amount: 18000, status: ['new', '신규'], pay: '카드' },
  { id: 'GT-24850', date: '2026.05.02 14:14', customer: '박서연', email: 'seoyeon@kakao.com', items: '하우스 블렌드 500g · 정기', amount: 32000, status: ['process', '준비중'], pay: '정기결제' },
  { id: 'GT-24849', date: '2026.05.02 13:30', customer: '이도윤', email: 'doyoon.lee@naver.com', items: '콜롬비아 핑크버번 200g × 2', amount: 42000, status: ['ship', '배송중'], pay: '카드' },
  { id: 'GT-24848', date: '2026.05.02 11:42', customer: '최유진', email: 'yujin.choi@gmail.com', items: '드립백 12개입 선물세트', amount: 28000, status: ['done', '완료'], pay: '카카오페이' },
  { id: 'GT-24847', date: '2026.05.02 10:51', customer: '정현수', email: 'hyunsoo@naver.com', items: '케냐 AA 200g', amount: 22000, status: ['done', '완료'], pay: '카드' },
  { id: 'GT-24846', date: '2026.05.02 09:18', customer: '강윤서', email: 'yunseo.k@gmail.com', items: '에티오피아 예가체프 200g · 콜롬비아 200g', amount: 40000, status: ['process', '준비중'], pay: '네이버페이' },
  { id: 'GT-24845', date: '2026.05.01 22:04', customer: '한지우', email: 'jiwoo.han@gmail.com', items: '드립백 6개입', amount: 14000, status: ['done', '완료'], pay: '카드' },
  { id: 'GT-24844', date: '2026.05.01 20:50', customer: '윤소영', email: 'soyoung.y@kakao.com', items: '하우스 블렌드 1kg', amount: 58000, status: ['ship', '배송중'], pay: '토스페이' },
  { id: 'GT-24843', date: '2026.05.01 18:32', customer: '오재훈', email: 'jaehoon.oh@gmail.com', items: '코스타리카 게이샤 100g', amount: 36000, status: ['cancel', '취소'], pay: '카드' },
  { id: 'GT-24842', date: '2026.05.01 17:09', customer: '신예린', email: 'yerin.shin@naver.com', items: '에스프레소 블렌드 500g · 정기', amount: 32000, status: ['done', '완료'], pay: '정기결제' },
];

const STATUS_TONE: Record<StatusKey, Tone> = {
  new: 'primary',
  process: 'warning',
  ship: 'info',
  done: 'success',
  cancel: 'neutral',
};

const TONES: Record<Tone, { bg: string; fg: string; dot: string }> = {
  neutral: { bg: 'var(--neutral-soft)', fg: 'var(--neutral-soft-fg)', dot: '#888' },
  success: { bg: 'var(--success-soft)', fg: 'var(--success)', dot: 'var(--success)' },
  warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)', dot: 'var(--warning)' },
  info: { bg: 'var(--info-soft)', fg: 'var(--info)', dot: 'var(--info)' },
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

export default function AdminOrdersPage() {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selected, setSelected] = useState<string[]>(['GT-24850']);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  const allSelected = selected.length === ORDERS.length;
  const indeterminate = selected.length > 0 && !allSelected;

  function toggleAll() {
    setSelected(allSelected ? [] : ORDERS.map((o) => o.id));
  }

  return (
    <>
      <AdminTopbarActions>
        <button type="button" style={SM_SECONDARY}>
          <Download />
          CSV 내보내기
        </button>
        <button type="button" style={SM_PRIMARY}>
          <Plus />
          주문 생성
        </button>
      </AdminTopbarActions>

      {/* 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 18,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontFamily: 'var(--font-serif)',
              fontSize: 24,
              fontWeight: 500,
              letterSpacing: '-0.02em',
            }}
          >
            주문 관리
          </h2>
          <div style={{ marginTop: 4, fontSize: 13, color: 'var(--foreground-muted)' }}>
            총 218건의 주문 · 12건 처리 대기
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: '1px solid var(--border)',
          marginBottom: 16,
        }}
      >
        {TABS.map((t) => {
          const active = t.id === activeTab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '8px 14px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                color: active ? 'var(--foreground)' : 'var(--foreground-muted)',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
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
                {t.count}
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
            </button>
          );
        })}
      </div>

      {/* 필터 바 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <SearchInput placeholder="주문번호, 고객명, 이메일로 검색…" />
        <FilterButton label="기간" hasIcon />
        <FilterButton label="결제수단" />
        <FilterButton label="상태" />
        <div style={{ flex: 1 }} />
        {selected.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 10px',
              height: 28,
              borderRadius: 6,
              background: 'var(--primary-soft)',
              color: 'var(--primary-soft-fg)',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            <span>{selected.length}건 선택됨</span>
            <span
              aria-hidden
              style={{ width: 1, height: 14, background: 'currentColor', opacity: 0.2 }}
            />
            <a style={{ cursor: 'pointer' }}>일괄 처리</a>
            <a style={{ cursor: 'pointer' }}>송장 발급</a>
          </div>
        )}
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
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface-muted)', color: 'var(--foreground-muted)' }}>
              <th style={{ ...TH_STYLE, width: 36 }}>
                <button
                  type="button"
                  onClick={toggleAll}
                  aria-label={allSelected ? '전체 선택 해제' : '전체 선택'}
                  style={{ all: 'unset', cursor: 'pointer', display: 'inline-flex' }}
                >
                  <CheckBox checked={allSelected} indeterminate={indeterminate} />
                </button>
              </th>
              <th style={TH_STYLE}>주문번호</th>
              <th style={TH_STYLE}>주문일시</th>
              <th style={TH_STYLE}>고객</th>
              <th style={TH_STYLE}>상품</th>
              <th style={{ ...TH_STYLE, textAlign: 'right' }}>금액</th>
              <th style={TH_STYLE}>결제</th>
              <th style={TH_STYLE}>상태</th>
              <th style={{ ...TH_STYLE, width: 36 }} aria-label="actions" />
            </tr>
          </thead>
          <tbody>
            {ORDERS.map((o, i) => {
              const sel = selected.includes(o.id);
              return (
                <tr
                  key={o.id}
                  style={{
                    borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                    background: sel ? 'var(--primary-soft)' : 'transparent',
                  }}
                >
                  <td style={TD_STYLE}>
                    <button
                      type="button"
                      onClick={() => toggle(o.id)}
                      aria-label={sel ? `${o.id} 선택 해제` : `${o.id} 선택`}
                      style={{ all: 'unset', cursor: 'pointer', display: 'inline-flex' }}
                    >
                      <CheckBox checked={sel} />
                    </button>
                  </td>
                  <td style={TD_STYLE}>
                    <span
                      className="gtr-mono"
                      style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 500 }}
                    >
                      {o.id}
                    </span>
                  </td>
                  <td
                    style={{
                      ...TD_STYLE,
                      color: 'var(--foreground-muted)',
                      fontSize: 12,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {o.date}
                  </td>
                  <td style={TD_STYLE}>
                    <div style={{ fontWeight: 500 }}>{o.customer}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--foreground-subtle)' }}>{o.email}</div>
                  </td>
                  <td
                    style={{
                      ...TD_STYLE,
                      color: 'var(--foreground-muted)',
                      maxWidth: 280,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {o.items}
                  </td>
                  <td
                    style={{
                      ...TD_STYLE,
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 500,
                    }}
                  >
                    ₩{o.amount.toLocaleString()}
                  </td>
                  <td
                    style={{ ...TD_STYLE, fontSize: 12, color: 'var(--foreground-muted)' }}
                  >
                    {o.pay}
                  </td>
                  <td style={TD_STYLE}>
                    <Badge tone={STATUS_TONE[o.status[0]]} dot>
                      {o.status[1]}
                    </Badge>
                  </td>
                  <td style={TD_STYLE}>
                    <button
                      type="button"
                      aria-label={`${o.id} 추가 작업`}
                      style={{
                        width: 26,
                        height: 26,
                        border: 'none',
                        background: 'transparent',
                        borderRadius: 4,
                        color: 'var(--foreground-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <MoreIcon />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* 페이지네이션 */}
        <div
          style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12.5,
            color: 'var(--foreground-muted)',
          }}
        >
          <div>1 — 10 / 218건</div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <PageButton disabled>‹‹</PageButton>
            <PageButton disabled>‹</PageButton>
            <PageButton active>1</PageButton>
            <PageButton>2</PageButton>
            <PageButton>3</PageButton>
            <PageButton>…</PageButton>
            <PageButton>22</PageButton>
            <PageButton>›</PageButton>
            <PageButton>››</PageButton>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── 로컬 컴포넌트 ─────────────────────────────────── */

function CheckBox({ checked, indeterminate }: { checked: boolean; indeterminate?: boolean }) {
  const filled = checked || indeterminate;
  return (
    <span
      aria-hidden
      style={{
        width: 16,
        height: 16,
        borderRadius: 4,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: filled ? '1px solid var(--primary)' : '1px solid var(--border-strong)',
        background: filled ? 'var(--primary)' : 'var(--surface)',
      }}
    >
      {checked && (
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
      {indeterminate && !checked && (
        <span style={{ width: 8, height: 1.6, background: '#fff' }} />
      )}
    </span>
  );
}

function PageButton({
  children,
  active,
  disabled,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      style={{
        minWidth: 26,
        height: 26,
        padding: '0 6px',
        border: '1px solid ' + (active ? 'var(--primary)' : 'var(--border)'),
        borderRadius: 5,
        background: active ? 'var(--primary)' : 'var(--surface)',
        color: active ? '#fff' : disabled ? 'var(--foreground-subtle)' : 'var(--foreground)',
        fontSize: 12,
        fontWeight: active ? 500 : 400,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {children}
    </button>
  );
}

function Badge({
  tone,
  children,
  dot,
}: {
  tone: Tone;
  children: React.ReactNode;
  dot?: boolean;
}) {
  const t = TONES[tone];
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
      {dot && (
        <span
          aria-hidden
          style={{ width: 5, height: 5, borderRadius: 999, background: t.dot }}
        />
      )}
      {children}
    </span>
  );
}

function SearchInput({ placeholder }: { placeholder: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 10px',
        height: 34,
        background: 'var(--surface)',
        border: '1px solid var(--input)',
        borderRadius: 6,
        flex: 1,
        maxWidth: 360,
      }}
    >
      <span style={{ color: 'var(--foreground-subtle)', display: 'flex' }}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </span>
      <input
        type="search"
        placeholder={placeholder}
        style={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 13,
          color: 'var(--foreground)',
          padding: 0,
          height: '100%',
        }}
      />
    </div>
  );
}

function FilterButton({ label, hasIcon }: { label: string; hasIcon?: boolean }) {
  return (
    <button type="button" style={SM_SECONDARY}>
      {hasIcon && (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ marginRight: 6 }}
        >
          <path d="M3 6h18" />
          <path d="M7 12h10" />
          <path d="M10 18h4" />
        </svg>
      )}
      {label}
      <ChevronDown />
    </button>
  );
}

/* ── 인라인 SVG ─────────────────────────────────── */

const Plus = () => (
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
);

const Download = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ marginRight: 6 }}
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 10l5 5 5-5" />
    <path d="M12 15V3" />
  </svg>
);

const ChevronDown = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ marginLeft: 6, opacity: 0.6 }}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const MoreIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="19" r="1" />
  </svg>
);

/* ── 시안 Button(size=sm) inline style ─────────────────────────────────── */

const SM_BASE: React.CSSProperties = {
  padding: '5px 10px',
  fontSize: 12,
  height: 28,
  gap: 5,
  borderRadius: 6,
  fontWeight: 500,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  letterSpacing: '-0.005em',
};

const SM_SECONDARY: React.CSSProperties = {
  ...SM_BASE,
  background: 'var(--surface)',
  color: 'var(--foreground)',
  border: '1px solid var(--border)',
};

const SM_PRIMARY: React.CSSProperties = {
  ...SM_BASE,
  background: 'var(--primary)',
  color: '#fff',
  border: '1px solid var(--primary)',
};
