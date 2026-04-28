/* ══════════════════════════════════════════════════════════════════════════
   POST /api/menu-likes/[menuId]
   - 좋아요 토글 (이미 있으면 삭제, 없으면 추가)
   - 인증 필수 (미로그인 401)
   - 응답: { liked: boolean, count: number }
   ══════════════════════════════════════════════════════════════════════════ */

import { apiError, apiSuccess } from '@/lib/api/errors';
import { enforceSameOrigin } from '@/lib/api/csrf';
import { checkRateLimit } from '@/lib/auth/rateLimit';
import { getClaims } from '@/lib/auth/getClaims';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { CAFE_MENU } from '@/lib/cafeMenu';

const VALID_MENU_IDS = new Set(CAFE_MENU.map((m) => m.id));

export async function POST(
  request: Request,
  { params }: { params: Promise<{ menuId: string }> },
): Promise<Response> {
  /* 1) CSRF */
  const forbidden = enforceSameOrigin(request);
  if (forbidden) return forbidden;

  /* 2) Rate Limit */
  const limited = await checkRateLimit(request, 'cart_write');
  if (limited) return limited;

  /* 3) 인증 필수 */
  const claims = await getClaims();
  if (!claims) return apiError('unauthorized');

  /* 4) menuId 검증 */
  const { menuId } = await params;
  if (!VALID_MENU_IDS.has(menuId)) {
    return apiError('not_found');
  }

  try {
    const supabase = await createRouteHandlerClient();

    /* 5) 기존 좋아요 확인 */
    const { data: existing, error: selectErr } = await supabase
      .from('menu_likes')
      .select('id')
      .eq('menu_id', menuId)
      .eq('user_id', claims.userId)
      .maybeSingle();

    if (selectErr) {
      console.error('[POST /api/menu-likes] select error', { code: selectErr.code, message: selectErr.message });
      return apiError('server_error');
    }

    const wasLiked = !!existing;

    /* 6) 토글 */
    if (wasLiked) {
      const { error: delErr } = await supabase
        .from('menu_likes')
        .delete()
        .eq('id', existing.id);

      if (delErr) {
        console.error('[POST /api/menu-likes] delete error', { code: delErr.code, message: delErr.message });
        return apiError('server_error');
      }
    } else {
      const { error: insErr } = await supabase
        .from('menu_likes')
        .insert({ menu_id: menuId, user_id: claims.userId });

      if (insErr) {
        console.error('[POST /api/menu-likes] insert error', { code: insErr.code, message: insErr.message });
        return apiError('server_error');
      }
    }

    /* 7) 최신 카운트 조회 */
    const { count, error: cntErr } = await supabase
      .from('menu_likes')
      .select('*', { count: 'exact', head: true })
      .eq('menu_id', menuId);

    if (cntErr) {
      console.error('[POST /api/menu-likes] count error', { code: cntErr.code, message: cntErr.message });
      return apiError('server_error');
    }

    return apiSuccess({ liked: !wasLiked, count: count ?? 0 });
  } catch (err) {
    console.error('[POST /api/menu-likes] unexpected error', err);
    return apiError('server_error');
  }
}
