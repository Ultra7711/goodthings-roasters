/* ══════════════════════════════════════════════════════════════════════════
   POST / DELETE /api/reviews/[id]/helpful — 도움돼요 토글

   - POST: 추가 (23505 = 이미 누름 → idempotent 성공)
   - DELETE: 취소
   - 인증 필수. helpful_count 는 트리거(sync_review_helpful_count)가 동기화.
   menu-likes/[menuId] 패턴 답습 (CSRF + rate limit + auth).
   ══════════════════════════════════════════════════════════════════════════ */

import { apiError, apiSuccess } from '@/lib/api/errors';
import { enforceSameOrigin } from '@/lib/api/csrf';
import { checkRateLimit } from '@/lib/auth/rateLimit';
import { getClaims } from '@/lib/auth/getClaims';
import { createRouteHandlerClient } from '@/lib/supabaseServer';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const forbidden = enforceSameOrigin(request);
  if (forbidden) return forbidden;
  const limited = await checkRateLimit(request, 'cart_write');
  if (limited) return limited;
  const claims = await getClaims();
  if (!claims) return apiError('unauthorized');

  const { id } = await params;
  try {
    const supabase = await createRouteHandlerClient();
    const { error } = await supabase
      .from('review_helpfuls')
      .insert({ review_id: id, user_id: claims.userId });

    /* 23505 = 이미 누름 → 멱등 성공 처리 (optimistic 재시도 안전) */
    if (error && error.code !== '23505') {
      console.error('[POST /api/reviews/:id/helpful] insert error', { code: error.code });
      return apiError('server_error');
    }
    return apiSuccess({ ok: true });
  } catch (err) {
    console.error('[POST /api/reviews/:id/helpful] unexpected', err);
    return apiError('server_error');
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const forbidden = enforceSameOrigin(request);
  if (forbidden) return forbidden;
  const limited = await checkRateLimit(request, 'cart_write');
  if (limited) return limited;
  const claims = await getClaims();
  if (!claims) return apiError('unauthorized');

  const { id } = await params;
  try {
    const supabase = await createRouteHandlerClient();
    const { error } = await supabase
      .from('review_helpfuls')
      .delete()
      .eq('review_id', id)
      .eq('user_id', claims.userId);

    if (error) {
      console.error('[DELETE /api/reviews/:id/helpful] delete error', { code: error.code });
      return apiError('server_error');
    }
    return apiSuccess({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/reviews/:id/helpful] unexpected', err);
    return apiError('server_error');
  }
}
