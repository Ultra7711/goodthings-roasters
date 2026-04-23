/* ══════════════════════════════════════════
   MyPage Route — /mypage
   RP-8: 마이페이지 이식.
   - 자체 미니 헤더 사용 (사이트 헤더 미표시)
   - P1-B: requireAuth() 서버 가드 (getClaims 기반 보안 경계)
   - useAuthGuard는 UX 보조용 (보안 경계 아님)
   ══════════════════════════════════════════ */

import { requireAuth } from '@/lib/auth/getClaims';
import MyPagePage from '@/components/auth/MyPagePage';

export const metadata = { title: '마이 페이지 — good things' };

export default async function MyPageRoute() {
  await requireAuth();
  return <MyPagePage />;
}
