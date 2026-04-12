/* ══════════════════════════════════════════
   Checkout Route — /checkout
   RP-7: 체크아웃 페이지 이식.
   - 자체 미니 헤더 사용 (사이트 헤더 미표시)
   - 장바구니 비어있으면 빈 상태 표시
   ══════════════════════════════════════════ */

import CheckoutPage from '@/components/checkout/CheckoutPage';

export const metadata = { title: '주문·결제 — good things' };

export default function CheckoutRoute() {
  return <CheckoutPage />;
}
