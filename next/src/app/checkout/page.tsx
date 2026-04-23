/* ══════════════════════════════════════════
   Checkout Route — /checkout
   RP-7: 체크아웃 페이지 이식.
   - 자체 미니 헤더 사용 (사이트 헤더 미표시)
   - 장바구니 비어있으면 빈 상태 표시
   - P1-B: requireAuth() 서버 가드 (getClaims 기반 보안 경계)
   - 비회원 체크아웃(guest checkout) 은 Phase 3 에서 별도 분기 예정
   ══════════════════════════════════════════ */

import { requireAuth } from '@/lib/auth/getClaims';
import CheckoutPage from '@/components/checkout/CheckoutPage';

export const metadata = { title: '주문·결제 — good things' };

export default async function CheckoutRoute() {
  await requireAuth();
  return <CheckoutPage />;
}
