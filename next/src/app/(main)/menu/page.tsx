/* ══════════════════════════════════════════
   Cafe Menu Route — /menu
   RP-5 재이식: 프로토타입 #cafe-menu-page 이식.
   - URL query 로 초기 필터/타겟 복구 (`?cat=brewing&item=b04`)
   - SSR 안전: CafeMenuPage 는 클라이언트 컴포넌트 (useSearchParams)
   - useSearchParams 사용 컴포넌트는 Suspense 로 감싸 prerender CSR bailout 회피
   ══════════════════════════════════════════ */

import { Suspense } from 'react';
import CafeMenuPage from '@/components/cafe/CafeMenuPage';

export const metadata = { title: '카페 메뉴 — good things' };

export default function CafeMenuRoute() {
  return (
    <Suspense fallback={<div id="cm-body" />}>
      <CafeMenuPage />
    </Suspense>
  );
}
