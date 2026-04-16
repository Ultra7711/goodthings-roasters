/* ══════════════════════════════════════════
   Order Complete Route — /order-complete
   RP-7: 주문완료 페이지 이식.
   - 자체 미니 헤더 사용 (사이트 헤더 미표시)
   - sessionStorage 에서 주문 정보 읽기
   ══════════════════════════════════════════ */

import OrderCompletePage from '@/components/checkout/OrderCompletePage';

/* Toss 결제위젯 successUrl 쿼리 파라미터(paymentKey/orderId/amount) 를
   useSearchParams 로 수신 — 정적 프리렌더 불가. */
export const dynamic = 'force-dynamic';
export const metadata = { title: '주문 완료 — good things' };

export default function OrderCompleteRoute() {
  return <OrderCompletePage />;
}
