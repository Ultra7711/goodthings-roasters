/* ══════════════════════════════════════════════════════════════════════════
   AdminBizInquiriesPage — /admin/biz-inquiries (S250-3 · S304)

   - admin (owner + staff) 접근
   - biz_inquiries 목록(상태필터·검색·페이지네이션) + 확장 상세 + 상태 변경
   ══════════════════════════════════════════════════════════════════════════ */

import { redirect } from 'next/navigation';
import { getAdminClaims } from '@/lib/auth/getClaims';
import { fetchBizInquiries } from '@/lib/admin/bizInquiriesServer';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import BizInquiriesClient from './BizInquiriesClient';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminBizInquiriesPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const claims = await getAdminClaims();
  if (!claims) redirect('/admin/login');

  const result = await fetchBizInquiries(raw);

  return (
    <div className="gtr-admin-page">
      <AdminPageHeader
        title="비즈 문의"
        subtitle={`전체 ${result.counts.all.toLocaleString()}건 · 신규 ${result.counts.pending} · 연락중 ${result.counts.contacted} · 종결 ${result.counts.closed}`}
      />
      <BizInquiriesClient
        rows={result.rows}
        total={result.total}
        counts={result.counts}
        filters={result.filters}
      />
    </div>
  );
}
