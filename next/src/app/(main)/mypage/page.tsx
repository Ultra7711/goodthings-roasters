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
import { requireAuth } from '@/lib/auth/getClaims';
/* ChipsPreview / Skeleton fallback 의 css 보장 (server component chunk 의존) */
import '@/components/auth/MyPagePage.css';
import '@/components/auth/mypage/NextDeliveryCard.css';
import '@/components/auth/mypage/RecentOrderCard.css';
import {
  findSubscriptionsForUser,
  toSubscription,
} from '@/lib/repositories/subscriptionRepo';
import {
  findOrdersForUser,
  getOrdersCountForUser,
} from '@/lib/repositories/orderRepo';
import { toOrder } from '@/lib/orders/toOrder';
import { fetchProducts } from '@/lib/productsServer';
import type { Subscription } from '@/types/subscription';
import type { Order } from '@/types/order';
import type { Product } from '@/lib/products';
import MyPagePage from '@/components/auth/MyPagePage';
import MyPageSkeleton from '@/components/auth/MyPageSkeleton';

export const metadata = { title: '마이 페이지 — good things' };

async function MyPageAuthed() {
  const claims = await requireAuth();

  /* S253 마이페이지 최적화 — server prefetch 축소:
     - orders: 20건 → 1건 (RecentOrderCard hero 1건만 사용 · OrderHistory 펼침은 client lazy)
     - ordersCount: count-only RPC (head:true · row payload 없음)

     S263 follow-up: 신규 사용자 (orders=0 + subs=0) 일 때만 showcase 상품 SSR 결정.
     WelcomeCard 가 mount 즉시 <Image placeholder=blur> 렌더 → 빈 영역 단계 제거.
     일반 사용자 prop=null (manual 'welcome' 클릭 케이스는 WelcomeCard 가 client fetch fallback). */
  const [subscriptions, heroOrders, ordersCount] = await Promise.all([
    findSubscriptionsForUser()
      .then((rows) => rows.map(toSubscription))
      .catch((err): Subscription[] => {
        console.error('[mypage.prefetch] subscriptions failed', err);
        return [];
      }),
    findOrdersForUser(1, 0)
      .then((rows) => rows.map(toOrder))
      .catch((err): Order[] => {
        console.error('[mypage.prefetch] hero order failed', err);
        return [];
      }),
    getOrdersCountForUser().catch((err): number => {
      console.error('[mypage.prefetch] orders count failed', err);
      return 0;
    }),
  ]);

  const isNewUser = subscriptions.length === 0 && ordersCount === 0;
  let showcaseProduct: Product | null = null;
  if (isNewUser) {
    try {
      const products = await fetchProducts();
      const pool = products.filter((p) => p.status !== '품절' && p.images.length > 0);
      if (pool.length > 0) {
        showcaseProduct = pool[Math.floor(Math.random() * pool.length)];
      }
    } catch (err) {
      console.error('[mypage.prefetch] showcase product failed', err);
    }
  }

  return (
    <MyPagePage
      initialClaims={claims}
      initialSubscriptions={subscriptions}
      initialHeroOrder={heroOrders[0] ?? null}
      initialOrdersCount={ordersCount}
      showcaseProduct={showcaseProduct}
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
