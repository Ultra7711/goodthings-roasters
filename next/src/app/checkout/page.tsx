/* ══════════════════════════════════════════
   Checkout Route — /checkout
   RP-7: 체크아웃 페이지 이식.
   - 자체 미니 헤더 사용 (사이트 헤더 미표시)
   - 장바구니 비어있으면 빈 상태 표시
   - P1-2: 서버 컴포넌트 getUser() 가드 (보안 경계)
   ══════════════════════════════════════════ */

import { redirect } from 'next/navigation';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import CheckoutPage from '@/components/checkout/CheckoutPage';

export const dynamic = 'force-dynamic'; // 인증 가드 — 캐시 없이 매 요청마다 서버 실행
export const metadata = { title: '주문·결제 — good things' };

export default async function CheckoutRoute() {
  /* P1-2: 서버사이드 인증 가드 — JWT 서명 검증
     getSession() 대신 getUser() 사용 (Supabase 서버 토큰 검증).
     비회원 체크아웃(guest checkout) 플로우는 향후 Phase 3에서 별도 분기 예정. */
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <CheckoutPage />;
}
