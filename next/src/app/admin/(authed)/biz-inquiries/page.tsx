/* ══════════════════════════════════════════════════════════════════════════
   AdminBizInquiriesPage — /admin/biz-inquiries (S250-3)

   - admin (owner + staff) 접근
   - biz_inquiries 최근 200건 목록 + 확장 상세 + 상태 변경
   ══════════════════════════════════════════════════════════════════════════ */

import { redirect } from 'next/navigation';
import { getAdminClaims } from '@/lib/auth/getClaims';
import { fetchBizInquiries } from '@/lib/admin/bizInquiriesServer';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import BizInquiriesClient from './BizInquiriesClient';

export default async function AdminBizInquiriesPage() {
  const claims = await getAdminClaims();
  if (!claims) redirect('/admin/login');

  const rows = await fetchBizInquiries();
  const pendingCount = rows.filter((r) => r.status === 'pending').length;
  const contactedCount = rows.filter((r) => r.status === 'contacted').length;

  return (
    <div className="gtr-admin-page">
      <AdminPageHeader
        title="비즈 문의"
        subtitle={`최근 ${rows.length}건 · 신규 ${pendingCount} · 연락중 ${contactedCount}`}
      />
      <BizInquiriesClient rows={rows} />
    </div>
  );
}
