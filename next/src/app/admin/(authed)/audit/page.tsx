/* ══════════════════════════════════════════════════════════════════════════
   AdminAuditPage — /admin/audit (S233-fu Step 3)

   - owner 만 접근 (requireAdminOwnerOrRedirect)
   - admin_export_log + admin_audit 통합 타임라인 최근 100건 조회
   - 페이지네이션 / 도메인 필터 = carry (출시 후 운영 빈도 봐서 결정)
   ══════════════════════════════════════════════════════════════════════════ */

import { redirect } from 'next/navigation';
import { getAdminClaims } from '@/lib/auth/getClaims';
import { fetchAdminAuditEvents } from '@/lib/admin/auditServer';
import AuditTableClient from './AuditTableClient';

export default async function AdminAuditPage() {
  const claims = await getAdminClaims();
  if (!claims) redirect('/admin/login');
  /* owner 가드 — staff 는 접근 불가 */
  if (claims.adminLevel !== 'owner') redirect('/admin');

  const events = await fetchAdminAuditEvents();
  return <AuditTableClient events={events} />;
}
