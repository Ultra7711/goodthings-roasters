/* ══════════════════════════════════════════
   AdminOrdersPage (서버 컴포넌트)
   - searchParams 로 status·period·payment·q·page 수신
   - fetchAdminOrders 가 RLS 통한 admin SELECT + 탭 카운트 RPC 동시 수행
   - 인터랙션은 OrdersTableClient (client) 가 담당
   ══════════════════════════════════════════ */

import { getAdminClaims } from '@/lib/auth/getClaims';
import { fetchAdminOrders } from '@/lib/admin/ordersServer';
import OrdersTableClient from './OrdersTableClient';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const [result, claims] = await Promise.all([
    fetchAdminOrders(raw),
    getAdminClaims(),
  ]);
  return (
    <OrdersTableClient
      rows={result.rows}
      total={result.total}
      counts={result.counts}
      filters={result.filters}
      isOwner={claims?.adminLevel === 'owner'}
    />
  );
}
