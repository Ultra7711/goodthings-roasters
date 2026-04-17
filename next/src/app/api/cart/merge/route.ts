/* ══════════════════════════════════════════════════════════════════════════
   POST /api/cart/merge — 게스트 localStorage 카트 → 회원 DB 카트 흡수 (Session 12)

   호출 시점:
   - 로그인 성공 직후 클라이언트가 localStorage 카트 전체를 1회 POST.
   - 성공 후 localStorage 비우기 (클라 책임).

   응답:
   - { data: { merged: N, skipped: M } }
     merged: upsert 성공 행 수
     skipped: product/volume not found 등 스킵 건 (클라에서 토스트로 안내 가능)
   ══════════════════════════════════════════════════════════════════════════ */

import { apiError, apiSuccess } from '@/lib/api/errors';
import { enforceSameOrigin } from '@/lib/api/csrf';
import { parseBody } from '@/lib/api/validate';
import { checkRateLimit } from '@/lib/auth/rateLimit';
import { getClaims } from '@/lib/auth/getClaims';
import { CartMergeSchema } from '@/lib/schemas/cart';
import { mergeGuestCart } from '@/lib/services/cartService';

export async function POST(request: Request): Promise<Response> {
  const forbidden = enforceSameOrigin(request);
  if (forbidden) return forbidden;

  const limited = await checkRateLimit(request, 'cart_write');
  if (limited) return limited;

  const claims = await getClaims();
  if (!claims) return apiError('unauthorized');

  const parsed = await parseBody(request, CartMergeSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await mergeGuestCart(claims.userId, parsed.data);
    return apiSuccess(result);
  } catch (err) {
    console.error('[POST /api/cart/merge] unexpected error', err);
    return apiError('server_error');
  }
}
