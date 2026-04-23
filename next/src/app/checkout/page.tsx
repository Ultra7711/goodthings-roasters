/* ══════════════════════════════════════════
   Checkout Route — /checkout
   RP-7: 체크아웃 페이지 이식.
   - 자체 미니 헤더 사용 (사이트 헤더 미표시)
   - 장바구니 비어있으면 빈 상태 표시
   - 비회원 체크아웃 허용 (2026-04-23) — CheckoutPage 에 게스트 PIN·email 분기
     이미 구현되어 있고, /api/orders 도 userId null 을 game/guest 주문으로 처리.
     기존에 requireAuth() 로 강제 로그인 redirect 하던 가드는 제거.
     · 로그인 유도는 CheckoutPage 내부의 "로그인" Link (?from=checkout 포함)
     · 보안 경계는 Route Handler (POST /api/orders) 에서 CSRF/RateLimit/guest
       PIN 검증으로 유지
   ══════════════════════════════════════════ */

import CheckoutPage from '@/components/checkout/CheckoutPage';

export const metadata = { title: '주문·결제 — good things' };

export default function CheckoutRoute() {
  return <CheckoutPage />;
}
