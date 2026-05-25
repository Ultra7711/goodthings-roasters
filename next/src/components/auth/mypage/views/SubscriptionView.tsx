/* ══════════════════════════════════════════
   SubscriptionView — 정기배송 view (S197 PR-1.3.B)
   기존 SubscriptionEditor 컴포넌트 wrap.
   NextDeliveryCard 가 첫 항목을 별도 강조하므로, 본 view 는 전체 리스트.

   S282-P2: products lazy fetch — orders tab 사용자 90% dead fetch 회피.
   SubscriptionView mount 시점에만 server action 호출 (TanStack Query staleTime 60s cache).
   ══════════════════════════════════════════ */

'use client';

import { useQuery } from '@tanstack/react-query';
import SubscriptionEditor from '../SubscriptionEditor';
import { getMypageProductsAction } from '@/app/(main)/mypage/actions';
import type { Product } from '@/lib/products';

const MYPAGE_PRODUCTS_QUERY_KEY = ['mypage', 'products'] as const;

export default function SubscriptionView() {
  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: MYPAGE_PRODUCTS_QUERY_KEY,
    queryFn: getMypageProductsAction,
    staleTime: 60_000,
  });

  if (isLoading || !products) {
    /* S282-P2: 잔존 spinner — SubscriptionView 첫 진입 시만 (재진입 cache hit).
       data-loading=true → CSS pulse (1.4s cycle · prefers-reduced-motion 자동 비활성). */
    return (
      <div className="mp-empty-state" data-loading="true" style={{ minHeight: 300 }}>
        불러오는 중…
      </div>
    );
  }

  return <SubscriptionEditor products={products} />;
}
