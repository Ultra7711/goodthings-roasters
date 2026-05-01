'use client';

/* ══════════════════════════════════════════
   DashboardActions — 시안 dashboard.jsx 의 actions prop 매칭.
   - 리포트 내보내기 (secondary, download icon)
   - 주문 생성 (primary, plus icon)
   - AdminTopbarActions (Topbar slot portal) 로 inject.
   ══════════════════════════════════════════ */

import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';

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

/* 시안 Button(size=sm) inline style — sm: padding 5px 10px, fontSize 12, height 28, gap 5 */
const SM_BASE = {
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
  whiteSpace: 'nowrap' as const,
  letterSpacing: '-0.005em',
};

const SECONDARY = {
  ...SM_BASE,
  background: 'var(--surface)',
  color: 'var(--foreground)',
  border: '1px solid var(--border)',
};

const PRIMARY = {
  ...SM_BASE,
  background: 'var(--primary)',
  color: '#fff',
  border: '1px solid var(--primary)',
};

export default function DashboardActions() {
  return (
    <AdminTopbarActions>
      <button type="button" style={SECONDARY} disabled>
        <Download />
        리포트 내보내기
      </button>
      <button type="button" style={PRIMARY} disabled>
        <Plus />
        주문 생성
      </button>
    </AdminTopbarActions>
  );
}
