/* ══════════════════════════════════════════
   MyPage Route — /mypage
   RP-8: 마이페이지 이식.
   - 자체 미니 헤더 사용 (사이트 헤더 미표시)
   - P1-B: requireAuth() 서버 가드 (getClaims 기반 보안 경계)
   - useAuthGuard는 UX 보조용 (보안 경계 아님)

   BUG-006 Stage C (D-011, 2026-04-24):
   - cacheComponents 활성화로 requireAuth() → cookies() 접근이 Suspense
     경계 밖이면 빌드 에러. 인증 체크를 inner async 컴포넌트로 분리.
   ══════════════════════════════════════════ */

import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth/getClaims';
import MyPagePage from '@/components/auth/MyPagePage';

export const metadata = { title: '마이 페이지 — good things' };

async function MyPageAuthed() {
  await requireAuth();
  return <MyPagePage />;
}

export default function MyPageRoute() {
  return (
    <Suspense fallback={<div className="mp-page" style={{ minHeight: '100dvh' }} />}>
      <MyPageAuthed />
    </Suspense>
  );
}
