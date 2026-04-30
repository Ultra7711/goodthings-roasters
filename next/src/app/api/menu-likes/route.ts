/* ══════════════════════════════════════════════════════════════════════════
   GET /api/menu-likes
   - 전체 메뉴 좋아요 집계 카운트 반환 (공개)
   - 로그인 사용자라면 자신이 좋아요한 menu_id 목록도 함께 반환
   ══════════════════════════════════════════════════════════════════════════ */

export const dynamic = 'force-dynamic';

import { apiError, apiSuccess } from '@/lib/api/errors';
import { getClaims } from '@/lib/auth/getClaims';
import { createRouteHandlerClient } from '@/lib/supabaseServer';

export async function GET(): Promise<Response> {
  try {
    const supabase = await createRouteHandlerClient();

    // counts 집계와 인증 체크를 병렬 실행
    const [{ data: rows, error }, claims] = await Promise.all([
      supabase.from('menu_likes').select('menu_id'),
      getClaims(),
    ]);

    if (error) {
      console.error('[GET /api/menu-likes] select error', { code: error.code, message: error.message });
      return apiError('server_error');
    }

    // menu_id → count 집계
    const counts: Record<string, number> = {};
    for (const row of rows ?? []) {
      counts[row.menu_id] = (counts[row.menu_id] ?? 0) + 1;
    }

    let liked: string[] = [];
    if (claims) {
      const { data: myLikes, error: myErr } = await supabase
        .from('menu_likes')
        .select('menu_id')
        .eq('user_id', claims.userId);

      if (myErr) {
        console.error('[GET /api/menu-likes] myLikes error', { code: myErr.code, message: myErr.message });
      } else {
        liked = (myLikes ?? []).map((r) => r.menu_id);
      }
    }

    return apiSuccess({ counts, liked });
  } catch (err) {
    console.error('[GET /api/menu-likes] unexpected error', err);
    return apiError('server_error');
  }
}
