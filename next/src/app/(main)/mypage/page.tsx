/* ══════════════════════════════════════════
   MyPage Route — /mypage  ((main) route group)
   S197 PR-2 §2.1: 자체 mypage layout 폐기 → (main) 셸 답습
   (noise + AnnouncementBar + SiteHeader + SiteFooter + ToastContainer 자동).
   light bg 는 MyPagePage 내부에서 OverscrollTop 으로 처리.

   BUG-006 Stage C (D-011, 2026-04-24):
   - cacheComponents 활성화로 requireAuth() → cookies() 접근이 Suspense
     경계 밖이면 빌드 에러. 인증 체크를 inner async 컴포넌트로 분리.
   ══════════════════════════════════════════ */

import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth/getClaims';
import MyPagePage from '@/components/auth/MyPagePage';
import MyPageSkeleton from '@/components/auth/MyPageSkeleton';

export const metadata = { title: '마이 페이지 — good things' };

async function MyPageAuthed() {
  const claims = await requireAuth();
  return <MyPagePage initialClaims={claims} />;
}

export default function MyPageRoute() {
  return (
    <Suspense fallback={<MyPageSkeleton />}>
      <MyPageAuthed />
    </Suspense>
  );
}
