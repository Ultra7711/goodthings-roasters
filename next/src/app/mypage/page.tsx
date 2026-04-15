/* ══════════════════════════════════════════
   MyPage Route — /mypage
   RP-8: 마이페이지 이식.
   - 자체 미니 헤더 사용 (사이트 헤더 미표시)
   - P1-2: 서버 컴포넌트 getUser() 가드 (보안 경계)
   - useAuthGuard는 UX 보조용 (보안 경계 아님)
   ══════════════════════════════════════════ */

import { redirect } from 'next/navigation';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import MyPagePage from '@/components/auth/MyPagePage';

export const dynamic = 'force-dynamic'; // 인증 가드 — 캐시 없이 매 요청마다 서버 실행
export const metadata = { title: '마이 페이지 — good things' };

export default async function MyPageRoute() {
  /* P1-2: 서버사이드 인증 가드 — JWT 서명 검증
     getSession() 은 쿠키 복호화만 하므로 세션 탈취·조작에 취약.
     getUser() 는 Supabase 서버에 토큰 검증을 요청해 진정한 보안 경계를 형성한다. */
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <MyPagePage />;
}
