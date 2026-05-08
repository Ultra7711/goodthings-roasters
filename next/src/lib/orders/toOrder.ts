/* ══════════════════════════════════════════
   toOrder — OrderRow (DB) → Order (UI) 변환 (S197 PR-2 §2.6 server prefetch 분리)
   기존 api/orders/route.ts 인라인 함수를 module 로 분리하여
   server component (mypage page.tsx) 도 동일 매퍼 사용 가능.
   ══════════════════════════════════════════ */

import type { OrderRow, OrderItemRow } from '@/lib/repositories/orderRepo';
import type { DbOrderStatus } from '@/types/db';
import type { Order, OrderItem, OrderStatus } from '@/types/order';
import { formatDateKST, formatPrice } from '@/lib/utils';

/* DB status → UI 한글 상태 매핑.
   pending 은 orderRepo 쿼리 단에서 제외 → 도달 불가. */
export function mapDbStatus(status: DbOrderStatus): OrderStatus {
  switch (status) {
    case 'paid':              return '배송준비';
    case 'shipping':          return '배송중';
    case 'delivered':         return '배송완료';
    case 'cancelled':         return '취소됨';
    case 'refund_requested':  return '환불요청';
    case 'refund_processing': return '환불중';
    case 'refunded':          return '환불완료';
    case 'pending':
      throw new Error(`mapDbStatus: 도달 불가 status='${status}' — orderRepo pending 필터 누락`);
  }
}

export function toOrder(row: OrderRow): Order {
  const items: OrderItem[] = (row.order_items ?? []).map((it: OrderItemRow) => ({
    name: it.product_name,
    slug: it.product_slug,
    category: it.product_category,
    volume: it.product_volume ?? '',
    qty: it.quantity,
    priceNum: it.unit_price,
    image: {
      src: it.product_image_src ?? '',
      bg: it.product_image_bg ?? '#ECEAE6',
    },
    type: it.item_type,
    period: it.subscription_period ?? null,
  }));

  const first = items[0];
  const name = first?.name ?? '';
  const detail =
    items.length > 1
      ? `${first?.volume ?? ''} 외 ${items.length - 1}건`
      : (first?.volume ?? '');

  const totalAmount = row.total_amount;

  return {
    number: row.order_number,
    date: formatDateKST(row.created_at),
    name,
    detail,
    price: formatPrice(totalAmount),
    priceNum: totalAmount,
    status: mapDbStatus(row.status),
    items,
  };
}
