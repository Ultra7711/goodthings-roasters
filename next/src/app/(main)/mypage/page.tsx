/* ══════════════════════════════════════════
   MyPage Route — /mypage  ((main) route group · S197 PR-2 §2.6 server prefetch)
   - requireAuth() + subscriptions + orders 를 server 단계에서 prefetch.
   - MyPagePage 에 initialSubscriptions / initialOrders props 전달 →
     TanStack Query initialData 로 SSR HTML 이 정확한 카드 즉시 렌더 (flash 차단).
   - prefetch 실패 시 빈 array fallback (UI 는 client fetch 로 복구).

   BUG-006 Stage C (D-011, 2026-04-24):
   - cacheComponents 활성화로 requireAuth() → cookies() 접근이 Suspense
     경계 밖이면 빌드 에러. 인증 + db fetch 를 inner async 컴포넌트로 분리.
   ══════════════════════════════════════════ */

import { Suspense } from 'react';
import { requireAuth, getAdminClaims, type AdminLevel } from '@/lib/auth/getClaims';
/* Skeleton fallback / ChipsPreview 의 css 보장 (server component chunk 의존) */
import '@/components/auth/MyPagePage.css';
import {
  findSubscriptionsForUser,
  toSubscription,
} from '@/lib/repositories/subscriptionRepo';
import { findOrdersForUser, getOrdersCountForUser } from '@/lib/repositories/orderRepo';
import { toOrder } from '@/lib/orders/toOrder';
import { getNewsletterStatus, type NewsletterStatusResult } from '@/lib/newsletter';
import type { Subscription } from '@/types/subscription';
import type { Order } from '@/types/order';
import MyPagePage from '@/components/auth/MyPagePage';
import MyPageSkeleton from '@/components/auth/MyPageSkeleton';

/* S282-P1: orders SSR prefetch limit — default tab=orders 첫 진입 시 client fetch spinner 폐기.
   대부분 사용자가 최신 주문만 조회 (페이지네이션 별도) → 20건 권고 (DEC-S282-1). */
const ORDERS_SSR_LIMIT = 20;

export const metadata = { title: '마이 페이지' };

async function MyPageAuthed() {
  const claims = await requireAuth();

  /* S253 + S282-P1/P2 마이페이지 최적화 — server prefetch:
     - subscriptions: 전체 (TanStack initialData · flash 차단)
     - orders: limit 20 (DEC-S282-1) — default tab=orders 첫 진입 시 client fetch spinner 폐기
     - ordersCount: count-only RPC (HeroGreeting + SideNav 카운트)
     - adminLevel: admin 인 경우 'owner' | 'staff' (HeroGreeting 라벨)
     - products: S282-P2 — SubscriptionView lazy fetch (server action) · 90% dead fetch 회피. */
  const [subscriptions, orders, ordersCount, adminClaims, newsletterStatus] = await Promise.all([
    findSubscriptionsForUser()
      .then((rows) => rows.map(toSubscription))
      .catch((err): Subscription[] => {
        console.error('[mypage.prefetch] subscriptions failed', err);
        return [];
      }),
    findOrdersForUser(ORDERS_SSR_LIMIT)
      .then((rows) => rows.map(toOrder))
      .catch((err): Order[] => {
        console.error('[mypage.prefetch] orders failed', err);
        return [];
      }),
    getOrdersCountForUser().catch((err): number => {
      console.error('[mypage.prefetch] orders count failed', err);
      return 0;
    }),
    getAdminClaims().catch((err): null => {
      console.error('[mypage.prefetch] admin claims failed', err);
      return null;
    }),
    /* S283: newsletter status SSR prefetch — ProfileView 진입 시 client fetch "불러오는 중…" 폐기.
       view 전환마다 remount → useEffect 재발화 → 매번 fetch UX 어색함 회피. */
    getNewsletterStatus().catch((err): NewsletterStatusResult => {
      console.error('[mypage.prefetch] newsletter status failed', err);
      return { ok: false, error: 'db_error' };
    }),
  ]);

  const adminLevel: AdminLevel | null = adminClaims?.adminLevel ?? null;

  return (
    <MyPagePage
      initialClaims={claims}
      initialSubscriptions={subscriptions}
      initialOrders={orders}
      initialOrdersCount={ordersCount}
      adminLevel={adminLevel}
      initialNewsletterStatus={newsletterStatus}
    />
  );
}

type SearchParams = { _skeleton?: string; _chips?: string };

const ALL_ORDER_STATUSES = [
  '배송준비',
  '배송중',
  '배송완료',
  '취소됨',
  '환불요청',
  '환불중',
  '환불완료',
] as const;

const STATUS_CLASS: Record<typeof ALL_ORDER_STATUSES[number], string> = {
  배송준비: 'mp-recent-status--prep',
  배송중: 'mp-recent-status--shipping',
  배송완료: 'mp-recent-status--delivered',
  취소됨: 'mp-recent-status--cancelled',
  환불요청: 'mp-recent-status--refund-req',
  환불중: 'mp-recent-status--refund-proc',
  환불완료: 'mp-recent-status--refunded',
};

function ChipsPreview() {
  return (
    <div style={{ padding: '100px 60px', display: 'flex', flexDirection: 'column', gap: 32 }}>
      <h1>Chip Preview — sand 패널 (mp-recent-status)</h1>
      <section
        className="mp-next-card"
        aria-label="sand 컨텍스트"
        style={{ display: 'block', padding: 32 }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {ALL_ORDER_STATUSES.map((status) => (
            <span
              key={status}
              className={`mp-recent-status ${STATUS_CLASS[status]}`}
            >
              {status}
            </span>
          ))}
        </div>
      </section>

      <h1>Chip Preview — light 페이지 (mp-order-status)</h1>
      <section style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {ALL_ORDER_STATUSES.map((status) => (
          <span
            key={status}
            className={`mp-order-status ${STATUS_CLASS[status].replace('mp-recent-status', 'mp-order-status')}`}
          >
            {status}
          </span>
        ))}
      </section>
    </div>
  );
}

export default async function MyPageRoute({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  /* dev-only: ?_skeleton=1 로 Skeleton 영구 노출 (단차 진단) */
  if (process.env.NODE_ENV === 'development' && params._skeleton) {
    return <MyPageSkeleton />;
  }
  /* dev-only: ?_chips=1 로 7 개 칩 모두 sand / light 컨텍스트 한 화면 비교 */
  if (process.env.NODE_ENV === 'development' && params._chips) {
    return <ChipsPreview />;
  }

  return (
    <Suspense fallback={<MyPageSkeleton />}>
      <MyPageAuthed />
    </Suspense>
  );
}
