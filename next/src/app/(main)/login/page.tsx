/* ══════════════════════════════════════════
   Login Route — /login
   RP-8: 로그인 페이지 이식.
   - (main) route group → AnnouncementBar(dark) + SiteHeader + SiteFooter(stone) 공통
   - ?from=checkout 파라미터로 체크아웃 복귀 분기

   BUG-165 (S88): OverscrollTop 제거. 이전에 top=bottom=#FBF8F3 로 오버라이드
   했으나 (main) 의 dark announcement / stone footer 와 시각 단절 발생.
   기본값(top=#1E1B16, bottom=#4A4845)이 announcement/footer 와 정확히 매치
   되도록 설계되어 있어 다른 (main) 페이지처럼 OverscrollTop 미사용으로 통일.
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
