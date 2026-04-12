/* ══════════════════════════════════════════
   MyPage Route — /mypage
   RP-8: 마이페이지 이식.
   - 자체 미니 헤더 사용 (사이트 헤더 미표시)
   - useAuthGuard로 미로그인 시 /login 리다이렉트
   ══════════════════════════════════════════ */

import MyPagePage from '@/components/auth/MyPagePage';

export const metadata = { title: '마이 페이지 — good things' };

export default function MyPageRoute() {
  return <MyPagePage />;
}
