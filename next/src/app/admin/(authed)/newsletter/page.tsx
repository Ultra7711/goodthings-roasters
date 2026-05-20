/* ══════════════════════════════════════════════════════════════════════════
   AdminNewsletterPage — /admin/newsletter (S241 Phase 3)

   - admin (owner + staff) 접근
   - newsletter_subscribers 최근 200건 목록 표시
   - 페이지네이션 / 검색 / CSV export = carry (별도 sprint)
   ══════════════════════════════════════════════════════════════════════════ */

import { redirect } from 'next/navigation';
import { getAdminClaims } from '@/lib/auth/getClaims';
import { fetchNewsletterSubscribers } from '@/lib/admin/newsletterServer';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';

const SOURCE_LABEL: Record<string, string> = {
  newsletter_form: '메인 폼',
  signup_default: '회원 가입',
  admin: '관리자 추가',
  other: '기타',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default async function AdminNewsletterPage() {
  const claims = await getAdminClaims();
  if (!claims) redirect('/admin/login');

  const rows = await fetchNewsletterSubscribers();
  const activeCount = rows.filter((r) => r.status === 'active').length;
  const unsubscribedCount = rows.length - activeCount;

  return (
    <div className="gtr-admin-page">
      <AdminPageHeader
        title="뉴스레터 구독자"
        subtitle={`최근 ${rows.length}건 · 활성 ${activeCount} · 거부 ${unsubscribedCount}`}
      />

      <div className="border border-border rounded-md overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">이메일</th>
              <th className="px-4 py-3 font-medium">이름</th>
              <th className="px-4 py-3 font-medium">상태</th>
              <th className="px-4 py-3 font-medium">유입</th>
              <th className="px-4 py-3 font-medium">가입일</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                  구독자가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3">{r.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.userName ?? (r.userId ? '—' : <span className="italic">비회원</span>)}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === 'active' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">
                        활성
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-200 text-gray-700">
                        거부
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {SOURCE_LABEL[r.source] ?? r.source}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">
                    {formatDate(r.createdAtIso)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
