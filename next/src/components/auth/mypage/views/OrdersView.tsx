/* ══════════════════════════════════════════
   OrdersView — 주문내역 view (S197 PR-1.3.B)
   기존 OrderHistory 컴포넌트 wrap.
   ══════════════════════════════════════════ */

'use client';

import OrderHistory from '../OrderHistory';

export default function OrdersView() {
  return <OrderHistory />;
}
