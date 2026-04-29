/* ══════════════════════════════════════════
   Cafe Menu Route — /menu
   RP-5 재이식: 프로토타입 #cafe-menu-page 이식.
   - URL query 로 초기 필터/타겟 복구 (`?cat=brewing&item=b04`)
   - SSR 안전: CafeMenuPage 는 클라이언트 컴포넌트 (useSearchParams)
   - useSearchParams 사용 컴포넌트는 Suspense 로 감싸 prerender CSR bailout 회피
   - SSR 초기 likes 데이터: 서버에서 미리 fetch → 클라이언트 진입 시 API 대기 없음
   ══════════════════════════════════════════ */

import { Suspense } from 'react';
import CafeMenuPage from '@/components/cafe/CafeMenuPage';
import CafeMenuSkeleton from '@/components/cafe/CafeMenuSkeleton';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { getClaims } from '@/lib/auth/getClaims';

export const metadata = { title: '카페 메뉴 — good things' };

async function fetchInitialLikes() {
  const supabase = await createRouteHandlerClient();

  const { data: rows } = await supabase.from('menu_likes').select('menu_id');
  const counts: Record<string, number> = {};
  for (const row of rows ?? []) {
    counts[row.menu_id] = (counts[row.menu_id] ?? 0) + 1;
  }

  const claims = await getClaims();
  let liked: string[] = [];
  if (claims) {
    const { data: myLikes } = await supabase
      .from('menu_likes')
      .select('menu_id')
      .eq('user_id', claims.userId);
    liked = (myLikes ?? []).map((r) => r.menu_id);
  }

  return { counts, liked };
}

export default async function CafeMenuRoute() {
  // 실패 시 undefined → CafeMenuPage 가 클라이언트 fetch 로 fallback
  const initialLikes = await fetchInitialLikes().catch(() => undefined);

  return (
    <Suspense fallback={<CafeMenuSkeleton />}>
      <CafeMenuPage initialLikes={initialLikes} />
    </Suspense>
  );
}
