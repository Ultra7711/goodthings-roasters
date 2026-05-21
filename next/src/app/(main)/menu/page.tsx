/* ══════════════════════════════════════════
   Cafe Menu Route — /menu
   RP-5 재이식 + S245-P20 SSR likes hydration.

   - URL query 로 초기 필터/타겟 복구 (`?cat=brewing&item=b04`)
   - SSR 안전: CafeMenuPage 는 클라이언트 컴포넌트 (useSearchParams)
   - useSearchParams 사용 컴포넌트는 Suspense 로 감싸 prerender CSR bailout 회피
   - S245-P20: likes snapshot 도 SSR 시점에 prefetch → CafeMenuPage 가 hydrate
     하여 첫 렌더부터 popular 정렬 + count 완성. client fetch /api/menu-likes
     자동 호출 폐기 (점프 제거).
   ══════════════════════════════════════════ */

import { Suspense } from 'react';
import { fetchCafeMenu } from '@/lib/cafeMenuServer';
import { fetchMenuLikesSnapshot } from '@/lib/menuLikesServer';
import CafeMenuPage from '@/components/cafe/CafeMenuPage';
import CafeMenuSkeleton from '@/components/cafe/CafeMenuSkeleton';

export const metadata = { title: '카페 메뉴 — good things' };

export default async function CafeMenuRoute() {
  /* 음료 메뉴 + likes snapshot Promise.all (점프 fix). */
  const [items, likesSnapshot] = await Promise.all([
    fetchCafeMenu(),
    fetchMenuLikesSnapshot(),
  ]);
  return (
    <Suspense fallback={<CafeMenuSkeleton />}>
      <CafeMenuPage items={items} initialLikesSnapshot={likesSnapshot} />
    </Suspense>
  );
}
