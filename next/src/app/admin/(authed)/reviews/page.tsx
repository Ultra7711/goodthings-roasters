/* ══════════════════════════════════════════════════════════════════════════
   AdminReviewsPage — /admin/reviews (S314 Step 5)

   - owner-only (리뷰 모더레이션 · 계획 DEC) — staff/비admin 차단
   - reviews 목록(status·도메인 필터·검색·페이지네이션) + 상태 전이 + 영구삭제
   ══════════════════════════════════════════════════════════════════════════ */

import { redirect } from 'next/navigation';
import { getAdminOwnerClaims } from '@/lib/auth/getClaims';
import { fetchAdminReviews } from '@/lib/admin/reviewsServer';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import AdminReviewsClient from './AdminReviewsClient';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminReviewsPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const claims = await getAdminOwnerClaims();
  if (!claims) redirect('/admin/login');

  const result = await fetchAdminReviews(raw);

  return (
    <div className="gtr-admin-page">
      <AdminPageHeader
        title="리뷰 관리"
        subtitle={`전체 ${result.counts.all.toLocaleString()}건 · 검토대기 ${result.counts.pending} · 게재 ${result.counts.approved} · 차단 ${result.counts.blocked} · 삭제 ${result.counts.deleted}`}
      />
      <AdminReviewsClient
        rows={result.rows}
        total={result.total}
        counts={result.counts}
        filters={result.filters}
      />
    </div>
  );
}
