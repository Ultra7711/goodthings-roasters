/* ══════════════════════════════════════════════════════════════════════════
   GET /api/menu-likes
   - 로그인 사용자가 좋아요한 menu_id 목록 반환 (client liked hydrate 용)
   - 비로그인은 빈 배열 (쿼리 0회)
   - 전체 집계 counts 는 SSR snapshot(lib/menuLikesServer)이 담당 — 여기선 미반환
   ══════════════════════════════════════════════════════════════════════════ */

import { connection } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api/errors';
import { getClaims } from '@/lib/auth/getClaims';
import { createRouteHandlerClient } from '@/lib/supabaseServer';

export async function GET(): Promise<Response> {
  /* S295: Next.js 16 cacheComponents 환경에서 cookies() 호출이 prerender 종료 후
     resolve 되어 HANGING_PROMISE_REJECTION 발생. await connection() 으로 명시적
     dynamic 마킹 → Next.js 가 즉시 dynamic 처리하여 prerender attempt 자체 차단. */
  await connection();
  try {
    const claims = await getClaims();
    if (!claims) return apiSuccess({ liked: [] });

    const supabase = await createRouteHandlerClient();
    const { data: myLikes, error } = await supabase
      .from('menu_likes')
      .select('menu_id')
      .eq('user_id', claims.userId);

    if (error) {
      console.error('[GET /api/menu-likes] myLikes error', { code: error.code, message: error.message });
      return apiError('server_error');
    }

    return apiSuccess({ liked: (myLikes ?? []).map((r) => r.menu_id) });
  } catch (err) {
    console.error('[GET /api/menu-likes] unexpected error', err);
    return apiError('server_error');
  }
}
