/* ══════════════════════════════════════════════════════════════════════════
   AdminUserDetailPage (서버 컴포넌트) — S169 PR-2 Group C-2

   - params.id (uuid) → fetchAdminUserDetail
   - profile null → notFound()
   - 인터랙션은 UserDetailClient (역할 변경 모달은 PR-3 에서 추가)
   ══════════════════════════════════════════════════════════════════════════ */

import { notFound } from 'next/navigation';
import { fetchAdminUserDetail } from '@/lib/admin/usersServer';
import { getAdminClaims } from '@/lib/auth/getClaims';
import UserDetailClient from './UserDetailClient';

type PageProps = {
  params: Promise<{ id: string }>;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminUserDetailPage({ params }: PageProps) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const [detail, claims] = await Promise.all([
    fetchAdminUserDetail(id),
    getAdminClaims(),
  ]);
  if (!detail) notFound();

  return (
    <UserDetailClient
      profile={detail.profile}
      orders={detail.orders}
      audit={detail.audit}
      currentAdminId={claims?.userId ?? null}
      isOwner={claims?.adminLevel === 'owner'}
    />
  );
}
