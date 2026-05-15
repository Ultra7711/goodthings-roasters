/* ══════════════════════════════════════════════════════════════════════════
   AdminSubscriptionsPage (서버 컴포넌트) — S188 minimal (운영 안전망)

   - searchParams 로 q · status · page 수신
   - fetchAdminSubscriptions 가 RLS 통한 admin SELECT (044 subscriptions_select_admin)
   - 인터랙션은 SubscriptionsTableClient (client) 가 담당
   - 편집 범위 = next_delivery_at 만 (cycle BUG 같은 사고 시 GUI 복구)
   ══════════════════════════════════════════════════════════════════════════ */

import { getAdminClaims } from '@/lib/auth/getClaims';
import { fetchAdminSubscriptions } from '@/lib/admin/subscriptionsServer';
import SubscriptionsTableClient from './SubscriptionsTableClient';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminSubscriptionsPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const [result, claims] = await Promise.all([
    fetchAdminSubscriptions(raw),
    getAdminClaims(),
  ]);
  return (
    <SubscriptionsTableClient
      rows={result.rows}
      total={result.total}
      counts={result.counts}
      filters={result.filters}
      isOwner={claims?.adminLevel === 'owner'}
    />
  );
}
