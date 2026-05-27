/* ══════════════════════════════════════════
   Cafe Menu Route — /menu
   RP-5 재이식 + S245-P20 SSR likes hydration + S247 counts-only SSR.

   - URL query 로 초기 필터/타겟 복구 (`?cat=brewing&item=b04`)
   - SSR 안전: CafeMenuPage 는 클라이언트 컴포넌트 (useSearchParams)
   - useSearchParams 사용 컴포넌트는 Suspense 로 감싸 prerender CSR bailout 회피
   - S247 폴리싱: counts 만 SSR ('use cache') → 페이지 dynamic 화 회피. user
     liked 는 CafeMenuPage 가 client useEffect 로 fetch → 정렬·뱃지는 SSR 시점
     popular 으로 fix → 점프 0, 좋아요 표시만 약간 지연.
   ══════════════════════════════════════════ */

import { Suspense } from 'react';
import { connection } from 'next/server';
import { fetchCafeMenu } from '@/lib/cafeMenuServer';
import { fetchMenuLikesCountsSnapshot } from '@/lib/menuLikesServer';
import CafeMenuPage from '@/components/cafe/CafeMenuPage';
import CafeMenuSkeleton from '@/components/cafe/CafeMenuSkeleton';

export const metadata = { title: '카페 메뉴' };

export default async function CafeMenuRoute() {
  /* S279-D · DEC-S279-D-1: cafeMenuServer 'use cache' 폐기로 caller 측
     connection() 명시 — admin 변경 즉시 /menu 반영 보장. likes counts 는
     fetchMenuLikesCountsSnapshot 의 별 정책 ('use cache' 보존). */
  await connection();
  const [items, likesCounts] = await Promise.all([
    fetchCafeMenu(),
    fetchMenuLikesCountsSnapshot(),
  ]);
  return (
    <Suspense fallback={<CafeMenuSkeleton />}>
      <CafeMenuPage items={items} initialLikesCounts={likesCounts} />
    </Suspense>
  );
}
