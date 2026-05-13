'use client';

/* ══════════════════════════════════════════
   AnalyticsActions — 시안 empty.jsx actions slot.
   - 리포트 내보내기 (secondary, disabled — 데이터 부족)
   ══════════════════════════════════════════ */

import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
import { Button } from '@/components/admin/ui/button';

export default function AnalyticsActions() {
  return (
    <AdminTopbarActions>
      <Button type="button" variant="outline" size="sm" className="!h-7" disabled>
        리포트 내보내기
      </Button>
    </AdminTopbarActions>
  );
}
