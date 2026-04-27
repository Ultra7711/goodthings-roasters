/* ══════════════════════════════════════════
   MyPage Route — /mypage
   RP-8: 마이페이지 이식.
   - 자체 미니 헤더 사용 (사이트 헤더 미표시)
   - P1-B: requireAuth() 서버 가드 (getClaims 기반 보안 경계)
   - useAuthGuard는 UX 보조용 (보안 경계 아님)

   BUG-006 Stage C (D-011, 2026-04-24):
   - cacheComponents 활성화로 requireAuth() → cookies() 접근이 Suspense
     경계 밖이면 빌드 에러. 인증 체크를 inner async 컴포넌트로 분리.

   BUG-168 (S89, 2026-04-27):
   - Fix A: Suspense fallback 을 빈 div 에서 MyPagePlaceholder 로 교체
     → 백지 시간 동안 헤더 + 본문 placeholder 즉시 표시 (체감 속도 개선).
   - Fix C: requireAuth() claims 를 MyPagePage initialClaims prop 으로 전달
     → SSR 단계에서 사용자 데이터 즉시 사용 가능, hydration 깜빡임 제거.
   ══════════════════════════════════════════ */

import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth/getClaims';
import MyPagePage from '@/components/auth/MyPagePage';
import MyPagePlaceholder from '@/components/auth/MyPagePlaceholder';

export const metadata = { title: '마이 페이지 — good things' };

async function MyPageAuthed() {
  const claims = await requireAuth();
  return <MyPagePage initialClaims={claims} />;
}

export default function MyPageRoute() {
  return (
    <Suspense fallback={<MyPagePlaceholder />}>
      <MyPageAuthed />
    </Suspense>
  );
}
