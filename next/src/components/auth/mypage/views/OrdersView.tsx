/* ══════════════════════════════════════════
   OrdersView — 주문내역 view (S197 PR-1.3.B · S282-P1 initialOrders 전달)
   기존 OrderHistory 컴포넌트 wrap.
   ══════════════════════════════════════════ */

'use client';

import OrderHistory from '../OrderHistory';
import type { Order } from '@/types/order';

type OrdersViewProps = {
  /** S282-P1: SSR prefetch initialOrders → useOrdersQuery initialData. client fetch spinner 폐기. */
  initialOrders: Order[];
};

export default function OrdersView({ initialOrders }: OrdersViewProps) {
  return <OrderHistory initialOrders={initialOrders} />;
}
