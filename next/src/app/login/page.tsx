/* ══════════════════════════════════════════
   Login Route — /login
   RP-8: 로그인 페이지 이식.
   - 자체 미니 헤더 사용 (사이�� 헤더 미표시)
   - ?from=checkout 파라미터로 체크아웃 복귀 분기
   ══════════════════════════════════════════ */

import { Suspense } from 'react';
import LoginPage from '@/components/auth/LoginPage';

export const metadata = { title: '로그인 — good things' };

export default function LoginRoute() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  );
}
