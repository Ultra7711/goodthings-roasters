'use client';

/* ══════════════════════════════════════════
   DashboardActions — 시안 dashboard.jsx 의 actions prop 매칭.
   S222 PR-5: SM_BASE/SECONDARY/PRIMARY inline 폐기 → shadcn Button.
   ══════════════════════════════════════════ */

import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
import { Button } from '@/components/admin/ui/button';

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
  >
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </svg>
);

export default function DashboardActions() {
  return (
    <AdminTopbarActions>
      <Button type="button" variant="outline" size="sm" className="!h-7" disabled>
        <Download />
        리포트 내보내기
      </Button>
      <Button type="button" size="sm" className="!h-7" disabled>
        <Plus />
        주문 생성
      </Button>
    </AdminTopbarActions>
  );
}
