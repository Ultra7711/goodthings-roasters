/* ══════════════════════════════════════════
   SubscriptionView — 정기배송 view (S197 PR-1.3.B)
   기존 SubscriptionEditor 컴포넌트 wrap.
   NextDeliveryCard 가 첫 항목을 별도 강조하므로, 본 view 는 전체 리스트.
   S267: products prop 전파 — SubscriptionItem 아코디언 카드 표시용.
   ══════════════════════════════════════════ */

'use client';

import type { Product } from '@/lib/products';
import SubscriptionEditor from '../SubscriptionEditor';

type Props = {
  products: Product[];
};

export default function SubscriptionView({ products }: Props) {
  return <SubscriptionEditor products={products} />;
}
