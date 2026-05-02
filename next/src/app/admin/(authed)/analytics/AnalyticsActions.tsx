'use client';

/* ══════════════════════════════════════════
   AnalyticsActions — 시안 empty.jsx actions slot.
   - 리포트 내보내기 (secondary, disabled — 데이터 부족)
   ══════════════════════════════════════════ */

import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';

export default function AnalyticsActions() {
  return (
    <AdminTopbarActions>
      <button
        type="button"
        disabled
        style={{
          padding: '5px 10px',
          fontSize: 12,
          height: 28,
          gap: 5,
          borderRadius: 6,
          fontWeight: 500,
          background: 'var(--surface)',
          color: 'var(--foreground)',
          border: '1px solid var(--border)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'not-allowed',
          whiteSpace: 'nowrap',
          letterSpacing: '-0.005em',
          opacity: 0.5,
        }}
      >
        리포트 내보내기
      </button>
    </AdminTopbarActions>
  );
}
