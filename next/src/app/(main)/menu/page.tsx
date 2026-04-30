/* ══════════════════════════════════════════
   Cafe Menu Route — /menu
   RP-5 재이식: 프로토타입 #cafe-menu-page 이식.
   - URL query 로 초기 필터/타겟 복구 (`?cat=brewing&item=b04`)
   - SSR 안전: CafeMenuPage 는 클라이언트 컴포넌트 (useSearchParams)
   - useSearchParams 사용 컴포넌트는 Suspense 로 감싸 prerender CSR bailout 회피
   - Static (○) 라우트: likes 데이터는 클라이언트 마운트 후 fetch
     → /shop 과 동일 구조. Activity 보존으로 재진입 시 이미 메모리에 존재.
   ══════════════════════════════════════════ */

import { Suspense } from 'react';
import CafeMenuPage from '@/components/cafe/CafeMenuPage';
import CafeMenuSkeleton from '@/components/cafe/CafeMenuSkeleton';

export const metadata = { title: '카페 메뉴 — good things' };

export default function CafeMenuRoute() {
  return (
    <>
      {/* likes API 를 HTML 파싱 즉시 프리페치 — 카드 진입 연출(420ms) 이전에 데이터 도착 */}
      <link rel="preload" href="/api/menu-likes" as="fetch" crossOrigin="use-credentials" />
      <Suspense fallback={<CafeMenuSkeleton />}>
        <CafeMenuPage />
      </Suspense>
    </>
  );
}
